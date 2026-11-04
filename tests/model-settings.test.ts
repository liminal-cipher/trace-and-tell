import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAnalysis, metaRequest, ProviderFailure } from "@/lib/model-provider";
import { inferenceIdentity, inferenceSettings, reservationUsd, type InferenceProfile } from "@/lib/model-settings";
import { inputHash } from "@/lib/model-budget";
import { fixtureAnalysis } from "@/lib/model-fixture";
import type { ModelInput } from "@/lib/investigation-contracts";

const input: ModelInput = { operation: "observe", sources: [{ asset_id: "11111111-1111-4111-8111-111111111111", revision: 1, content: "TEST" }], observations: [] };
let directory: string;
const identity = (profile: InferenceProfile) => inferenceIdentity(metaRequest(input, "muse-spark-1.3", profile), profile);
function approve(profile: InferenceProfile, binding = true, overrides: Record<string, unknown> = {}) {
    const now = new Date().toISOString(), request = identity(profile), id = crypto.randomUUID();
    const approval = { id, model: "muse-spark-1.3", approved_at: now, expires_at: new Date(Date.now() + 3600000).toISOString(), catalogue_verified_at: now, pricing_verified_at: now, max_requests: 3, max_usd: 4.05, input_usd_per_million: 1.25, output_usd_per_million: 4.25, allowed_input_sha256: [inputHash(input)],
        ...(binding ? { request_bindings: [{ input_sha256: inputHash(input), request_sha256: request.request_sha256, execution_sha256: request.execution_sha256, profile, ...overrides }] } : {}) };
    writeFileSync(join(directory, "approval.json"), JSON.stringify(approval));
    vi.stubEnv("META_APPROVAL_FILE", join(directory, "approval.json"));
    return join(directory, `allowance-${id}`);
}
const response = (tokens = 5000, finish = "stop") => Response.json({ model: "muse-spark-1.3", choices: [{ finish_reason: finish, message: { content: JSON.stringify(fixtureAnalysis(input)) } }], usage: { prompt_tokens: 100, completion_tokens: tokens } });
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "trace-profile-test-"));
    vi.stubEnv("VERCEL", ""); vi.stubEnv("MODEL_API_KEY", "mock-only"); vi.stubEnv("META_LIVE_APPROVED", "yes");
});
afterEach(() => {
    vi.unstubAllEnvs(); vi.restoreAllMocks();
    if (directory.startsWith(join(tmpdir(), "trace-profile-test-"))) rmSync(directory, { recursive: true, force: true });
});
it("keeps baseline request bytes and changes only the intended medium/high API controls", () => {
    const baseline = metaRequest(input, "muse-spark-1.3");
    expect(baseline).toMatchObject({ reasoning_effort: "minimal", max_completion_tokens: 1200 });
    expect(metaRequest(input, "muse-spark-1.3", "baseline")).toEqual(baseline);
    const medium = metaRequest(input, "muse-spark-1.3", "medium"), high = metaRequest(input, "muse-spark-1.3", "high");
    expect(medium).toEqual({ ...baseline, reasoning_effort: "medium", max_completion_tokens: 8192 });
    expect(high).toEqual({ ...medium, reasoning_effort: "high" });
    expect(identity("high").request_sha256).not.toBe(identity("medium").request_sha256);
    expect(inferenceSettings("medium").timeout_ms).toBe(180000);
    expect(reservationUsd("baseline")).toBe(1.32); expect(reservationUsd("high")).toBe(1.35);
    expect(() => inferenceSettings("none" as InferenceProfile)).toThrow();
});
it("blocks upgraded inference with a legacy allowance without sending or reserving", async () => {
    approve("high", false); const fetcher = vi.fn();
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher })).rejects.toThrow("new request-bound approval");
    expect(fetcher).not.toHaveBeenCalled(); expect(readdirSync(directory)).toEqual(["approval.json"]);
});
it("binds effort, output cap, timeout and request bytes to the new approval", async () => {
    const fetcher = vi.fn(); approve("medium");
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher })).rejects.toThrow("execution hash");
    approve("high", true, { request_sha256: "f".repeat(64) });
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher })).rejects.toThrow("execution hash");
    approve("high", true, { execution_sha256: "a".repeat(64) });
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher })).rejects.toThrow("execution hash");
    expect(fetcher).not.toHaveBeenCalled();
});
it("accepts larger known usage, records settings, settles the new reservation and rejects replaying a paid execution", async () => {
    const ledger = approve("high"), timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn(async () => response());
    const run = await generateAnalysis(input, "meta-live", { profile: "high", fetcher });
    expect(timeout).toHaveBeenCalledWith(180000);
    expect(run.usage?.completion_tokens).toBe(5000); expect(run.cost_usd).toBeCloseTo(0.021375);
    expect(run.inference).toEqual(identity("high"));
    const reserved = JSON.parse(readFileSync(join(ledger, readdirSync(ledger).find(n => n.endsWith("reservation.json"))!), "utf8"));
    expect(reserved).toMatchObject({ reserved_usd: 1.35, profile: "high", execution_sha256: identity("high").execution_sha256 });
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher })).rejects.toThrow("Retries are forbidden");
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps timeout and unknown usage fail-closed without a retry or fixture", async () => {
    approve("medium");const fetcher = vi.fn(async () => { throw new Error("mock timeout"); });
    await expect(generateAnalysis(input, "meta-live", { profile: "medium", fetcher })).rejects.toBeInstanceOf(ProviderFailure);
    await expect(generateAnalysis(input, "meta-live", { profile: "medium", fetcher })).rejects.toThrow("unknown cost");
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects completion usage above the selected cap and preserves truncation as a failure", async () => {
    approve("high");
    await expect(generateAnalysis(input, "meta-live", { profile: "high", fetcher: async () => response(8193) })).rejects.toBeInstanceOf(ProviderFailure);
    // A distinct mock allowance is used for an independent failure-path test.
    approve("high");
    try { await generateAnalysis(input, "meta-live", { profile: "high", fetcher: async () => response(8192, "length") }); throw new Error("Expected failure"); }
    catch (error) { expect(error).toBeInstanceOf(ProviderFailure); expect((error as ProviderFailure).record.usage?.completion_tokens).toBe(8192); expect((error as ProviderFailure).record.cost_usd).not.toBeNull(); }
});
