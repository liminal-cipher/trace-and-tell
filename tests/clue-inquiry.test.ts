import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { investigationDb, owner } from "./support/investigation-db";
import { applyReview, modelInput, importAnalysis, validateAnalysis, reconcile } from "@/lib/investigation-domain";
import { investigationCommandSchema, type ModelInput } from "@/lib/investigation-contracts";
import { generateAnalysis, metaRequest, promptVersion } from "@/lib/model-provider";
import { inputHash } from "@/lib/model-budget";

let repo: Awaited<ReturnType<typeof investigationDb>>;
beforeAll(async () => { repo = await investigationDb(); });
afterAll(async () => { await repo.db.close(); });
async function setup() {
  let snapshot = await repo.snapshot();
  const source = snapshot.archive.assets[snapshot.document.entries.length ? 1 : 0];
  const envelope = () => ({ workspace_id: repo.workspace, expected_revision: snapshot.revision, key: crypto.randomUUID() });
  snapshot = await repo.execute({ ...envelope(), action: "analyse", operation: "observe", sources: [{ asset_id: source.id, revision: 1 }], mode: "fixture" });
  let clue = snapshot.document.entries.at(-1)!;
  const unreviewed = structuredClone(snapshot.document);
  snapshot = await repo.execute({ ...envelope(), action: "review", id: clue.id, entry_revision: clue.revision, decision: "accepted_for_inquiry" });
  clue = snapshot.document.entries.at(-1)!;
  const context = { workspace_id: repo.workspace, assets: snapshot.archive.assets, revisions: snapshot.archive.revisions };
  const command = { ...envelope(), action: "analyse" as const, operation: "inquire" as const, mode: "fixture" as const, sources: clue.sources, clue_id: clue.id, clue_revision: clue.revision };
  const input = modelInput("inquire", clue.sources, snapshot.document, context, command);
  return { snapshot, context, clue, input, command, unreviewed };
}
it("persists one-clue questions, testimony and exhibit without a fabricated connection", async () => {
  const { input, command, clue } = await setup();
  expect(input.observations[0]).toMatchObject({ id: clue.id, revision: 2, uncertainty: clue.details.uncertainty });
  let saved = await repo.execute(command);
  expect(saved.document.entries.some((e) => e.kind === "hypothesis")).toBe(false);
  const question = saved.document.entries.at(-1)!;
  expect(question).toMatchObject({ kind: "question", mode: "fixture", parents: [{ id: clue.id, revision: 2 }], sources: clue.sources });
  const envelope = () => ({ workspace_id: repo.workspace, expected_revision: saved.revision, key: crypto.randomUUID() });
  saved = await repo.execute({ ...envelope(), action: "review", id: question.id, entry_revision: 1, decision: "selected" });
  saved = await repo.execute({ ...envelope(), action: "testify", question_id: question.id, speaker: "Synthetic speaker", response: "unknown", source_mode: "heard_directly", text: "" });
  saved = await repo.execute({ ...envelope(), action: "exhibit", testimony_ids: [saved.document.entries.at(-1)!.id], title: "A memory still missing" });
  expect((await repo.snapshot()).document.entries.at(-1)).toMatchObject({ kind: "exhibit", mode: "human", model: null, run_id: null, text: "Synthetic speaker: Does not remember." });
  saved = await repo.execute({ ...envelope(), action: "review", id: clue.id, entry_revision: 2, decision: "corrected", uncertainty: "The detail may be misread." });
  expect(saved.document.entries.filter((e) => ["question", "testimony", "exhibit"].includes(e.kind)).every((e) => e.evidence_validity === "needs_review")).toBe(true);
});
it("requires exact accepted evidence and rejects stale, foreign and deleted sources before inference", async () => {
  const { snapshot, context, clue, input, command, unreviewed } = await setup();
  expect(() => modelInput("inquire", clue.sources, unreviewed, context, { ...command, clue_revision: 1 })).toThrow("current observation");
  expect(() => modelInput("inquire", clue.sources, snapshot.document, context, { ...command, clue_revision: 1 })).toThrow();
  expect(() => modelInput("inquire", clue.sources, snapshot.document, context)).toThrow();
  for (const change of ["deleted", "foreign", "revision"]) {
    const altered = structuredClone(context);
    const asset = altered.assets.find((a) => a.id === clue.sources[0].asset_id)!;
    if (change === "deleted") asset.deletion_state = "deleted";
    if (change === "foreign") asset.workspace_id = crypto.randomUUID();
    if (change === "revision") asset.active_revision++;
    expect(() => modelInput("inquire", clue.sources, snapshot.document, altered, command)).toThrow();
  }
  const run = await generateAnalysis(input, "fixture");
  const changed = structuredClone(snapshot.document);
  changed.entries.find((e) => e.id === clue.id)!.details.uncertainty = "Changed during request";
  expect(() => importAnalysis(changed, run, context)).toThrow("changed during inquiry");
  const imported = importAnalysis(snapshot.document, run, context);
  expect(() => importAnalysis(imported, run, context)).toThrow("already been analysed");
  const deleted = structuredClone(context);
  deleted.assets.find((a) => a.id === clue.sources[0].asset_id)!.deletion_state = "deleted";
  expect(reconcile(imported, deleted).entries.at(-1)?.evidence_validity).toBe("invalidated");
  const ask = investigationCommandSchema.parse({ ...command, action: "ask_clue", text: "What do you remember about this detail?", model: "forged", run_id: crypto.randomUUID(), actor: crypto.randomUUID(), sources: [] });
  if (ask.action !== "ask_clue") throw Error("Wrong command");
  const human = applyReview(snapshot.document, ask, owner, context).entries.at(-1)!;
  expect(human).toMatchObject({ mode: "human", model: null, run_id: null, sources: clue.sources, details: { recorder: owner } });
  expect(inputHash(input)).not.toBe(inputHash({ ...input, observations: [{ ...input.observations[0], uncertainty: "Changed" }] }));
});
it("uses a distinct question prompt, accepts abstention and keeps live allowance gates", async () => {
  const input: ModelInput = { operation: "inquire", sources: [{ asset_id: owner, revision: 1, content: "Synthetic clue" }], observations: [{ id: crypto.randomUUID(), revision: 2, text: "A visible detail", sources: [{ asset_id: owner, revision: 1 }], mode: "fixture", review_state: "accepted_for_inquiry", uncertainty: "Not verified" }] };
  expect(promptVersion(input)).toBe("archive-inquiry-v1");
  const request = metaRequest(input, "muse-spark-1.3", "medium");
  expect(request.reasoning_effort).toBe("medium");
  expect(request.messages[0].content).toContain("Do not identify faces");
  expect(validateAnalysis({ observations: [], connection: null, questions: [] }, input).questions).toEqual([]);
  expect(() => validateAnalysis({ observations: [{ ...input.sources[0], content: undefined, claim: "New claim", locator: "somewhere", uncertainty: "unknown" }], connection: null, questions: [] }, input)).toThrow();
  const fetcher = vi.fn();
  vi.stubEnv("MODEL_API_KEY", "synthetic-key");
  vi.stubEnv("META_LIVE_APPROVED", "no");
  try { await expect(generateAnalysis(input, "meta-live", { fetcher, profile: "medium" })).rejects.toThrow("approved"); }
  finally { vi.unstubAllEnvs(); }
  expect(fetcher).not.toHaveBeenCalled();
});
