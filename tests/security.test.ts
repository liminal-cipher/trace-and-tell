import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, authCookieOptions, checkOrigin } from "@/lib/errors";
import { browserEnvironment } from "./local-environment";
afterEach(() => vi.unstubAllEnvs());
describe("origin configuration", () => {
  it.each([
    "http://archive.example.test",
    "https://archive.example.test/path",
    "https://archive.example.test/?next=bad",
    "https://user:password@archive.example.test",
    "https://archive.example.test/#fragment",
  ])("fails closed for a non-origin or insecure configuration (%s)", (value) => {
    vi.stubEnv("APP_ORIGIN", value);
    expect(() => checkOrigin(new Request("https://archive.example.test/api", {
      headers: { Origin: new URL(value).origin },
    }))).toThrow();
  });
});
it("canonicalises the origin and always sets host-only HttpOnly/Lax cookies", () => {
  vi.stubEnv("APP_ORIGIN", "https://archive.example.test/");
  expect(appOrigin()).toBe("https://archive.example.test");
  expect(authCookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  expect(authCookieOptions().secure).toBe(false);
});
describe("browser test service boundaries", () => {
  it("explicitly clears credentials by default, overriding Next.js dotenv loading", () => {
    const environment = browserEnvironment({ SUPABASE_URL: "https://remote.example.test" });
    expect(environment.SUPABASE_URL).toBe("");
    expect(environment.SUPABASE_PUBLISHABLE_KEY).toBe("");
    expect(environment.SUPABASE_SERVICE_ROLE_KEY).toBe("");
  });
  it.each(["https://remote.example.test", "http://127.0.0.1.example.test", "http://user:password@localhost", "http://localhost/path"])("rejects non-local targets before starting a server (%s)", (url) => {
    expect(() => browserEnvironment({ RUN_LOCAL_SUPABASE_E2E: "1", SUPABASE_URL: url })).toThrow("local HTTP origin");
  });
  it("rejects missing local credentials", () => {
    expect(() => browserEnvironment({ RUN_LOCAL_SUPABASE_E2E: "1", SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow("credentials");
  });
});
