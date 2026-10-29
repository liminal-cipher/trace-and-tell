import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let directory: string;
let workspace: string;
let note: string;
const key = () => crypto.randomUUID();
async function command(payload: Record<string, unknown>, actor = owner) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    "select public.archive_command($1::uuid,$2::jsonb) as result",
    [actor, JSON.stringify(payload)],
  );
  return result.rows[0].result;
}
async function asRole(
  role: string,
  user: string,
  sql: string,
  anonymous = false,
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [user, JSON.stringify({ sub: user, session_id: user, is_anonymous: anonymous })],
    );
    return tx.query(sql);
  });
}
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "trace-archive-db-"));
  db = new PGlite(directory);
  // Platform scaffolding only: the application migration runs unchanged.
  // This tests PostgreSQL privileges/RLS, not GoTrue or the Storage HTTP service.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
    insert into auth.users values ('${owner}'),('${other}');
    insert into auth.sessions values ('${owner}','${owner}',null),('${other}','${other}',null);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create policy unrelated_allow_all on storage.objects for all to anon,authenticated using(true) with check(true);`);
  for (const migration of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
afterAll(async () => {
  await db?.close();
  if (directory && directory.startsWith(join(tmpdir(), "trace-archive-db-")))
    rmSync(directory, { recursive: true, force: true });
});
describe("unchanged migration on local PostgreSQL (PGlite)", () => {
  it("creates a workspace exactly once and rejects key reuse with different data", async () => {
    const request = {
      action: "create_workspace",
      key: key(),
      name: "Synthetic collection",
    };
    const first = await command(request);
    workspace = first.id as string;
    expect(await command(request)).toEqual(first);
    await expect(command({ ...request, name: "Changed" })).rejects.toThrow(
      "idempotency_conflict",
    );
    expect((await db.query("select * from workspaces")).rows).toHaveLength(1);
  });
  it("enforces owner isolation, anonymous denial, explicit grants and server-only RPC", async () => {
    expect(
      (await asRole("authenticated", owner, "select * from public.workspaces"))
        .rows,
    ).toHaveLength(1);
    expect(
      (await asRole("authenticated", other, "select * from public.workspaces"))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await asRole(
          "authenticated",
          owner,
          "select * from public.workspaces",
          true,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asRole("anon", "", "select * from public.workspaces"),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole(
        "authenticated",
        owner,
        "insert into workspaces(name,owner_user_id) values ('Forged','" +
          other +
          "')",
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole("authenticated", owner, `select archive_command('${owner}','{}')`),
    ).rejects.toThrow("permission denied");
    await expect(
      command(
        {
          action: "rename_workspace",
          key: key(),
          workspace_id: workspace,
          expected_revision: 1,
          name: "Stolen",
        },
        other,
      ),
    ).rejects.toThrow("not_found");
  });
  it("runs the invoker command as service_role with explicit privileges", async () => {
    const result = await asRole(
      "service_role",
      "",
      `select archive_command('${owner}','${JSON.stringify({ action: "rename_workspace", key: key(), workspace_id: workspace, expected_revision: 1, name: "Renamed collection" })}')`,
    );
    expect(result.rows).toHaveLength(1);
  });
  it("denies direct writes and privileged columns even to an authenticated owner", async () => {
    for (const table of ["workspaces", "assets", "asset_revisions", "upload_intents", "command_receipts"]) {
      await expect(asRole("authenticated", owner, `delete from public.${table} where false`)).rejects.toThrow("permission denied");
      const privileges = await db.query<{ allowed: boolean }>(
        "select has_table_privilege('authenticated',$1,privilege) as allowed from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege", [table],
      );
      expect(privileges.rows.every((row) => !row.allowed)).toBe(true);
    }
    for (const query of ["select * from command_receipts", "select storage_key from asset_revisions", "select stage_key,final_key from upload_intents", `select archive_command('${owner}','{}')`]) {
      await expect(asRole("authenticated", owner, query)).rejects.toThrow("permission denied");
      await expect(asRole("anon", "", query)).rejects.toThrow("permission denied");
    }
  });
  it("keeps immutable note revisions, Korean text, and rejects concurrent stale edits", async () => {
    const saved = await command({
      action: "save_note",
      key: key(),
      workspace_id: workspace,
      metadata: { title: "메모", source_note: "Synthetic" },
      content: "원문 보존",
    });
    note = saved.id as string;
    const request = {
      action: "revise_asset",
      workspace_id: workspace,
      asset_id: note,
      expected_revision: 1,
      metadata: { title: "Revised note" },
      content: "Edited text",
    };
    const attempts = await Promise.allSettled([
      command({ ...request, key: key() }),
      command({ ...request, key: key() }),
    ]);
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((x) => x.status === "rejected")).toHaveLength(1);
    const revisions = await db.query<{ content: string }>(
      "select content from asset_revisions where asset_id=$1 order by revision",
      [note],
    );
    expect(revisions.rows.map((r) => r.content)).toEqual([
      "원문 보존",
      "Edited text",
    ]);
    await expect(
      asRole(
        "authenticated",
        owner,
        `update asset_revisions set content='tampered' where asset_id='${note}'`,
      ),
    ).rejects.toThrow("permission denied");
  });
  it("deduplicates bytes across upload intents and rejects expired completion", async () => {
    const intent = () =>
      command({
        action: "create_upload",
        key: key(),
        workspace_id: workspace,
        metadata: { title: "Synthetic image" },
        size: 100,
        content_type: "image/png",
      });
    const a = await intent(),
      b = await intent(),
      expired = await intent();
    const finish = {
      action: "finalize_upload",
      sha256: "a".repeat(64),
      width: 5,
      height: 5,
    };
    const completedKey = key();
    const one = await command({ ...finish, key: completedKey, intent_id: a.id });
    expect(await command({ action: "finalize_upload", key: completedKey, intent_id: a.id })).toEqual(one);
    await expect(command({ action: "finalize_upload", key: completedKey, intent_id: b.id })).rejects.toThrow("idempotency_conflict");
    const two = await command({ ...finish, key: key(), intent_id: b.id });
    expect(one.id).toBe(two.id);
    expect(two.duplicate).toBe(true);
    await db.query(
      "update upload_intents set expires_at=now()-interval '1 minute' where id=$1",
      [expired.id],
    );
    await expect(
      command({ ...finish, key: key(), intent_id: expired.id }),
    ).rejects.toThrow("intent_expired");
    const rejected = await intent();
    await command({
      action: "reject_upload",
      key: key(),
      intent_id: rejected.id,
    });
    await expect(
      command({ ...finish, key: key(), intent_id: rejected.id }),
    ).rejects.toThrow("intent_rejected");
  });
  it("enforces 6 MiB and the 20-photo reservation quota", async () => {
    const payload = {
      action: "create_upload",
      workspace_id: workspace,
      metadata: { title: "Quota image" },
      size: 100,
      content_type: "image/webp",
    };
    await expect(
      command({ ...payload, key: key(), size: 6291457 }),
    ).rejects.toThrow();
    for (let n = 0; n < 19; n++) await command({ ...payload, key: key() });
    await expect(command({ ...payload, key: key() })).rejects.toThrow(
      "photo_limit",
    );
  });
  it("blocks all original revision access immediately on deletion and prevents late revival", async () => {
    await command({
      action: "delete_asset",
      key: key(),
      workspace_id: workspace,
      asset_id: note,
      expected_revision: 2,
    });
    expect(
      (
        await asRole(
          "authenticated",
          owner,
          `select id,content from asset_revisions where asset_id='${note}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      command({
        action: "revise_asset",
        key: key(),
        workspace_id: workspace,
        asset_id: note,
        expected_revision: 2,
        metadata: { title: "Late write" },
      }),
    ).rejects.toThrow("not_found");
    const photo = (
      await db.query<{ id: string }>("select id from assets where kind='photo'")
    ).rows[0];
    const intent = (
      await db.query<{ id: string }>(
        "select id from upload_intents where asset_id=$1 limit 1",
        [photo.id],
      )
    ).rows[0];
    await command({
      action: "delete_asset",
      key: key(),
      workspace_id: workspace,
      asset_id: photo.id,
      expected_revision: 1,
    });
    await expect(
      command({ action: "finalize_upload", key: key(), intent_id: intent.id }),
    ).rejects.toThrow("not_found");
  });
  it("denies direct storage access even alongside an unrelated permissive policy", async () => {
    await db.exec(
      "insert into storage.objects(bucket_id,name) values ('archive-originals','private'),('archive-staging','pending')",
    );
    for (const [role, user] of [
      ["anon", ""],
      ["authenticated", owner],
      ["authenticated", other],
    ]) {
      expect(
        (await asRole(role, user, "select * from storage.objects")).rows,
      ).toHaveLength(0);
      await expect(
        asRole(
          role,
          user,
          "insert into storage.objects(bucket_id,name) values ('archive-staging','attack')",
        ),
      ).rejects.toThrow("row-level security");
      expect(
        (await asRole(role, user, "delete from storage.objects returning id"))
          .rows,
      ).toHaveLength(0);
    }
    const buckets = await db.query<{ public: boolean }>(
      "select public from storage.buckets",
    );
    expect(buckets.rows.every((b) => b.public === false)).toBe(true);
  });
  it("persists data and policies across a database restart", async () => {
    await db.close();
    db = new PGlite(directory);
    expect(
      (await db.query("select * from workspaces where id=$1", [workspace]))
        .rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from asset_revisions where asset_id=$1", [
          note,
        ])
      ).rows,
    ).toHaveLength(2);
    expect(
      (await asRole("authenticated", other, "select * from workspaces")).rows,
    ).toHaveLength(0);
  });
  it("blocks a revoked session even when its signed JWT has not expired", async () => {
    await db.query("delete from auth.sessions where id=$1", [owner]);
    try {
      expect((await asRole("authenticated", owner, "select id from workspaces")).rows).toEqual([]);
    } finally {
      await db.query("insert into auth.sessions values ($1,$1,null)", [owner]);
    }
  });
  it("denies expired or mismatched sessions without exposing auth tables", async () => {
    await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [owner]);
    expect((await asRole("authenticated", owner, "select id from workspaces")).rows).toEqual([]);
    await db.query("update auth.sessions set not_after=null,user_id=$2 where id=$1", [owner, other]);
    expect((await asRole("authenticated", owner, "select id from workspaces")).rows).toEqual([]);
    await db.query("update auth.sessions set user_id=$1 where id=$1", [owner]);
    await expect(asRole("authenticated", owner, "select * from auth.sessions")).rejects.toThrow("permission denied");
    await expect(asRole("anon", "", "select archive_private.session_is_active()" )).rejects.toThrow("permission denied");
  });
  it("allows re-upload after deletion without reviving an old asset or reusing its path", async () => {
    const fresh = await command({ action: "create_workspace", name: "Deletion re-upload", key: key() });
    const upload = () => command({ action: "create_upload", key: key(), workspace_id: fresh.id, metadata: { title: "Synthetic" }, size: 100, content_type: "image/png" });
    const finish = (id: unknown) => command({ action: "finalize_upload", key: key(), intent_id: id, sha256: "b".repeat(64), width: 5, height: 5 });
    const first = await upload(), saved = await finish(first.id);
    await command({ action: "delete_asset", key: key(), workspace_id: fresh.id, asset_id: saved.id, expected_revision: 1 });
    const second = await upload(), replacement = await finish(second.id);
    expect(replacement.id).not.toBe(saved.id);
    expect(second.final_key).not.toBe(first.final_key);
    expect((await db.query("select deletion_state from assets where id=$1", [saved.id])).rows).toEqual([{ deletion_state: "pending" }]);
  });
});
