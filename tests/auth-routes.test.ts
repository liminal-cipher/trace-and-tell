import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { POST } from "@/app/api/archive/route";
import { GET as callback } from "@/app/auth/callback/route";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), execute: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ requireUser: mocks.requireUser, userClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
vi.mock("@/lib/archive", () => ({ executeCommand: mocks.execute, listArchive: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://archive.example.test");
  mocks.requireUser.mockResolvedValue({ client: {}, user: { id: actor } });
  mocks.execute.mockResolvedValue({ ok: true });
  mocks.exchange.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const request = () => new Request("https://archive.example.test/api/archive", {
  method: "POST", headers: { Origin: "https://archive.example.test", "Content-Type": "application/json" },
  body: JSON.stringify({ action: "create_workspace", key: actor, name: "Synthetic", actor: "forged", role: "service_role", storage_key: "forged" }),
});
it("derives the command actor only from verified Auth and strips forged privilege fields", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.execute).toHaveBeenCalledWith({}, actor, { action: "create_workspace", key: actor, name: "Synthetic" });
});
it("denies expired or revoked sessions before any privileged command", async () => {
  mocks.requireUser.mockRejectedValue(new AppError(401, "Sign in again."));
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("never derives callback redirects from request Host or next parameters and disables caching", async () => {
  const response = await callback(new Request("https://untrusted.test/auth/callback?code=synthetic-test-code&next=https://untrusted.test"));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://archive.example.test/archive");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it("fails closed without callback configuration and gives a safe redirect on failed exchange", async () => {
  vi.stubEnv("APP_ORIGIN", "");
  expect((await callback(new Request("https://untrusted.test/auth/callback?code=synthetic"))).status).toBe(503);
  expect(mocks.exchange).not.toHaveBeenCalled();
  vi.stubEnv("APP_ORIGIN", "https://archive.example.test");
  mocks.exchange.mockRejectedValue(new Error("Internal failure must not escape"));
  expect((await callback(new Request("https://archive.example.test/auth/callback?code=synthetic"))).headers.get("location")).toBe("https://archive.example.test/login?error=expired");
});
