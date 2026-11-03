import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/investigation/route";
import { AppError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/investigation", () => ({ executeInvestigation: mocks.execute, readInvestigation: mocks.read }));
const actor = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.stubEnv("APP_ORIGIN", "https://archive.example.test"); mocks.auth.mockResolvedValue({ client: {}, user: { id: actor } }); mocks.execute.mockResolvedValue({ revision: 1 }); });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
function request(origin = "https://archive.example.test") { return new Request("https://archive.example.test/api/investigation", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyse", key: actor, workspace_id: actor, expected_revision: 0, operation: "observe", sources: [{ asset_id: actor, revision: 1 }], mode: "fixture", actor: "forged", document: {}, role: "service_role" }) }); }
it("derives actor from online Auth and rejects client-supplied state and roles", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.execute.mock.calls[0][1]).toBe(actor);
    expect(mocks.execute.mock.calls[0][2]).not.toHaveProperty("actor");
    expect(mocks.execute.mock.calls[0][2]).not.toHaveProperty("document");
    expect(response.headers.get("cache-control")).toContain("no-store");
});
it("denies anonymous reads, expired-session writes and cross-origin mutations before work", async () => {
    mocks.auth.mockRejectedValue(new AppError(401, "Sign in again."));
    expect((await GET(new Request(`https://archive.example.test/api/investigation?workspace=${actor}`))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("https://evil.example.test"))).status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
});
it("passes an uncertainty-only correction through validation without trusting original details", async () => {
    const response = await POST(new Request("https://archive.example.test/api/investigation", {
        method: "POST", headers: { Origin: "https://archive.example.test", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", key: actor, workspace_id: actor, expected_revision: 2, id: actor, entry_revision: 2, decision: "corrected", uncertainty: "The cause is unknown.", original_uncertainty: "Forged", details: { original_uncertainty: "Forged" } }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.execute.mock.calls[0][2]).toEqual({ action: "review", key: actor, workspace_id: actor, expected_revision: 2, id: actor, entry_revision: 2, decision: "corrected", uncertainty: "The cause is unknown." });
});
it("authenticates human questions and strips client-supplied authorship, source and model fields", async () => {
    const command = { action: "ask", key: actor, workspace_id: actor, expected_revision: 2, hypothesis_id: actor, hypothesis_revision: 2, text: "What do you notice about these records?" };
    const send = (body: object, origin = "https://archive.example.test") => POST(new Request("https://archive.example.test/api/investigation", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    expect((await send({ ...command, actor: "forged", sources: [], mode: "meta-live", run_id: actor, details: { recorder: "forged" } })).status).toBe(200);
    expect(mocks.execute).toHaveBeenLastCalledWith({}, actor, command);
    mocks.execute.mockClear();
    expect((await send({ ...command, text: " " })).status).toBe(400);
    expect((await send(command, "https://evil.example.test")).status).toBe(403);
    mocks.auth.mockRejectedValue(new AppError(401, "Session expired"));
    expect((await send(command)).status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
});
