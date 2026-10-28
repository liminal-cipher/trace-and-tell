-- M1a only. Apply to a remote project only after separate approval.
begin;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 100),
  demo_flag boolean not null default false check (demo_flag = false),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now()
);
create index workspaces_owner on public.workspaces(owner_user_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  kind text not null check (kind in ('photo', 'note')),
  active_revision integer not null default 1 check (active_revision > 0),
  deletion_state text not null default 'active' check (deletion_state in ('active','pending','deleted')),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index assets_workspace on public.assets(workspace_id);
create unique index assets_unique_bytes on public.assets(workspace_id, sha256) where deletion_state = 'active' and kind = 'photo';

create table public.asset_revisions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  revision integer not null check (revision > 0),
  title text not null check (length(btrim(title)) between 1 and 160),
  user_date text not null default '' check (length(user_date) <= 100),
  source_note text not null default '' check (length(source_note) <= 4000),
  content text check (length(content) between 1 and 20000),
  storage_key text,
  content_type text check (content_type in ('image/jpeg','image/png','image/webp')),
  size integer check (size between 1 and 6291456),
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now(),
  unique(asset_id, revision),
  check ((content is not null and storage_key is null and content_type is null and size is null)
      or (content is null and storage_key is not null and content_type is not null and size is not null and width is not null and height is not null))
);

create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  metadata jsonb not null,
  size integer not null check (size between 1 and 6291456),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  stage_key text not null unique,
  final_key text not null unique,
  state text not null default 'pending' check (state in ('pending','complete','rejected','expired')),
  asset_id uuid references public.assets(id),
  cleanup_state text not null default 'pending' check (cleanup_state in ('pending','done','failed')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  -- Signed upload capabilities last two hours; keep sweeping until they expire.
  capability_expires_at timestamptz not null default now() + interval '2 hours 5 minutes',
  created_at timestamptz not null default now()
);
create index intents_workspace on public.upload_intents(workspace_id);

create table public.command_receipts (
  owner_user_id uuid not null references auth.users(id),
  key uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_user_id, key)
);

alter table public.workspaces enable row level security;
alter table public.assets enable row level security;
alter table public.asset_revisions enable row level security;
alter table public.upload_intents enable row level security;
alter table public.command_receipts enable row level security;

revoke all on public.workspaces, public.assets, public.asset_revisions, public.upload_intents, public.command_receipts from public, anon, authenticated;
grant select on public.workspaces, public.assets to authenticated;
grant select (id,asset_id,revision,title,user_date,source_note,content,content_type,size,width,height,created_at) on public.asset_revisions to authenticated;
grant select (id,workspace_id,metadata,state,asset_id,cleanup_state,expires_at,created_at) on public.upload_intents to authenticated;
grant all on public.workspaces, public.assets, public.asset_revisions, public.upload_intents, public.command_receipts to service_role;

create policy workspace_owner_read on public.workspaces for select to authenticated
using (owner_user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy asset_owner_read on public.assets for select to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id));
create policy revision_owner_read on public.asset_revisions for select to authenticated
using (exists (select 1 from public.assets a where a.id = asset_id and a.deletion_state = 'active'));
create policy intent_owner_read on public.upload_intents for select to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id));

-- No client table writes: every mutation must append revisions and enforce CAS.
-- SECURITY INVOKER: this RPC is executable only by the server's service role.
-- actor is obtained from Auth getUser(), never from the request body.
create function public.archive_command(actor uuid, payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  op text := payload->>'action';
  k uuid := (payload->>'key')::uuid;
  wid uuid := (payload->>'workspace_id')::uuid;
  aid uuid := (payload->>'asset_id')::uuid;
  ident uuid;
  w public.workspaces;
  a public.assets;
  r public.asset_revisions;
  i public.upload_intents;
  receipt public.command_receipts;
  result jsonb;
  m jsonb := payload->'metadata';
begin
  if actor is null or k is null then raise exception 'invalid_input'; end if;
  -- Serialise one owner's commands, including request-key lookup and quota checks.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into receipt from public.command_receipts where owner_user_id = actor and key = k;
  if found then
    if receipt.request <> payload then raise exception 'idempotency_conflict'; end if;
    return receipt.result;
  end if;
  if op = 'create_workspace' then
    insert into public.workspaces(owner_user_id,name) values(actor,payload->>'name') returning * into w;
    result := to_jsonb(w);
  else
    if op in ('finalize_upload','reject_upload') then
      select * into i from public.upload_intents where id = (payload->>'intent_id')::uuid;
      wid := i.workspace_id;
    end if;
    select * into w from public.workspaces where id = wid and owner_user_id = actor for update;
    if not found then raise exception 'not_found'; end if;
    if op = 'rename_workspace' then
      if w.revision <> (payload->>'expected_revision')::integer then raise exception 'revision_conflict'; end if;
      update public.workspaces set name = payload->>'name', revision = revision + 1 where id = wid returning * into w;
      result := to_jsonb(w);
    elsif op = 'save_note' then
      insert into public.assets(workspace_id,kind) values(wid,'note') returning * into a;
      insert into public.asset_revisions(asset_id,revision,title,user_date,source_note,content)
      values(a.id,1,m->>'title',coalesce(m->>'user_date',''),coalesce(m->>'source_note',''),payload->>'content');
      result := to_jsonb(a);
    elsif op = 'create_upload' then
      update public.upload_intents set state = 'expired' where workspace_id = wid and state = 'pending' and expires_at <= now();
      if (select count(*) from public.assets where workspace_id = wid and kind = 'photo' and deletion_state = 'active')
        + (select count(*) from public.upload_intents where workspace_id = wid and state = 'pending') >= 20 then raise exception 'photo_limit'; end if;
      if length(btrim(m->>'title')) not between 1 and 160 or length(coalesce(m->>'source_note','')) > 4000 or length(coalesce(m->>'user_date','')) > 100 then raise exception 'invalid_input'; end if;
      ident := gen_random_uuid();
      insert into public.upload_intents(id,workspace_id,metadata,size,content_type,stage_key,final_key)
      values(ident,wid,m,(payload->>'size')::integer,payload->>'content_type',actor::text || '/' || ident::text,actor::text || '/' || wid::text || '/' || ident::text) returning * into i;
      result := to_jsonb(i);
    elsif op = 'finalize_upload' then
      if i.state = 'complete' then
        select * into a from public.assets where id = i.asset_id and deletion_state = 'active';
        if not found then raise exception 'not_found'; end if;
        result := jsonb_build_object('id',a.id,'duplicate',false);
      else
        if i.state = 'rejected' then raise exception 'intent_rejected'; end if;
        if i.state <> 'pending' or i.expires_at <= now() then raise exception 'intent_expired'; end if;
        select * into a from public.assets where workspace_id = wid and sha256 = payload->>'sha256' and deletion_state = 'active';
        if found then
          result := jsonb_build_object('id',a.id,'duplicate',true);
        else
          insert into public.assets(workspace_id,kind,sha256) values(wid,'photo',payload->>'sha256') returning * into a;
          insert into public.asset_revisions(asset_id,revision,title,user_date,source_note,storage_key,content_type,size,width,height)
          values(a.id,1,i.metadata->>'title',coalesce(i.metadata->>'user_date',''),coalesce(i.metadata->>'source_note',''),i.final_key,i.content_type,i.size,(payload->>'width')::integer,(payload->>'height')::integer);
          result := jsonb_build_object('id',a.id,'duplicate',false);
        end if;
        update public.upload_intents set state = 'complete', asset_id = a.id where id = i.id;
      end if;
    elsif op = 'reject_upload' then
      update public.upload_intents set state = 'rejected' where id = i.id and state = 'pending';
      result := jsonb_build_object('ok',true);
    elsif op in ('revise_asset','delete_asset') then
      select * into a from public.assets where id = aid and workspace_id = wid for update;
      if not found or a.deletion_state <> 'active' then raise exception 'not_found'; end if;
      if a.active_revision <> (payload->>'expected_revision')::integer then raise exception 'revision_conflict'; end if;
      if op = 'delete_asset' then
        update public.assets set deletion_state = 'pending' where id = aid;
        result := jsonb_build_object('id',aid,'deletion_state','pending');
      else
        select * into r from public.asset_revisions where asset_id = aid and revision = a.active_revision;
        insert into public.asset_revisions(asset_id,revision,title,user_date,source_note,content,storage_key,content_type,size,width,height)
        values(aid,a.active_revision+1,m->>'title',coalesce(m->>'user_date',''),coalesce(m->>'source_note',''),
          case when a.kind = 'note' then coalesce(payload->>'content',r.content) else null end,r.storage_key,r.content_type,r.size,r.width,r.height);
        update public.assets set active_revision = active_revision + 1 where id = aid returning * into a;
        result := to_jsonb(a);
      end if;
    else raise exception 'invalid_input';
    end if;
  end if;
  insert into public.command_receipts(owner_user_id,key,request,result) values(actor,k,payload,result);
  return result;
end;
$$;
revoke all on function public.archive_command(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.archive_command(uuid,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('archive-staging','archive-staging',false,6291456,array['image/jpeg','image/png','image/webp']),
       ('archive-originals','archive-originals',false,6291456,array['image/jpeg','image/png','image/webp']);

-- Restrictive policies also prevent unrelated permissive policies from opening
-- either archive bucket. Only narrowly scoped signed uploads reach staging;
-- originals are streamed by the authorised server, never signed for downloads.
create policy archive_no_client_select on storage.objects as restrictive for select to anon, authenticated
using (bucket_id not in ('archive-staging','archive-originals'));
create policy archive_no_client_insert on storage.objects as restrictive for insert to anon, authenticated
with check (bucket_id not in ('archive-staging','archive-originals'));
create policy archive_no_client_update on storage.objects as restrictive for update to anon, authenticated
using (bucket_id not in ('archive-staging','archive-originals')) with check (bucket_id not in ('archive-staging','archive-originals'));
create policy archive_no_client_delete on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id not in ('archive-staging','archive-originals'));

commit;
