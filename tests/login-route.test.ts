import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  userClient: async () => ({ auth: { signInWithOtp: send } }),
}));
beforeEach(() => vi.stubEnv("APP_ORIGIN", "https://archive.example.test"));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const request = (origin = "https://archive.example.test") => new Request(
  "https://archive.example.test/api/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "synthetic@example.test" }),
  },
);

it.each([
  [{ code: "over_email_send_rate_limit", status: 429 }, 429, "email sending limit"],
  [{ code: "over_request_rate_limit", status: 429 }, 429, "Too many sign-in requests"],
  [{ code: "unexpected_failure", status: 500 }, 503, "could not be sent"],
] as const)("classifies a safe error without retry or provider details (%j)", async (error, status, message) => {
  send.mockResolvedValue({ error: { ...error, message: "PRIVATE_PROVIDER_DETAIL" } });
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const body = await response.text();
  expect(body).toContain(message);
  expect(body).not.toContain("PRIVATE_PROVIDER_DETAIL");
  expect(send).toHaveBeenCalledTimes(1);
});

it("retains the configured PKCE callback and rejects foreign origins before sending", async () => {
  send.mockResolvedValue({ error: null });
  expect((await POST(request("https://foreign.invalid"))).status).toBe(403);
  expect(send).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    email: "synthetic@example.test",
    options: { emailRedirectTo: "https://archive.example.test/auth/callback" },
  });
});
