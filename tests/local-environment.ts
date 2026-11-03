// Shared by Playwright config and its tests. Never print URLs or credentials.
export function assertLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash ||
      (value !== url.origin && value !== `${url.origin}/`)) throw new Error("target");
  } catch { throw new Error("Integration tests require an exact local HTTP origin."); }
}
export function browserEnvironment(env: Record<string, string | undefined>) {
  const port = env.PLAYWRIGHT_PORT ?? "3000";
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
    throw new Error("Provide a local test port between 1024 and 65535.");
  const enabled = env.RUN_LOCAL_SUPABASE_E2E === "1";
  const result = {
    APP_ORIGIN: `http://127.0.0.1:${port}`,
    SUPABASE_URL: "",
    SUPABASE_PUBLISHABLE_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    MODEL_API_KEY: "",
    META_LIVE_APPROVED: "no",
    META_APPROVAL_FILE: "",
    LOCAL_MAILPIT_URL: "http://127.0.0.1:54324",
  };
  if (enabled) {
    assertLocalOrigin(env.SUPABASE_URL ?? "");
    assertLocalOrigin(env.LOCAL_MAILPIT_URL ?? result.LOCAL_MAILPIT_URL);
    if (!env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Provide local Supabase credentials in the test process environment.");
    result.SUPABASE_URL = env.SUPABASE_URL!;
    result.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
    result.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    result.LOCAL_MAILPIT_URL = env.LOCAL_MAILPIT_URL ?? result.LOCAL_MAILPIT_URL;
  }
  // Empty values deliberately override .env.local in the Next.js child process.
  return result;
}
