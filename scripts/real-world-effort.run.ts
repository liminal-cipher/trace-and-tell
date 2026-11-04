import { test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EFFORT_ROOT, verifyEffortProposal, type EffortProposal } from "./real-world/effort";
import { BatchJournal, durableJson, verifyAllowanceLedger } from "./real-world/batch-journal";
import { hash, type RecordedCase } from "./real-world/core";
import { generateAnalysis, ProviderFailure, metaRequest } from "../src/lib/model-provider";
import { inferenceIdentity, META_ENDPOINT } from "../src/lib/model-settings";

const approvalSchema = z.object({
    proposal_sha256: z.string().regex(/^[a-f0-9]{64}$/), user_instruction: z.string().min(20),
    approved_at: z.iso.datetime(), expires_at: z.literal("2026-11-05T00:00:00Z"),
    catalogue_verified_at: z.iso.datetime(), pricing_verified_at: z.iso.datetime(),
    model: z.literal("muse-spark-1.3"), mode: z.literal("Standard"), max_requests: z.literal(20), max_usd: z.literal(27),
    profiles: z.tuple([z.literal("medium"), z.literal("high")]), max_completion_tokens: z.literal(8192), timeout_ms: z.literal(180000), retries: z.literal(0),
    input_usd_per_million: z.literal(1.25), output_usd_per_million: z.literal(4.25),
}).strict();

test("executes only the separately approved twenty-request medium/high comparison", async () => {
    process.env.META_LIVE_APPROVED = "no"; process.env.META_APPROVAL_FILE = "";
    if (process.env.EFFORT_EXECUTE !== "yes") throw new Error("Explicit execution switch required");
    const proposalPath = join(EFFORT_ROOT, "proposal.json"), proposalBytes = readFileSync(proposalPath);
    const proposal = JSON.parse(proposalBytes.toString()) as EffortProposal;
    const authPath = join(EFFORT_ROOT, "authorization.json"), authBytes = readFileSync(authPath);
    const auth = approvalSchema.parse(JSON.parse(authBytes.toString()));
    if (auth.proposal_sha256 !== hash(proposalBytes) || auth.expires_at !== proposal.expires_at) throw new Error("Approval does not match the fixed proposal");
    const rightsPath = join(EFFORT_ROOT, "rights-confirmed.json"), rightsBytes = readFileSync(rightsPath);
    const rights = JSON.parse(rightsBytes.toString());
    const current = () => {
        const now = Date.now();
        if (Date.parse(auth.approved_at) > now || Date.parse(auth.expires_at) <= now || [auth.catalogue_verified_at, auth.pricing_verified_at, rights.checked_at].some(d => !Number.isFinite(Date.parse(d)) || Date.parse(d) > now || now - Date.parse(d) > 86400000)) throw new Error("Approval or public verification is not current");
        if (rights.status !== "confirmed" || rights.selected_photos !== 9 || rights.proposal_sha256 !== auth.proposal_sha256) throw new Error("Current scoped rights confirmation required");
        if (hash(readFileSync(authPath)) !== hash(authBytes) || hash(readFileSync(proposalPath)) !== auth.proposal_sha256 || hash(readFileSync(rightsPath)) !== hash(rightsBytes)) throw new Error("Execution authority changed");
    };
    current();
    await verifyEffortProposal(proposal);
    const execution = resolve(EFFORT_ROOT, "execution");
    const journal = BatchJournal.create(execution, { policy: "effort-comparison", proposal_sha256: auth.proposal_sha256, authorization_sha256: hash(authBytes), approved_at: auth.approved_at, expires_at: auth.expires_at, cases: proposal.requests.map(r => ({ id: r.experiment_id, input_sha256: r.input_sha256, request_sha256: r.request_sha256 })) });
    const allowances: { path: string; sha256: string }[] = [];
    const completed: { input_hash: string; execution_sha256: string; cost_usd: number }[][] = Array.from({ length: 7 }, () => []);
    const outcomes: Record<string, unknown>[] = [], records: { medium: RecordedCase[]; high: RecordedCase[] } = { medium: [], high: [] };
    let stopped = false;
    const checkLedgers = () => {
        for (let g = 0; g < allowances.length; g++) {
            if (hash(readFileSync(allowances[g].path)) !== allowances[g].sha256) throw new Error("Allowance configuration changed");
            verifyAllowanceLedger(allowances[g].path, completed[g], 1.35);
        }
    };
    try {
        durableJson(join(execution, "runtime.json"), { code_files: proposal.code_files, reference_files: proposal.references, rights_sha256: hash(rightsBytes), approved_settings: auth, billing_verified: false });
        for (const group of proposal.allowances) {
            const requests = proposal.requests.filter(r => group.experiment_ids.includes(r.experiment_id));
            if (requests.length !== group.max_requests || group.max_requests > 3 || group.max_usd !== group.max_requests * 135 / 100) throw new Error("Allowance grouping changed");
            const path = join(execution, `approval-${group.group}.json`);
            durableJson(path, { id: randomUUID(), model: auth.model, approved_at: auth.approved_at, expires_at: auth.expires_at, catalogue_verified_at: auth.catalogue_verified_at, pricing_verified_at: auth.pricing_verified_at, max_requests: group.max_requests, max_usd: group.max_usd, input_usd_per_million: 1.25, output_usd_per_million: 4.25,
                allowed_input_sha256: [...new Set(requests.map(r => r.input_sha256))], request_bindings: requests.map(({ input_sha256, request_sha256, execution_sha256, profile }) => ({ input_sha256, request_sha256, execution_sha256, profile })) });
            allowances.push({ path, sha256: hash(readFileSync(path)) });
        }
        if (allowances.length !== 7) throw new Error("Incomplete allowance groups");
        if (existsSync(".env.local")) process.loadEnvFile(".env.local");
        if (!process.env.MODEL_API_KEY) throw new Error("Model key unavailable");
        for (let i = 0; i < proposal.requests.length; i++) {
            const r = proposal.requests[i], group = Math.floor(i / 3), started = Date.now(); let dispatched = false, httpStatus: number | null = null;
            try {
                current(); const refreshed = await verifyEffortProposal(proposal); checkLedgers();
                const c = refreshed.selected.find(c => c.id === r.case_id)!;
                const actualIdentity = inferenceIdentity(metaRequest(c.input, auth.model, r.profile), r.profile);
                if (actualIdentity.execution_sha256 !== r.execution_sha256) throw new Error("Execution hash changed");
                journal.begin(r.experiment_id, r.input_sha256, r.request_sha256);
                process.env.META_APPROVAL_FILE = allowances[group].path; process.env.META_LIVE_APPROVED = "yes";
                const run = await generateAnalysis(c.input, "meta-live", { profile: r.profile, fetcher: async (url, options) => {
                    current();
                    // The guard has now reserved this call; its settlement is checked after the response.
                    if (url !== META_ENDPOINT || options?.method !== "POST") throw new Error("Unexpected request");
                    journal.dispatch(r.experiment_id, String(options.body)); dispatched = true;
                    const response = await fetch(url, options); httpStatus = response.status; journal.response(r.experiment_id, response.status); return response;
                } });
                process.env.META_LIVE_APPROVED = "no";
                if (run.cost_usd === null || !run.usage || run.inference?.execution_sha256 !== r.execution_sha256) throw new Error("Unknown usage, cost or settings");
                completed[group].push({ input_hash: r.input_sha256, execution_sha256: r.execution_sha256, cost_usd: run.cost_usd }); checkLedgers();
                const path = join(execution, `${String(i + 1).padStart(2, "0")}-${r.experiment_id}.result.json`);
                durableJson(path, { ...r, model: run.model, mode: "meta-live", standard: true, dispatched, http_status: httpStatus, latency_ms: run.latency_ms, elapsed_ms: Date.now() - started, usage: run.usage, calculated_cost_usd: run.cost_usd, raw: run.raw, output: run.output, inference: run.inference, schema_validation: "PASS", human_review: "PENDING", billing_verified: false });
                journal.succeed(r.experiment_id, run.cost_usd, hash(readFileSync(path)));
                records[r.profile].push({ case_id: r.case_id, input_sha256: r.input_sha256, mode: "meta-live", transport: "success", output: run.output });
                outcomes.push({ experiment_id: r.experiment_id, status: "success", dispatched, usage: run.usage, calculated_cost_usd: run.cost_usd });
                console.log(JSON.stringify({ experiment_id: r.experiment_id, status: "success", attempts: i + 1 }));
            } catch (error) {
                process.env.META_LIVE_APPROVED = "no"; stopped = true;
                const failure = error instanceof ProviderFailure ? error.record : null, reason = error instanceof Error ? error.message : "Batch failed";
                durableJson(join(execution, `${String(i + 1).padStart(2, "0")}-${r.experiment_id}.failure.json`), { ...r, dispatched, http_status: httpStatus, elapsed_ms: Date.now() - started, provider_failure: failure, reason, human_review: "PENDING" });
                journal.stop(r.experiment_id, reason);
                let output: unknown; const raw = failure?.raw as { choices?: { message?: { content?: string } }[] } | null;
                try { output = JSON.parse(raw?.choices?.[0]?.message?.content ?? "null"); } catch { output = raw?.choices?.[0]?.message?.content; }
                if (dispatched) records[r.profile].push({ case_id: r.case_id, input_sha256: r.input_sha256, mode: "meta-live", transport: httpStatus !== null && httpStatus >= 200 && httpStatus < 300 && raw ? "success" : httpStatus === null ? "unknown" : "failure", ...(output !== undefined ? { output } : {}) });
                outcomes.push({ experiment_id: r.experiment_id, status: "failed", dispatched, reason, usage: failure?.usage ?? null, calculated_cost_usd: failure?.cost_usd ?? null }); break;
            }
        }
    } catch (error) { stopped = true; journal.stop("batch-setup", error instanceof Error ? error.message : "Setup failed"); throw error; }
    finally {
        process.env.META_LIVE_APPROVED = "no"; process.env.META_APPROVAL_FILE = ""; process.env.MODEL_API_KEY = "";
        durableJson(join(execution, "medium-records.json"), records.medium); durableJson(join(execution, "high-records.json"), records.high);
        durableJson(join(execution, "summary.json"), { stopped, live_disabled: true, planned: 20, dispatched: outcomes.filter(o => o.dispatched).length, succeeded: outcomes.filter(o => o.status === "success").length, failed: outcomes.filter(o => o.status === "failed" && o.dispatched).length, not_dispatched: 20 - outcomes.filter(o => o.dispatched).length, outcomes, human_reviewed: 0, billing_verified: false });
        journal.close();
    }
}, 4500000);
