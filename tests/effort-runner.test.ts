import { beforeEach, afterEach, expect, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hash } from "../scripts/real-world/core";
import { metaRequest } from "@/lib/model-provider";
import { inferenceIdentity } from "@/lib/model-settings";
import { fixtureAnalysis } from "@/lib/model-fixture";
import type { ModelInput } from "@/lib/investigation-contracts";

const state = vi.hoisted(() => ({ root: "", selected: [] as { id: string; input: ModelInput }[] }));
vi.mock("../scripts/real-world/effort", () => ({ get EFFORT_ROOT() { return state.root; }, verifyEffortProposal: async () => ({ selected: state.selected }) }));
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-04T08:00:00Z"));
    state.root = mkdtempSync(join(tmpdir(), "trace-effort-runner-"));
    state.selected = Array.from({ length: 10 }, (_, i) => ({ id: `case-${i}`, input: { operation: "observe", sources: [{ asset_id: "11111111-1111-4111-8111-111111111111", revision: 1, content: `TEST ${i}` }], observations: [] } }));
    const requests = state.selected.flatMap(c => (["medium", "high"] as const).map(profile => ({ case_id: c.id, experiment_id: `${c.id}-${profile}`, input_sha256: hash(JSON.stringify(c.input)), ...inferenceIdentity(metaRequest(c.input, "muse-spark-1.3", profile), profile), sources: [], reserved_usd: 1.35 })));
    const now = new Date().toISOString(), expires_at = "2026-11-05T00:00:00Z";
    const proposal = { expires_at, requests, code_files: [], references: [], allowances: [3, 3, 3, 3, 3, 3, 2].map((count, i) => ({ group: i + 1, max_requests: count, max_usd: count * 1.35, experiment_ids: requests.slice(i * 3, i * 3 + count).map(r => r.experiment_id) })) };
    // Avoid floating-point drift in the policy's exact decimal caps.
    proposal.allowances.forEach(g => { g.max_usd = g.max_requests * 135 / 100; });
    const proposalBytes = JSON.stringify(proposal);
    writeFileSync(join(state.root, "proposal.json"), proposalBytes);
    writeFileSync(join(state.root, "authorization.json"), JSON.stringify({ proposal_sha256: hash(proposalBytes), user_instruction: "Mock-only explicit test authorisation", approved_at: now, expires_at, catalogue_verified_at: now, pricing_verified_at: now, model: "muse-spark-1.3", mode: "Standard", max_requests: 20, max_usd: 27, profiles: ["medium", "high"], max_completion_tokens: 8192, timeout_ms: 180000, retries: 0, input_usd_per_million: 1.25, output_usd_per_million: 4.25 }));
    writeFileSync(join(state.root, "rights-confirmed.json"), JSON.stringify({ status: "confirmed", selected_photos: 9, proposal_sha256: hash(proposalBytes), checked_at: now }));
    vi.stubEnv("EFFORT_EXECUTE", "yes"); vi.stubEnv("VERCEL", ""); vi.stubEnv("MODEL_API_KEY", "mock-only-no-paid-key");
    vi.spyOn(process, "loadEnvFile").mockImplementation(() => undefined);
    fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
        const body = JSON.parse(String(options.body));
        const modelInput = JSON.parse(body.messages[1].content[0].text) as ModelInput;
        expect(body.max_completion_tokens).toBe(8192);
        expect(body.reasoning_effort).toBe(fetcher.mock.calls.length % 2 ? "medium" : "high");
        return Response.json({ model: "muse-spark-1.3", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixtureAnalysis(modelInput)) } }], usage: { prompt_tokens: 100, completion_tokens: 5000 } });
    });
    vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
    try {
        const summary = JSON.parse(readFileSync(join(state.root, "execution", "summary.json"), "utf8"));
        expect(summary).toMatchObject({ stopped: false, dispatched: 20, succeeded: 20, failed: 0, not_dispatched: 0, live_disabled: true });
        expect(fetcher).toHaveBeenCalledTimes(20);
        expect(JSON.parse(readFileSync(join(state.root, "execution", "medium-records.json"), "utf8"))).toHaveLength(10);
        expect(JSON.parse(readFileSync(join(state.root, "execution", "high-records.json"), "utf8"))).toHaveLength(10);
        expect(process.env.META_LIVE_APPROVED).toBe("no"); expect(process.env.MODEL_API_KEY).toBe("");
    } finally {
        vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers();
        if (state.root.startsWith(join(tmpdir(), "trace-effort-runner-"))) rmSync(state.root, { recursive: true, force: true });
    }
});
// Reuses the actual serial runner, journal and budget guard; only preflight inputs,
// credentials and HTTP transport are synthetic. No real inference is performed.
await import("../scripts/real-world-effort.run");
