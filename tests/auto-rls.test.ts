import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("removes unnecessary EXECUTE while preserving auto-RLS event dispatch (PGlite)", async () => {
  const db = new PGlite();
  try {
    // Local reproduction of the inspected platform function, not a remote call.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
      create table public.workspaces(owner_user_id uuid);
      create policy workspace_owner_read on public.workspaces for select to authenticated using (true);
      create function public.rls_auto_enable() returns event_trigger
      language plpgsql security definer set search_path to 'pg_catalog' as $$
      declare cmd record; tbl name;
      begin
        for cmd in select * from pg_event_trigger_ddl_commands()
          where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
          and object_type in ('table','partitioned table')
        loop
          if cmd.schema_name is not null and cmd.schema_name in ('public')
            and cmd.schema_name not in ('pg_catalog','information_schema')
            and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
            begin
              select c.relname into tbl from pg_catalog.pg_class c where c.oid=cmd.objid;
              execute format('alter table if exists %I.%I enable row level security',cmd.schema_name,tbl);
            exception when others then raise log 'auto-RLS failed'; end;
          end if;
        end loop;
      end; $$;
      create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable();
    `);
    const definition = async () => (await db.query("select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) as body")).rows;
    const before = await definition();
    await expect(db.exec("select public.rls_auto_enable()")).rejects.toThrow("trigger functions can only be called as triggers");
    expect((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as allowed")).rows).toEqual([{ allowed: true }]);
    await db.exec(readFileSync("supabase/migrations/20261029150829_m1a_security_hardening.sql", "utf8"));
    expect(await definition()).toEqual(before);
    expect((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon,has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated")).rows).toEqual([{ anon: false, authenticated: false }]);
    await db.exec("grant create on schema public to authenticated; set role authenticated");
    await expect(db.exec("select public.rls_auto_enable()")).rejects.toThrow("permission denied");
    await db.exec("create table public.plain_table(id int); create table public.as_table as select 1 as id; select 1 as id into public.into_table; reset role");
    const tables = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('plain_table','as_table','into_table')");
    expect(tables.rows).toHaveLength(3);
    expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);
  } finally { await db.close(); }
});
