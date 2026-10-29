-- Prepared locally. Remote application requires separate approval.
begin;

-- JWT expiry alone does not revoke direct Data API reads after logout.
-- This non-exposed helper can inspect only the caller's current session.
create schema archive_private;
revoke all on schema archive_private from public, anon, authenticated;
grant usage on schema archive_private to authenticated;
create function archive_private.session_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif((select auth.jwt()->>'session_id'),'')::uuid
      and s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function archive_private.session_is_active() from public, anon, authenticated, service_role;
grant execute on function archive_private.session_is_active() to authenticated;
alter policy workspace_owner_read on public.workspaces
using (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false'
  and (select archive_private.session_is_active())
);

-- Preserve the platform function, owner, body and ensure_rls binding. A local
-- stack need not have this optional platform event trigger. Unexpected shapes
-- fail closed rather than changing an unrelated function with the same name.
do $$
declare target oid := to_regprocedure('public.rls_auto_enable()');
begin
  if target is not null then
    if not exists (select 1 from pg_proc where oid = target and prosecdef
                   and prorettype = 'event_trigger'::regtype)
       or not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls'
                      and evtfoid = target and evtenabled = 'O'
                      and evtevent = 'ddl_command_end') then
      raise exception 'Unexpected auto-RLS configuration; review before applying';
    end if;
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

commit;
