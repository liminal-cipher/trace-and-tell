-- M1b/M2 only. Separate approval is required before remote application.
begin;
create table public.investigations (
  workspace_id uuid primary key references public.workspaces(id),
  revision integer not null check (revision > 0),
  document jsonb not null check (jsonb_typeof(document->'entries') = 'array'),
  updated_at timestamptz not null default now()
);
create table public.investigation_versions (
  workspace_id uuid not null references public.workspaces(id),
  revision integer not null, document jsonb not null,
  recorder uuid not null references auth.users(id), created_at timestamptz not null default now(),
  primary key(workspace_id,revision)
);
create table public.investigation_runs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  owner_user_id uuid not null references auth.users(id), key uuid not null, request jsonb not null,
  mode text not null check(mode in ('fixture','replay','meta-live')), model text not null,
  status text not null default 'running' check(status in ('running','succeeded','failed')),
  record jsonb, error text, created_at timestamptz not null default now(),
  unique(owner_user_id,key)
);
create index investigation_runs_workspace on public.investigation_runs(workspace_id,created_at,id);
alter table public.investigations enable row level security;
alter table public.investigation_versions enable row level security;
alter table public.investigation_runs enable row level security;
revoke all on public.investigations,public.investigation_versions,public.investigation_runs from public,anon,authenticated;
grant select on public.investigations,public.investigation_versions,public.investigation_runs to authenticated;
grant all on public.investigations,public.investigation_versions,public.investigation_runs to service_role;
create policy investigation_owner_read on public.investigations for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id = workspace_id));
create policy investigation_version_owner_read on public.investigation_versions for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id = workspace_id));
create policy investigation_run_owner_read on public.investigation_runs for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id = workspace_id));

-- All mutations are server-only. The actor is supplied by online Auth, never
-- by a browser field. Lock order matches archive_command, including deletion.
create function public.investigation_command(actor uuid, payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  w uuid := (payload->>'workspace_id')::uuid;
  k uuid := (payload->>'key')::uuid;
  op text := payload->>'op';
  current_revision integer;
  s jsonb;
  prior public.command_receipts;
  run public.investigation_runs;
  result jsonb;
begin
  if actor is null or k is null then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  perform 1 from public.workspaces where id=w and owner_user_id=actor and not demo_flag for update;
  if not found then raise exception 'not_found'; end if;
  if op='fail_run' then
    update public.investigation_runs set status='failed',error='Analysis failed or its evidence changed.',record=payload->'record'
      where id=(payload->>'run_id')::uuid and workspace_id=w and owner_user_id=actor and status='running';
    return '{"failed":true}'::jsonb;
  end if;
  select * into prior from public.command_receipts where owner_user_id=actor and key=k;
  if found then
    if prior.request <> payload->'request' then raise exception 'idempotency_conflict'; end if;
    return prior.result;
  end if;
  if op='begin_run' then
    select * into run from public.investigation_runs where owner_user_id=actor and key=k;
    if found then
      if run.request <> payload->'request' or run.workspace_id <> w then raise exception 'idempotency_conflict'; end if;
      return to_jsonb(run) || '{"existing":true}'::jsonb;
    end if;
  end if;
  select revision into current_revision from public.investigations where workspace_id=w;
  if coalesce(current_revision,0) <> (payload->>'expected_revision')::integer then raise exception 'revision_conflict'; end if;
  if jsonb_typeof(payload->'sources') <> 'array' then raise exception 'invalid_input'; end if;
  for s in select value from jsonb_array_elements(payload->'sources') loop
    perform 1 from public.assets a join public.asset_revisions r on r.asset_id=a.id and r.revision=a.active_revision
      where a.id=(s->>'asset_id')::uuid and a.workspace_id=w and a.deletion_state='active' and a.active_revision=(s->>'revision')::integer;
    if not found then raise exception 'revision_conflict'; end if;
  end loop;
  if op='begin_run' then
    insert into public.investigation_runs(workspace_id,owner_user_id,key,request,mode,model,record)
      values(w,actor,k,payload->'request',payload->>'mode',payload->>'model',payload->'record') returning * into run;
    return to_jsonb(run) || '{"existing":false}'::jsonb;
  elsif op='save' then
    if octet_length((payload->'document')::text)>1048576
       or jsonb_array_length(payload->'document'->'entries')>200
       or jsonb_typeof(payload->'document'->'analysed') <> 'array' then raise exception 'invalid_input'; end if;
    if payload ? 'run_id' then
      select * into run from public.investigation_runs where id=(payload->>'run_id')::uuid and workspace_id=w and owner_user_id=actor for update;
      if not found or run.status <> 'running' or run.key <> k or run.request <> payload->'request' then raise exception 'invalid_input'; end if;
    end if;
    current_revision := coalesce(current_revision,0)+1;
    insert into public.investigations(workspace_id,revision,document) values(w,current_revision,payload->'document')
      on conflict(workspace_id) do update set revision=excluded.revision,document=excluded.document,updated_at=now();
    insert into public.investigation_versions(workspace_id,revision,document,recorder) values(w,current_revision,payload->'document',actor);
    if payload ? 'run_id' then
      update public.investigation_runs set status='succeeded',record=payload->'record',model=coalesce(payload->'record'->>'model',model) where id=run.id;
    end if;
    result := jsonb_build_object('revision',current_revision);
    insert into public.command_receipts(owner_user_id,key,request,result) values(actor,k,payload->'request',result);
    return result;
  else raise exception 'invalid_input'; end if;
end;
$$;
revoke all on function public.investigation_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.investigation_command(uuid,jsonb) to service_role;
commit;
