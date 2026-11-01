import { afterAll, beforeAll, expect, it } from "vitest";
import { investigationDb, owner } from "./support/investigation-db";
import { applyReview, importAnalysis, modelInput, reconcile } from "@/lib/investigation-domain";
import { emptyDocument, investigationCommandSchema, type InvestigationDocument, type RunResult } from "@/lib/investigation-contracts";
import { fixtureAnalysis } from "@/lib/model-fixture";
import { storedRun } from "@/lib/investigation";

let repo: Awaited<ReturnType<typeof investigationDb>>;
beforeAll(async () => { repo = await investigationDb(); });
afterAll(async () => { await repo.db.close(); });
const correction = "This record alone cannot establish the exact colour or the cause of uncertainty.";

async function setup(mode: RunResult["mode"] = "fixture") {
    const snapshot = await repo.snapshot();
    const context = { workspace_id: repo.workspace, assets: snapshot.archive.assets, revisions: snapshot.archive.revisions };
    const input = modelInput("observe", [{ asset_id: context.assets[0].id, revision: 1 }], emptyDocument(), context);
    const output = fixtureAnalysis(input);
    output.observations[0].uncertainty = "Colour uncertainty is caused by image compression.";
    // Authored data exercises each storage label; no live inference is performed.
    const run: RunResult = { id: crypto.randomUUID(), mode, model: "synthetic-storage-test", input, output, raw: structuredClone(output), prompt_version: "test", schema_version: "test", latency_ms: 0, usage: null, cost_usd: null };
    const document = importAnalysis(emptyDocument(), run, context);
    const entry = document.entries[0];
    const command = { action: "review" as const, key: crypto.randomUUID(), workspace_id: repo.workspace, expected_revision: snapshot.revision, id: entry.id, entry_revision: 1, decision: "corrected" as const };
    return { snapshot, context, run, document, entry, command };
}

it.each([
    { name: "text only", fields: { text: "The ticket reads ORBIT 47." } },
    { name: "uncertainty only", fields: { uncertainty: correction } },
    { name: "both fields", fields: { text: "The ticket reads ORBIT 47.", uncertainty: correction } },
])("preserves originals and provenance when correcting $name", async ({ fields }) => {
    const { context, document, entry, command } = await setup();
    const baseline = structuredClone(document);
    const parsed = investigationCommandSchema.parse({ ...command, ...fields });
    if (parsed.action !== "review") throw new Error("Expected a review command");
    const next = applyReview(document, parsed, owner, context);
    expect(next.entries[0]).toEqual({ ...entry, text: fields.text ?? entry.text, revision: 2, review_state: "corrected", details: { ...entry.details, uncertainty: fields.uncertainty ?? entry.details.uncertainty } });
    expect(document).toEqual(baseline);
    const again = applyReview(next, { ...command, entry_revision: 2, uncertainty: "The cause remains unknown." }, owner, context);
    expect(again.entries[0].details.original_uncertainty).toBe(entry.details.uncertainty);
    expect(again.entries[0].original_text).toBe(entry.text);
});

it("reads legacy documents without backfill and captures the original on explicit correction", async () => {
    const { context, document, entry, command } = await setup();
    delete entry.details.original_uncertainty;
    entry.revision = 2;
    entry.text = "Previously corrected claim";
    entry.review_state = "corrected";
    expect(reconcile(document, context)).toEqual(document);
    const next = applyReview(document, { ...command, entry_revision: 2, uncertainty: correction }, owner, context);
    expect(next.entries[0]).toMatchObject({ revision: 3, text: entry.text, original_text: entry.original_text, details: { uncertainty: correction, original_uncertainty: entry.details.uncertainty } });
    expect(entry.details).not.toHaveProperty("original_uncertainty");
    delete entry.details.uncertainty;
    const missing = applyReview(document, { ...command, entry_revision: 2, uncertainty: correction }, owner, context);
    expect(missing.entries[0].details.original_uncertainty).toBeNull();
});

it("rejects stale, rejected and non-observation uncertainty edits", async () => {
    const { context, document, entry, command } = await setup();
    expect(() => applyReview(document, { ...command, entry_revision: 99, uncertainty: correction }, owner, context)).toThrow("changed");
    expect(() => applyReview(document, command, owner, context)).toThrow("Enter the correction");
    expect(() => applyReview(document, { ...command, decision: "rejected", uncertainty: correction }, owner, context)).toThrow("Only observation");
    entry.review_state = "rejected";
    expect(() => applyReview(document, { ...command, uncertainty: correction }, owner, context)).toThrow("remain rejected");
    entry.review_state = "unreviewed";
    for (const kind of ["hypothesis", "question"] as const) {
        entry.kind = kind;
        expect(() => applyReview(document, { ...command, text: "Corrected", uncertainty: correction }, owner, context)).toThrow("Only observation");
        expect(applyReview(document, { ...command, text: "Corrected" }, owner, context).entries[0].text).toBe("Corrected");
    }
});

it("validates uncertainty bounds and strips client-supplied original details", async () => {
    const { command } = await setup();
    for (const uncertainty of ["", "   ", "x".repeat(2001), null, 42])
        expect(investigationCommandSchema.safeParse({ ...command, uncertainty }).success).toBe(false);
    const parsed = investigationCommandSchema.parse({ ...command, uncertainty: `  ${correction}  `, details: { original_uncertainty: "Forged" }, original_uncertainty: "Forged" });
    expect(parsed).toMatchObject({ uncertainty: correction });
    expect(parsed).not.toHaveProperty("details");
    expect(parsed).not.toHaveProperty("original_uncertainty");
});

it.each(["fixture", "replay", "meta-live"] as const)("retains %s run records and both revision fields through SQL storage", async (mode) => {
    const { context, run, document, entry, command, snapshot } = await setup(mode);
    const request = { action: "analyse", key: crypto.randomUUID(), mode };
    const begun = await repo.rpc({ op: "begin_run", key: request.key, request, workspace_id: repo.workspace, expected_revision: snapshot.revision, sources: entry.sources, mode, model: run.model, record: {} });
    run.id = begun.id as string;
    entry.run_id = run.id;
    const record = storedRun(run);
    await repo.rpc({ op: "save", key: request.key, request, workspace_id: repo.workspace, expected_revision: snapshot.revision, sources: entry.sources, document, run_id: run.id, record });
    const saved = await repo.snapshot();
    const review = { ...command, expected_revision: saved.revision, uncertainty: correction };
    const next = applyReview(saved.document, review, owner, context);
    const payload = { ...review, op: "save", request: review, sources: entry.sources, document: next };
    const receipt = await repo.rpc(payload);
    expect(await repo.rpc(payload)).toEqual(receipt);
    await expect(repo.rpc({ ...payload, request: { ...review, uncertainty: "Different" } })).rejects.toThrow("idempotency_conflict");
    await expect(repo.rpc({ ...payload, key: crypto.randomUUID() })).rejects.toThrow("revision_conflict");
    const reloaded = await repo.snapshot();
    expect(reloaded.revision).toBe(saved.revision + 1);
    expect(reloaded.document.entries[0]).toEqual(next.entries[0]);
    const versions = (await repo.db.query<{ document: InvestigationDocument }>("select document from investigation_versions where workspace_id=$1 and revision in ($2,$3) order by revision", [repo.workspace, saved.revision, reloaded.revision])).rows;
    expect(versions.map((v) => v.document.entries[0].details.uncertainty)).toEqual([entry.details.uncertainty, correction]);
    expect(versions.map((v) => v.document.entries[0].text)).toEqual([entry.text, entry.text]);
    const stored = (await repo.db.query<{ record: unknown }>("select record from investigation_runs where id=$1", [run.id])).rows[0].record;
    expect(stored).toEqual(record);
    expect(reloaded.document.entries[0]).toMatchObject({ sources: entry.sources, run_id: run.id, mode, model: run.model });
});
