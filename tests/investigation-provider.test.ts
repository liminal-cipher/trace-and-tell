import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeInvestigation, readInvestigation } from "@/lib/investigation";
import { emptyDocument, type InvestigationCommand, type ModelInput } from "@/lib/investigation-contracts";
import { metaRequest } from "@/lib/model-provider";
import { inferenceIdentity } from "@/lib/model-settings";
import { inputHash } from "@/lib/model-budget";
import { fixtureAnalysis } from "@/lib/model-fixture";

const mocks = vi.hoisted(() => ({ archive: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/archive", () => ({ listArchive: mocks.archive }));
vi.mock("@/lib/supabase", () => ({ storageAdmin: mocks.admin }));
const actor = "11111111-1111-4111-8111-111111111111";
const input: ModelInput = { operation: "observe", sources: [{ asset_id: actor, revision: 1, content: "ORBIT 47" }], observations: [] };
let directory: string, client: SupabaseClient;
let runs: { status: string; created_at: string }[];
const rpc = vi.fn();
const command = (mode: "meta-live" | "fixture" = "meta-live"): InvestigationCommand => ({ action: "analyse", key: crypto.randomUUID(), workspace_id: actor, expected_revision: 0, operation: "observe", sources: [{ asset_id: actor, revision: 1 }], mode });
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "trace-app-profile-")); runs = [];
    vi.stubEnv("VERCEL", ""); vi.stubEnv("MODEL_API_KEY", "mock-only"); vi.stubEnv("META_LIVE_APPROVED", "yes");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unapproved test network"); }));
    mocks.archive.mockResolvedValue({ assets: [{ id: actor, workspace_id: actor, active_revision: 1, deletion_state: "active" }], revisions: [{ asset_id: actor, revision: 1, content: "ORBIT 47" }] });
    const from = (table: string) => {
        const query = {
            select: () => query, eq: () => query, order: () => query,
            maybeSingle: async () => ({ error: null, data: table === "investigations" ? { revision: 0, document: emptyDocument() } : null }),
            range: async (offset: number) => ({ error: null, data: offset === 0 ? runs : [] }),
        };
        return query;
    };
    rpc.mockResolvedValue({ error: null, data: { id: actor } });
    mocks.admin.mockReturnValue({ from, rpc });
    client = { from, auth: { getUser: async () => ({ error: null, data: { user: { id: actor } } }) } } as unknown as SupabaseClient;
});
afterEach(() => {
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks();
    if (directory.startsWith(join(tmpdir(), "trace-app-profile-"))) rmSync(directory, { recursive: true, force: true });
});
function approve(bound = true) {
    const now = new Date().toISOString(), identity = inferenceIdentity(metaRequest(input, "muse-spark-1.3", "medium"), "medium");
    const path = join(directory, "approval.json");
    writeFileSync(path, JSON.stringify({ id: crypto.randomUUID(), model: "muse-spark-1.3", approved_at: now, expires_at: new Date(Date.now() + 3600000).toISOString(), catalogue_verified_at: now, pricing_verified_at: now, max_requests: 1, max_usd: 1.35, input_usd_per_million: 1.25, output_usd_per_million: 4.25, allowed_input_sha256: [inputHash(input)],
        ...(bound ? { request_bindings: [{ input_sha256: inputHash(input), request_sha256: identity.request_sha256, execution_sha256: identity.execution_sha256, profile: "medium" }] } : {}) }));
    vi.stubEnv("META_APPROVAL_FILE", path);
}
it("sends the app's medium request and saves the actual inference settings", async () => {
    approve();
    const fetcher = vi.fn(async () => Response.json({ model: "muse-spark-1.3", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixtureAnalysis(input)) } }], usage: { prompt_tokens: 100, completion_tokens: 5000 } }));
    vi.stubGlobal("fetch", fetcher);
    await executeInvestigation(client, actor, command());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify(metaRequest(input, "muse-spark-1.3", "medium")) }));
    const saved = rpc.mock.calls.find(([, args]) => args.payload.op === "save")![1].payload.record;
    expect(saved.inference).toMatchObject({ profile: "medium", reasoning_effort: "medium", max_completion_tokens: 8192, timeout_ms: 180000 });
    expect(saved.usage.completion_tokens).toBe(5000);
});
it("rejects an old unbound allowance before sending the new app request", async () => {
    approve(false);
    await expect(executeInvestigation(client, actor, command())).rejects.toThrow("new request-bound approval");
    expect(fetch).not.toHaveBeenCalled();
    expect(readdirSync(directory)).toEqual(["approval.json"]);
    expect(rpc.mock.calls.some(([, args]) => args.payload.op === "fail_run")).toBe(true);
});
it("keeps fixture execution unpaid and does not label it as medium inference", async () => {
    await executeInvestigation(client, actor, command("fixture"));
    expect(fetch).not.toHaveBeenCalled();
    const saved = rpc.mock.calls.find(([, args]) => args.payload.op === "save")![1].payload.record;
    expect(saved.mode).toBe("fixture"); expect(saved.inference).toBeUndefined(); expect(saved.usage).toBeNull();
});
it("keeps a 150-second run pending but flags a run older than the timeout and grace", async () => {
    runs = [
        { status: "running", created_at: new Date(Date.now() - 150000).toISOString() },
        { status: "running", created_at: new Date(Date.now() - 241000).toISOString() },
    ];
    const result = await readInvestigation(client, actor);
    expect(result.runs.map(r => r.status)).toEqual(["running", "unknown_outcome"]);
});
