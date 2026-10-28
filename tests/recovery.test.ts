import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { executeCommand } from "@/lib/archive";
import { checkOrigin, readJson } from "@/lib/errors";
import { allRows } from "@/lib/pagination";
let admin: SupabaseClient;
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => admin }));
const actor = "11111111-1111-4111-8111-111111111111",
  intentId = "22222222-2222-4222-8222-222222222222";
let bytes: Buffer,
  permanent: Buffer | undefined,
  state: string,
  failCommit: boolean,
  visible: boolean;
let operations: string[];
const response = (data: unknown, status = 200) =>
  Response.json(data, { status });
beforeEach(async () => {
  bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#52787a" },
  })
    .png()
    .toBuffer();
  permanent = undefined;
  state = "pending";
  failCommit = false;
  visible = true;
  operations = [];
  // Fault injection at the HTTP boundary; this is not a real Supabase test.
  admin = createClient("http://localhost:54321", "test-only-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        operations.push(`${method} ${url.pathname}`);
        if (url.pathname === "/rest/v1/upload_intents")
          return response(
            visible
              ? {
                  id: intentId,
                  workspace_id: actor,
                  size: bytes.length,
                  content_type: "image/png",
                  state,
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                  stage_key: "staged",
                  final_key: "original",
                  asset_id: actor,
                }
              : null,
          );
        if (url.pathname === "/rest/v1/assets") return response({ id: actor });
        if (url.pathname === "/rest/v1/workspaces")
          return response({ message: "injected cleanup outage" }, 503);
        if (url.pathname === "/rest/v1/rpc/archive_command") {
          const { payload } = JSON.parse(String(init?.body));
          if (payload.action === "reject_upload") {
            state = "rejected";
            return response({ ok: true });
          }
          if (failCommit)
            return response({ message: "injected commit outage" }, 503);
          state = "complete";
          return response({ id: actor, duplicate: false });
        }
        if (url.pathname.includes("/archive-staging/"))
          return new Response(new Uint8Array(bytes), {
            headers: { "Content-Type": "image/png" },
          });
        if (url.pathname.includes("/archive-originals/")) {
          if (method === "POST") {
            if (permanent)
              return response(
                {
                  statusCode: "409",
                  error: "Duplicate",
                  message: "Already exists",
                },
                409,
              );
            permanent = bytes;
            return response({ Key: "original", Id: actor });
          }
          return new Response(new Uint8Array(permanent!), {
            headers: { "Content-Type": "image/png" },
          });
        }
        throw new Error(`Unexpected test request: ${url.pathname}`);
      },
    },
  });
});
describe("upload recovery with injected HTTP failures", () => {
  it("preserves a copied original after DB failure and completes an idempotent retry", async () => {
    const request = {
      action: "finalize_upload" as const,
      key: intentId,
      intent_id: intentId,
    };
    failCommit = true;
    await expect(executeCommand(admin, actor, request)).rejects.toThrow(
      "not been confirmed",
    );
    expect(permanent).toEqual(bytes);
    expect(state).toBe("pending");
    failCommit = false;
    const result = await executeCommand(admin, actor, request);
    expect(result.id).toBe(actor);
    expect(state).toBe("complete");
    expect(result.warnings).toEqual([
      "Saved. Temporary file cleanup is still pending.",
    ]);
    const again = await executeCommand(admin, actor, request);
    expect(again).toMatchObject({ id: actor, already_saved: true });
  });
  it("rejects corrupted bytes without creating an original or activating an asset", async () => {
    bytes = Buffer.from("A forged PNG");
    await expect(
      executeCommand(admin, actor, {
        action: "finalize_upload",
        key: intentId,
        intent_id: intentId,
      }),
    ).rejects.toThrow();
    expect(state).toBe("rejected");
    expect(permanent).toBeUndefined();
  });
  it("does not use privileged storage when the user cannot see the intent", async () => {
    visible = false;
    await expect(
      executeCommand(admin, actor, {
        action: "finalize_upload",
        key: intentId,
        intent_id: intentId,
      }),
    ).rejects.toThrow("unavailable");
    expect(operations).toEqual(["GET /rest/v1/upload_intents"]);
  });
});
describe("request boundaries", () => {
  it("loads records beyond the Data API response cap and propagates a later page failure", async () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
    await expect(
      allRows(async (from, to) => ({
        data: rows.slice(from, to + 1),
        error: null,
      })),
    ).resolves.toEqual(rows);
    await expect(
      allRows(async (from, to) =>
        from
          ? { data: null, error: { message: "offline" } }
          : { data: rows.slice(from, to + 1), error: null },
      ),
    ).rejects.toThrow();
  });
  it("rejects missing and foreign origins", () => {
    vi.stubEnv("APP_ORIGIN", "https://archive.example.test");
    expect(() =>
      checkOrigin(new Request("https://archive.example.test/api")),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("https://archive.example.test/api", {
          headers: { Origin: "https://attacker.test" },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("https://archive.example.test/api", {
          headers: { Origin: "https://archive.example.test" },
        }),
      ),
    ).not.toThrow();
    vi.unstubAllEnvs();
  });
  it("bounds actual body bytes, rejects malformed JSON, and preserves Unicode", async () => {
    const request = (body: string) =>
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    await expect(readJson(request("x".repeat(100001)))).rejects.toThrow(
      "too large",
    );
    await expect(readJson(request("{"))).rejects.toThrow("valid JSON");
    await expect(readJson(request('{"text":"기록"}'))).resolves.toEqual({
      text: "기록",
    });
  });
});
