import { beforeAll, afterAll, expect, it } from "vitest";
import { investigationDb, owner, other } from "./support/investigation-db";
import { applyReview, importAnalysis, modelInput, validateAnalysis, reconcile } from "@/lib/investigation-domain";
import { emptyDocument, type InvestigationCommand, type RunResult } from "@/lib/investigation-contracts";
import { fixtureAnalysis } from "@/lib/model-fixture";
let repo: Awaited<ReturnType<typeof investigationDb>>;
beforeAll(async () => { repo = await investigationDb(); });
afterAll(async () => { await repo.db.close(); });
async function send(action: Record<string, unknown>) { const s = await repo.snapshot(); return repo.execute({ ...action, key: crypto.randomUUID(), workspace_id: repo.workspace, expected_revision: s.revision } as InvestigationCommand); }
it("persists the three fixture slices, keeping hypothesis, original reading and testimony separate", async () => {
    const initial = await repo.snapshot();
    const sources = initial.archive.assets.slice(0, 2).map((a) => ({ asset_id: a.id, revision: 1 }));
    for (const source of sources)
        await send({ action: "analyse", operation: "observe", sources: [source], mode: "fixture" });
    let s = await repo.snapshot();
    const observation = s.document.entries[0];
    s = await send({ action: "review", id: observation.id, entry_revision: 1, decision: "corrected", text: "The note reads ORBIT 47; its date is unknown." });
    expect(s.document.entries[0].original_text).not.toBe(s.document.entries[0].text);
    s = await send({ action: "analyse", operation: "compare", sources, mode: "fixture" });
    const hypothesis = s.document.entries.find((e) => e.kind === "hypothesis")!;
    const question = s.document.entries.find((e) => e.kind === "question")!;
    await send({ action: "review", id: hypothesis.id, entry_revision: 1, decision: "accepted_for_inquiry" });
    s = await send({ action: "review", id: question.id, entry_revision: 1, decision: "selected" });
    expect(s.document.entries.find((e) => e.id === hypothesis.id)?.kind).toBe("hypothesis");
    for (const response of ["answered", "unknown", "declined", "conflicting"])
        s = await send({ action: "testify", question_id: question.id, speaker: `Synthetic ${response}`, response, source_mode: "heard_directly", text: response === "answered" ? "I remember a blue ticket." : response === "conflicting" ? "I remember a red ticket." : "" });
    const testimonies = s.document.entries.filter((e) => e.kind === "testimony");
    expect(testimonies).toHaveLength(4);
    expect(testimonies.every((e) => e.details.recorder === owner)).toBe(true);
    s = await send({ action: "exhibit", title: "An open question", testimony_ids: testimonies.map((t) => t.id) });
    expect(s.document.entries.at(-1)?.text).toContain("Chose not to answer");
    expect((await repo.db.query("select * from investigation_versions")).rows.length).toBe(s.revision);
});
it("marks descendants for review after a correction without overwriting earlier versions", async () => {
    const s = await repo.snapshot();
    const observation = s.document.entries.find((e) => e.kind === "observation")!;
    const next = await send({ action: "review", id: observation.id, entry_revision: observation.revision, decision: "corrected", uncertainty: "Neither the exact colour nor the reason for uncertainty is established." });
    expect(next.document.entries.find((e) => e.id === observation.id)?.text).toBe(observation.text);
    expect(next.document.entries.filter((e) => ["hypothesis", "question", "testimony", "exhibit"].includes(e.kind)).every((e) => e.evidence_validity === "needs_review")).toBe(true);
    await expect(send({ action: "exhibit", title: "Must not silently refresh", testimony_ids: [next.document.entries.find((e) => e.kind === "testimony")!.id] })).rejects.toThrow("Review");
});
it("propagates review state even when a revised exhibit precedes its newer parent",async()=>{
  const s=await repo.snapshot();
  const document=structuredClone(s.document);
  for(const entry of document.entries)entry.evidence_validity="current";
  document.entries.find((entry)=>entry.kind==="observation")!.revision+=1;
  document.entries.reverse();
  const result=reconcile(document,{workspace_id:repo.workspace,assets:s.archive.assets,revisions:s.archive.revisions});
  expect(result.entries.filter((e)=>["hypothesis","question","testimony","exhibit"].includes(e.kind)).every((e)=>e.evidence_validity==="needs_review")).toBe(true);
});
it("rejects forged, cross-workspace, stale and deleted source references", async () => {
    const s = await repo.snapshot();
    const context = { workspace_id: repo.workspace, assets: s.archive.assets, revisions: s.archive.revisions };
    expect(() => modelInput("observe", [{ asset_id: crypto.randomUUID(), revision: 1 }], emptyDocument(), context)).toThrow("unavailable");
    expect(() => modelInput("observe", [{ asset_id: s.archive.assets[0].id, revision: 99 }], emptyDocument(), context)).toThrow("changed");
    expect(() => modelInput("observe", [{ asset_id: s.archive.assets[0].id, revision: 1 }], emptyDocument(), { ...context, workspace_id: crypto.randomUUID() })).toThrow("unavailable");
    const input = modelInput("observe", [{ asset_id: s.archive.assets[0].id, revision: 1 }], emptyDocument(), context);
    const output = fixtureAnalysis(input);
    output.observations[0].asset_id = crypto.randomUUID();
    expect(() => validateAnalysis(output, input)).toThrow("invalid evidence");
});
it("keeps rejection across provider re-runs of the same evidence", async () => {
    const s = await repo.snapshot();
    const e = s.document.entries.find((e) => e.kind === "observation")!;
    await send({ action: "review", id: e.id, entry_revision: e.revision, decision: "rejected" });
    await expect(send({ action: "analyse", operation: "observe", sources: e.sources, mode: "fixture" })).rejects.toThrow("already been analysed");
    const next = await repo.snapshot();
    expect(next.document.entries.find((v) => v.id === e.id)?.review_state).toBe("rejected");
});
it("enforces owner, RPC and table permissions in SQL", async () => {
    await expect(repo.rpc({ op: "save", workspace_id: repo.workspace, key: crypto.randomUUID(), request: {}, expected_revision: 0, sources: [], document: emptyDocument() }, other)).rejects.toThrow("not_found");
    for (const role of ["anon", "authenticated"])
        await expect(repo.db.transaction(async (tx) => { await tx.exec(`set local role ${role}`); return tx.query("select investigation_command($1,$2)", [owner, "{}"]); })).rejects.toThrow("permission denied");
    for (const table of ["investigations", "investigation_versions", "investigation_runs"]) {
        const result = await repo.db.transaction(async (tx) => { await tx.exec("set local role authenticated"); await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [other, JSON.stringify({ sub: other, session_id: other })]); return tx.query(`select * from ${table}`); });
        expect(result.rows).toHaveLength(0);
    }
});
it("makes SQL receipts idempotent and rejects changed payloads or stale snapshots", async () => {
    const s = await repo.snapshot();
    const request = { action: "local-sql-check" };
    const payload = { op: "save", workspace_id: repo.workspace, key: crypto.randomUUID(), request, expected_revision: s.revision, sources: [], document: s.document };
    const first = await repo.rpc(payload);
    expect(await repo.rpc(payload)).toEqual(first);
    await expect(repo.rpc({ ...payload, request: { action: "different" } })).rejects.toThrow("idempotency_conflict");
    await expect(repo.rpc({ ...payload, key: crypto.randomUUID() })).rejects.toThrow("revision_conflict");
});
it("blocks late analysis after deletion and exposes broken links instead of reviving data", async () => {
    const s = await repo.snapshot();
    const id = s.archive.assets[0].id;
    const input = modelInput("observe", [{ asset_id: id, revision: 1 }], emptyDocument(), { workspace_id: repo.workspace, assets: s.archive.assets, revisions: s.archive.revisions });
    const output = fixtureAnalysis(input);
    const run = { id: crypto.randomUUID(), mode: "fixture", model: "fixture", input, output, raw: output, prompt_version: "v1", schema_version: "v1", latency_ms: 0, usage: null, cost_usd: null } as RunResult;
    await repo.db.query("update assets set deletion_state='pending' where id=$1", [id]);
    const next = await repo.snapshot();
    expect(next.document.entries.filter((e) => e.sources.some((r) => r.asset_id === id)).every((e) => e.evidence_validity === "invalidated")).toBe(true);
    expect(() => importAnalysis(emptyDocument(), run, { workspace_id: repo.workspace, assets: next.archive.assets, revisions: next.archive.revisions })).toThrow("deleted");
    await expect(repo.rpc({ op: "save", workspace_id: repo.workspace, key: crypto.randomUUID(), request: {}, expected_revision: next.revision, sources: input.sources, document: emptyDocument() })).rejects.toThrow("revision_conflict");
});
it("treats no_connection as a saved normal outcome", async () => {
    const s = await repo.snapshot();
    const context = { workspace_id: repo.workspace, assets: s.archive.assets, revisions: s.archive.revisions };
    const input = modelInput("compare", s.archive.assets.slice(1).map((a) => ({ asset_id: a.id, revision: 1 })), emptyDocument(), context);
    expect(validateAnalysis(fixtureAnalysis(input), input).connection?.outcome).toBe("no_connection");
    const rejected = s.document.entries.find((e) => e.review_state === "rejected")!;
    expect(() => applyReview(s.document, { action: "review", workspace_id: repo.workspace, key: crypto.randomUUID(), expected_revision: s.revision, id: rejected.id, entry_revision: rejected.revision, decision: "corrected", text: "Restore it" }, owner, context)).toThrow("remain rejected");
});
