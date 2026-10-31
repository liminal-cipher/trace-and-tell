import { beforeEach, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GET } from "@/app/api/archive/assets/[id]/file/route";
import { cleanupWorkspace } from "@/lib/archive";
let client: SupabaseClient;
let state: "active" | "pending" | "deleted";
let deleteDuringRead: boolean, failRemoval: boolean, ownerVisible: boolean;
let storageCalls: number;
let capabilityExpiry: string | undefined;
let intentCleanup: string;
vi.mock("@/lib/supabase", () => ({
  requireUser: async () => ({ client }), storageAdmin: () => client,
}));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  state = "active"; deleteDuringRead = false; failRemoval = false; ownerVisible = true; storageCalls = 0;
  capabilityExpiry = undefined; intentCleanup = "pending";
  // HTTP fault injection only. No network or real Supabase credentials.
  client = createClient("http://localhost:54321", "test-only-key", {
    auth: { persistSession: false }, global: { fetch: async (input, init) => {
      const url = new URL(String(input)), method = init?.method ?? "GET";
      if (method === "GET" && Number(url.searchParams.get("offset")) > 0)
        return Response.json([]);
      if (url.pathname.includes("/storage/")) {
        storageCalls++;
        if (method === "DELETE") return failRemoval ? Response.json({ message: "injected failure" }, { status: 503 }) : Response.json([]);
        if (deleteDuringRead) state = "pending";
        return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
      }
      if (url.pathname.endsWith("/workspaces")) return Response.json(ownerVisible ? { id } : null);
      if (url.pathname.endsWith("/upload_intents")) {
        if (method === "PATCH") {
          const update = JSON.parse(String(init?.body));
          if (update.cleanup_state) intentCleanup = update.cleanup_state;
          return Response.json([]);
        }
        return Response.json(capabilityExpiry && intentCleanup !== "done" ? [{
          id, stage_key: "temporary", final_key: "unreferenced-original",
          cleanup_state: intentCleanup, capability_expires_at: capabilityExpiry,
        }] : []);
      }
      if (url.pathname.endsWith("/assets")) {
        if (method === "PATCH") { state = "deleted"; return Response.json([]); }
        if (url.searchParams.get("deletion_state") === "eq.pending") return Response.json(state === "pending" ? [{ id }] : []);
        return Response.json(ownerVisible && state === "active" ? { id, active_revision: 1 } : null);
      }
      if (url.pathname.endsWith("/asset_revisions")) {
        if (url.searchParams.has("storage_key")) return Response.json([]);
        if (url.searchParams.get("select") === "storage_key") return Response.json(url.searchParams.has("asset_id") ? [{ storage_key: "private-original" }] : { storage_key: "private-original" });
        return Response.json({ id, content_type: "image/png" });
      }
      throw new Error("Unexpected test request");
    } },
  });
});
it("keeps cleanup pending while capability is valid, then removes late files after expiry", async () => {
  capabilityExpiry = new Date(Date.now() + 60_000).toISOString();
  expect((await cleanupWorkspace(client, id)).warnings).toEqual([]);
  expect(intentCleanup).toBe("pending");
  expect(storageCalls).toBe(2);
  capabilityExpiry = new Date(Date.now() - 60_000).toISOString();
  expect((await cleanupWorkspace(client, id)).warnings).toEqual([]);
  expect(intentCleanup).toBe("done");
  expect(storageCalls).toBe(4);
  await cleanupWorkspace(client, id);
  expect(storageCalls).toBe(4);
});
it("does not mark an expired capability clean until both removals succeed", async () => {
  capabilityExpiry = new Date(Date.now() - 60_000).toISOString();
  failRemoval = true;
  expect((await cleanupWorkspace(client, id)).cleanup).toBe("failed");
  expect(intentCleanup).toBe("failed");
  failRemoval = false;
  expect((await cleanupWorkspace(client, id)).warnings).toEqual([]);
  expect(intentCleanup).toBe("done");
});
const read = () => GET(new Request(`http://localhost/api/archive/assets/${id}/file`), { params: Promise.resolve({ id }) });
it("blocks an original when deletion commits during Storage I/O", async () => {
  deleteDuringRead = true;
  const response = await read();
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toHaveProperty("error");
});
it("serves bytes only after both RLS checks with private no-store headers", async () => {
  const response = await read();
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(response.headers.get("cache-control")).toContain("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("does not touch Storage for a foreign or already-deleted asset", async () => {
  ownerVisible = false;
  expect((await read()).status).toBe(404);
  await expect(cleanupWorkspace(client, id)).rejects.toThrow("unavailable");
  ownerVisible = true; state = "pending";
  expect((await read()).status).toBe(404);
  expect(storageCalls).toBe(0);
});
it("keeps access blocked on removal failure, reports it, and completes a later retry", async () => {
  state = "pending"; failRemoval = true;
  const result = await cleanupWorkspace(client, id);
  expect(result.cleanup).toBe("failed");
  expect(result.warnings).toContain("An original could not be removed. Access remains blocked.");
  expect(state).toBe("pending");
  expect((await read()).status).toBe(404);
  failRemoval = false;
  expect((await cleanupWorkspace(client, id)).warnings).toEqual([]);
  expect(state).toBe("deleted");
});
