import "server-only";
import { prepareModelImage, ImagePreparationError } from "./model-image";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listArchive } from "./archive";
import { storageAdmin } from "./supabase";
import { allRows } from "./pagination";
import { AppError, databaseError } from "./errors";
import { emptyDocument, analysisIdentity, withoutImages, type InvestigationCommand, type InvestigationDocument, type RunResult } from "./investigation-contracts";
import { applyReview, importAnalysis, modelInput, reconcile, type EvidenceContext } from "./investigation-domain";
import { generateAnalysis, ProviderFailure, PROMPT_VERSION, SCHEMA_VERSION } from "./model-provider";
async function context(client: SupabaseClient, workspace: string) {
    const archive = await listArchive(client, workspace);
    return { archive, evidence: { workspace_id: workspace, assets: archive.assets, revisions: archive.revisions } as EvidenceContext };
}
export async function readInvestigation(client: SupabaseClient, workspace: string) {
    const { archive, evidence } = await context(client, workspace);
    const [saved, runs] = await Promise.all([
        client.from("investigations").select("revision,document").eq("workspace_id", workspace).maybeSingle(),
        allRows((from, to) => client.from("investigation_runs").select("id,mode,model,status,created_at,error").eq("workspace_id", workspace).order("created_at").order("id").range(from, to)),
    ]);
    databaseError(saved.error);
    const document = reconcile((saved.data?.document ?? emptyDocument()) as InvestigationDocument, evidence);
    const visibleRuns = runs.map((run) => run.status === "running" && Date.now() - Date.parse(run.created_at) > 120000
        ? { ...run, status: "unknown_outcome", error: "No confirmed result. Inspect the allowance and saved run before starting another request." } : run);
    return { workspace_id: workspace, revision: saved.data?.revision ?? 0, document, runs: visibleRuns, archive };
}
export async function readInvestigationEntry(client: SupabaseClient, workspace: string, id: string, revision: number) {
    const current = await readInvestigation(client, workspace);
    const latest = current.document.entries.find((entry) => entry.id === id);
    if (!latest) throw new AppError(404, "This evidence record is unavailable.");
    if (latest.evidence_validity === "invalidated") return { entry: null, validity: "invalidated", historical: true };
    const saved = await client.from("investigation_versions").select("document").eq("workspace_id", workspace)
      .contains("document", { entries: [{ id, revision }] }).order("revision", { ascending: false }).limit(1).maybeSingle();
    databaseError(saved.error);
    const entry = (saved.data?.document as InvestigationDocument | undefined)?.entries.find((e) => e.id === id && e.revision === revision);
    if (!entry) throw new AppError(404, "This evidence revision is unavailable.");
    return { entry, validity: latest.evidence_validity, historical: latest.revision !== revision };
}
const rpc = async (actor: string, payload: object) => {
    const response = await storageAdmin().rpc("investigation_command", { actor, payload });
    databaseError(response.error);
    return response.data;
};
// Keep raw model results and revision references, not input image copies, in SQL.
export function storedRun(run: RunResult) {
    return { ...run, input: withoutImages(run.input), image_hashes: run.input.sources.filter((s) => s.image).map((s) => ({ asset_id: s.asset_id, sha256: createHash("sha256").update(Buffer.from(s.image!.split(",")[1], "base64")).digest("hex") })) };
}
export async function executeInvestigation(client: SupabaseClient, actor: string, command: InvestigationCommand) {
    const snapshot = await readInvestigation(client, command.workspace_id);
    // Receipts are private. Ownership was checked through the caller's RLS first.
    const receipt = await storageAdmin().from("command_receipts").select("request,result").eq("owner_user_id", actor).eq("key", command.key).maybeSingle();
    databaseError(receipt.error);
    if (receipt.data) {
        // Compare canonical JSON in PostgreSQL, not property order in JavaScript.
        await rpc(actor, { ...command, op: "save", request: command });
        return readInvestigation(client, command.workspace_id);
    }
    if (snapshot.revision !== command.expected_revision)
        throw new AppError(409, "The investigation changed. Reload before saving.");
    const evidence: EvidenceContext = { workspace_id: command.workspace_id, assets: snapshot.archive.assets, revisions: snapshot.archive.revisions };
    let document: InvestigationDocument, run: RunResult | undefined;
    if (command.action === "analyse") {
        const input = modelInput(command.operation, command.sources, snapshot.document, evidence);
        if (snapshot.document.analysed.includes(analysisIdentity(input)))
            throw new AppError(409, "These source revisions already have saved suggestions. Review them instead.");
        const imagePreparations: { asset_id: string; revision: number; evidence: Awaited<ReturnType<typeof prepareModelImage>>["evidence"] }[] = [];
        const runMetadata = { image_preparations: imagePreparations, mode: command.mode, input: withoutImages(input), prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION };
        const begun = await rpc(actor, { ...command, op: "begin_run", request: command, sources: command.sources, mode: command.mode, record: runMetadata,
            model: command.mode === "fixture" ? "authored-fixture-v1" : command.mode === "replay" ? "recorded-response" : "muse-spark-1.3" });
        if (begun.existing)
            throw new AppError(409, "This analysis was already started. Inspect its saved status; an unknown outcome is never retried automatically.");
        try {
            if (command.mode === "meta-live")
                for (const source of input.sources)
                    if (source.content === null) {
                        // The source ID/revision came from RLS-visible records, never a client path.
                        const original = await storageAdmin().from("asset_revisions").select("storage_key").eq("asset_id", source.asset_id).eq("revision", source.revision).single();
                        databaseError(original.error);
                        const bytes = await storageAdmin().storage.from("archive-originals").download(original.data!.storage_key);
                        if (bytes.error || !bytes.data)
                            throw new AppError(503, "The original could not be read.");
                        const prepared = await prepareModelImage(Buffer.from(await bytes.data.arrayBuffer()));
                        source.image = prepared.data_url;
                        imagePreparations.push({asset_id:source.asset_id,revision:source.revision,evidence:prepared.evidence});
                    }
            let replay: RunResult | undefined;
            if (command.mode === "replay") {
                if (!command.replay_id)
                    throw new AppError(400, "Choose a saved live run for replay.");
                const result = await client.from("investigation_runs").select("record").eq("id", command.replay_id).eq("workspace_id", command.workspace_id).eq("status", "succeeded").eq("mode", "meta-live").maybeSingle();
                databaseError(result.error);
                replay = result.data?.record;
            }
            run = await generateAnalysis(input, command.mode, { id: begun.id, replay });
            // Refresh Auth and source state after external work. SQL repeats source
            // and document checks under the same lock as Archive writes/deletion.
            const auth = await client.auth.getUser();
            if (auth.error || auth.data.user?.id !== actor)
                throw new AppError(401, "Sign in again before saving.");
            const fresh = await context(client, command.workspace_id);
            document = importAnalysis(snapshot.document, run, fresh.evidence);
            await rpc(actor, { ...command, op: "save", request: command, sources: command.sources, document, run_id: run.id, record: { ...storedRun(run), image_preparations: imagePreparations } });
        }
        catch (error) {
            await rpc(actor, { ...command, op: "fail_run", run_id: begun.id,
                record: run ? storedRun(run) : { ...runMetadata, ...(error instanceof ProviderFailure ? error.record : { validation: "failed", cost_usd: null, ...(error instanceof ImagePreparationError ? { failure_stage: "image_preparation", failure_category: error.category, model_request_sent: false } : {}) }) } });
            throw error;
        }
    }
    else {
        document = applyReview(snapshot.document, command, actor, evidence);
        const changed = document.entries.filter((entry) => !snapshot.document.entries.some((old) => old.id === entry.id && old.revision === entry.revision));
        const sources = [...new Map(changed.flatMap((entry) => entry.sources).map((s) => [s.asset_id, s])).values()];
        await rpc(actor, { ...command, op: "save", request: command, sources, document });
    }
    return readInvestigation(client, command.workspace_id);
}
