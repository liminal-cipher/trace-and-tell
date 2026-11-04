import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import type { Asset, Revision } from "../../src/lib/contracts";
import { emptyDocument, type InvestigationCommand, type InvestigationDocument, type RunResult } from "../../src/lib/investigation-contracts";
import { applyReview, importAnalysis, modelInput, reconcile } from "../../src/lib/investigation-domain";
import { fixtureAnalysis } from "../../src/lib/model-fixture";
export const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
export async function investigationDb(directory?: string) {
    const db = new PGlite(directory);
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
    insert into auth.users values('${owner}'),('${other}');
    insert into auth.sessions values('${owner}','${owner}',null),('${other}','${other}',null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;`);
    for (const name of readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort())
        await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    const rpc = async (payload: object, actor = owner, method = "investigation_command") => (await db.query<{
        result: Record<string, unknown>;
    }>(`select public.${method}($1::uuid,$2::jsonb) as result`, [actor, JSON.stringify(payload)])).rows[0].result;
    const workspace = (await rpc({ action: "create_workspace", key: crypto.randomUUID(), name: "Synthetic research collection" }, owner, "archive_command")).id as string;
    for (const [title, content] of [["Record A", "ORBIT 47 — a blue ticket."], ["Record B", "ORBIT 47 — a note about a ticket."], ["Record C", "A green garden bench, unrelated."]])
        await rpc({ action: "save_note", key: crypto.randomUUID(), workspace_id: workspace, metadata: { title, user_date: "", source_note: "Synthetic test record" }, content }, owner, "archive_command");
    return fixtureRepository(db, workspace);
}
export function fixtureRepository(db: PGlite, workspace: string) {
    const rpc = async (payload: object, actor = owner) => (await db.query<{
        result: Record<string, unknown>;
    }>("select public.investigation_command($1::uuid,$2::jsonb) as result", [actor, JSON.stringify(payload)])).rows[0].result;
    const snapshot = async () => {
        const assets = (await db.query<Asset>("select * from assets where workspace_id=$1 order by created_at,id", [workspace])).rows;
        const revisions = (await db.query<Revision>("select r.* from asset_revisions r join assets a on a.id=r.asset_id where a.workspace_id=$1 and a.deletion_state='active' order by r.revision desc", [workspace])).rows;
        const evidence = { workspace_id: workspace, assets, revisions };
        const stored = (await db.query<{
            revision: number;
            document: InvestigationDocument;
        }>("select * from investigations where workspace_id=$1", [workspace])).rows[0];
        const document = reconcile(stored?.document ?? emptyDocument(), evidence);
        return { workspace_id: workspace, revision: stored?.revision ?? 0, document, runs: (await db.query<{
                id: string;
                mode: "fixture";
                model: string;
                status: string;
                created_at: string;
                error: null;
            }>("select * from investigation_runs where workspace_id=$1 order by created_at,id", [workspace])).rows, archive: { assets, revisions, workspaces: [{ id: workspace, name: "Synthetic research collection" }] } };
    };
    const execute = async (command: InvestigationCommand) => {
        const snap = await snapshot();
        const evidence = { workspace_id: workspace, assets: snap.archive.assets, revisions: snap.archive.revisions };
        let document: InvestigationDocument;
        if (command.action === "analyse") {
            if (command.mode !== "fixture")
                throw new Error("This browser fixture cannot make model calls.");
            const input = modelInput(command.operation, command.sources, snap.document, evidence, command);
            const begun = await rpc({ ...command, op: "begin_run", request: command, sources: command.sources, model: "authored-fixture-v1" });
            if (begun.existing)
                throw new Error("Analysis already started");
            const output = fixtureAnalysis(input);
            const run: RunResult = { id: begun.id as string, mode: "fixture", model: "authored-fixture-v1", input, output, raw: output, prompt_version: "archive-evidence-v1", schema_version: "analysis-v1", latency_ms: 0, usage: null, cost_usd: null };
            document = importAnalysis(snap.document, run, evidence);
            await rpc({ ...command, op: "save", request: command, sources: command.sources, document, run_id: run.id, record: run });
        }
        else {
            document = applyReview(snap.document, command, owner, evidence);
            const changed = document.entries.filter((e) => !snap.document.entries.some((p) => p.id === e.id && p.revision === e.revision));
            await rpc({ ...command, op: "save", request: command, document, sources: [...new Map(changed.flatMap((e) => e.sources).map((s) => [s.asset_id, s])).values()] });
        }
        return snapshot();
    };
    return { db, workspace, rpc, snapshot, execute };
}
