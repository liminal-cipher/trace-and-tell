import { afterAll, beforeAll, expect, it } from "vitest";
import { investigationDb, owner, other } from "./support/investigation-db";
import { applyReview, importAnalysis, modelInput, reconcile, validateAnalysis } from "@/lib/investigation-domain";
import { emptyDocument, investigationCommandSchema, type InvestigationDocument, type RunResult } from "@/lib/investigation-contracts";
import { fixtureAnalysis } from "@/lib/model-fixture";

let repo: Awaited<ReturnType<typeof investigationDb>>;
beforeAll(async () => { repo = await investigationDb(); });
afterAll(async () => { await repo.db.close(); });
async function setup() {
    const snapshot = await repo.snapshot();
    const context = { workspace_id: repo.workspace, assets: snapshot.archive.assets, revisions: snapshot.archive.revisions };
    const input = modelInput("compare", context.assets.slice(0, 2).map((a) => ({ asset_id: a.id, revision: 1 })), emptyDocument(), context);
    const output = { ...fixtureAnalysis(input), questions: [] };
    // Authored response tests a Meta-labelled parent; no provider is invoked.
    const run: RunResult = { id: crypto.randomUUID(), mode: "meta-live", model: "synthetic-storage-test", input, output, raw: structuredClone(output), prompt_version: "test", schema_version: "test", latency_ms: 0, usage: null, cost_usd: null };
    const original = importAnalysis(emptyDocument(), run, context);
    const hypothesis = original.entries[0];
    const envelope = { key: crypto.randomUUID(), workspace_id: repo.workspace, expected_revision: snapshot.revision };
    const accepted = applyReview(original, { ...envelope, action: "review", id: hypothesis.id, entry_revision: 1, decision: "accepted_for_inquiry" }, owner, context);
    const command = { ...envelope, action: "ask" as const, hypothesis_id: hypothesis.id, hypothesis_revision: 2, text: "What, if anything, do you know about these records?" };
    return { snapshot, context, input, run, original, accepted, hypothesis, envelope, command };
}
it("accepts questionless model output and adds human provenance without attributing it to the run", async () => {
    const { context, input, run, accepted, command, hypothesis } = await setup();
    expect(validateAnalysis(run.output, input).questions).toEqual([]);
    const before = structuredClone({ accepted, run });
    const next = applyReview(accepted, command, owner, context);
    const q = next.entries.at(-1)!;
    expect(q).toMatchObject({ kind: "question", mode: "human", model: null, run_id: null, revision: 1, review_state: "unreviewed", text: command.text, original_text: command.text, parents: [{ id: hypothesis.id, revision: 2 }], sources: hypothesis.sources, details: { recorder: owner } });
    expect({ accepted, run }).toEqual(before);
    expect(next.analysed).toEqual(accepted.analysed);
});
it("validates human text and exact parent revision while discarding forged provenance and sources", async () => {
    const { command } = await setup();
    for (const text of ["", "   ", "x".repeat(2001), null, 3])
        expect(investigationCommandSchema.safeParse({ ...command, text }).success).toBe(false);
    for (const hypothesis_revision of [0, -1, 1.5, undefined])
        expect(investigationCommandSchema.safeParse({ ...command, hypothesis_revision }).success).toBe(false);
    expect(investigationCommandSchema.parse({ ...command, text: `  ${command.text}  `, actor: other, mode: "meta-live", model: "forged", run_id: other, sources: [], details: { recorder: other } })).toEqual(command);
});
it("requires a current accepted hypothesis, rejecting stale, missing and wrong-kind parents", async () => {
    const { context, original, accepted, command } = await setup();
    expect(() => applyReview(original, { ...command, hypothesis_revision: 1 }, owner, context)).toThrow("Choose the hypothesis");
    expect(() => applyReview(accepted, { ...command, hypothesis_revision: 1 }, owner, context)).toThrow("changed");
    expect(() => applyReview(accepted, { ...command, hypothesis_id: crypto.randomUUID() }, owner, context)).toThrow("unavailable");
    for (const state of ["rejected", "needs_review", "invalidated", "question"] as const) {
        const bad = structuredClone(accepted);
        if (state === "rejected") bad.entries[0].review_state = state;
        else if (state === "question") bad.entries[0].kind = state;
        else bad.entries[0].evidence_validity = state;
        expect(() => applyReview(bad, command, owner, context)).toThrow();
    }
});
it("rejects changed, deleted and foreign source references without accepting browser replacements", async () => {
    const { context, accepted, command } = await setup();
    for (const change of ["revision", "deleted", "foreign"] as const) {
        const changed = structuredClone(context);
        if (change === "revision") changed.assets[0].active_revision++;
        if (change === "deleted") changed.assets[0].deletion_state = "deleted";
        if (change === "foreign") changed.assets[0].workspace_id = crypto.randomUUID();
        expect(() => applyReview(accepted, command, owner, changed)).toThrow();
    }
    expect(() => applyReview(accepted, command, owner, { ...context, workspace_id: crypto.randomUUID() })).toThrow("unavailable");
});
it("selects and corrects human questions, records testimony/exhibit, and propagates parent changes", async () => {
    const { context, accepted, command, envelope, hypothesis } = await setup();
    let doc = applyReview(accepted, command, owner, context);
    const q = doc.entries.at(-1)!;
    const select = { ...envelope, action: "review" as const, id: q.id, entry_revision: 1, decision: "selected" as const };
    doc = applyReview(doc, select, owner, context);
    doc = applyReview(doc, { ...envelope, action: "testify", question_id: q.id, speaker: "Synthetic speaker", response: "answered", source_mode: "heard_directly", text: "I do not know where these came from." }, owner, context);
    const testimony = doc.entries.at(-1)!;
    doc = applyReview(doc, { ...envelope, action: "exhibit", testimony_ids: [testimony.id], title: "An open inquiry" }, owner, context);
    expect(doc.entries.slice(1).every((e) => e.mode === "human" && e.run_id === null && e.model === null)).toBe(true);
    expect(doc.entries.at(-1)?.text).toContain("Synthetic speaker: I do not know");
    const correction = applyReview(doc, { ...select, entry_revision: 2, decision: "corrected", text: "What can you tell me about the wording?" }, owner, context);
    expect(correction.entries[1]).toMatchObject({ revision: 3, original_text: command.text, mode: "human", run_id: null, details: { recorder: owner } });
    expect(correction.entries.slice(2).every((e) => e.evidence_validity === "needs_review")).toBe(true);
    for (const decision of ["corrected", "rejected"] as const) {
        const changed = applyReview(doc, { ...envelope, action: "review", id: hypothesis.id, entry_revision: 2, decision, ...(decision === "corrected" ? { text: "The shared words alone do not establish identity." } : {}) }, owner, context);
        expect(changed.entries.slice(1).every((e) => e.evidence_validity === "needs_review")).toBe(true);
        expect(() => applyReview(changed, { ...select, entry_revision: 2 }, owner, context)).toThrow();
    }
    for (const deletion of [false, true]) {
        const changed = structuredClone(context);
        if (deletion) changed.assets[0].deletion_state = "deleted";
        else changed.assets[0].active_revision++;
        const state = reconcile(doc, changed);
        expect(state.entries.every((e) => e.evidence_validity === (deletion ? "invalidated" : "needs_review"))).toBe(true);
    }
});
it("uses existing SQL history, idempotency and ownership checks without changing a Model Run", async () => {
    const { snapshot, context, run, original, command, envelope } = await setup();
    const request = { action: "analyse", key: crypto.randomUUID() };
    const begin = await repo.rpc({ ...envelope, key: request.key, op: "begin_run", request, sources: run.input.sources, mode: run.mode, model: run.model });
    run.id = begin.id as string;
    original.entries[0].run_id = run.id;
    await repo.rpc({ ...envelope, key: request.key, op: "save", request, sources: run.input.sources, document: original, run_id: run.id, record: run });
    const accepted = applyReview(original, { ...envelope, action: "review", id: original.entries[0].id, entry_revision: 1, decision: "accepted_for_inquiry" }, owner, context);
    await repo.rpc({ ...envelope, key: crypto.randomUUID(), op: "save", request: { action: "review" }, expected_revision: snapshot.revision + 1, sources: run.input.sources, document: accepted });
    const saved = await repo.snapshot();
    const ask = { ...command, expected_revision: saved.revision };
    const document = applyReview(saved.document, ask, owner, context);
    const payload = { ...ask, op: "save", request: ask, sources: document.entries.at(-1)!.sources, document };
    const receipt = await repo.rpc(payload);
    expect(await repo.rpc(payload)).toEqual(receipt);
    await expect(repo.rpc({ ...payload, request: { ...ask, text: "Different request" } })).rejects.toThrow("idempotency_conflict");
    await expect(repo.rpc({ ...payload, key: crypto.randomUUID() })).rejects.toThrow("revision_conflict");
    await expect(repo.rpc({ ...payload, key: crypto.randomUUID() }, other)).rejects.toThrow("not_found");
    const reloaded = await repo.snapshot();
    expect(reloaded.revision).toBe(saved.revision + 1);
    expect(reloaded.document.entries.filter((e) => e.kind === "question")).toHaveLength(1);
    const history = (await repo.db.query<{ document: InvestigationDocument }>("select document from investigation_versions where workspace_id=$1 order by revision", [repo.workspace])).rows;
    expect(history.at(-2)!.document.entries).toHaveLength(1);
    expect(history.at(-1)!.document).toEqual(document);
    expect((await repo.db.query<{ record: unknown }>("select record from investigation_runs where id=$1", [run.id])).rows[0].record).toEqual(run);
    // A Source change between domain validation and SQL commit is rejected.
    await repo.db.query("update assets set active_revision=2 where id=$1", [context.assets[0].id]);
    await expect(repo.rpc({ ...payload, key: crypto.randomUUID(), expected_revision: reloaded.revision })).rejects.toThrow("revision_conflict");
    await repo.db.query("update assets set active_revision=1 where id=$1", [context.assets[0].id]);
    const foreign = crypto.randomUUID();
    await repo.db.query("insert into workspaces(id,owner_user_id,name) values($1,$2,'Other synthetic workspace')", [foreign, owner]);
    await expect(repo.rpc({ ...payload, workspace_id: foreign, key: crypto.randomUUID(), expected_revision: 0 })).rejects.toThrow("revision_conflict");
});
