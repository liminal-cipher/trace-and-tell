import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hash, parseManifest, prepareCases } from "./core";
import { initialBatch } from "./batch";
import { metaRequest } from "../../src/lib/model-provider";
import { inferenceIdentity, reservationUsd } from "../../src/lib/model-settings";
import { APPROVED_HEAD, PACKET, PROPOSAL_SHA } from "./live-preflight";
import { execFileSync } from "node:child_process";

export const EFFORT_ROOT = ".local/effort-comparison-2026-11-04";
export const CODE_FILES = ["src/lib/model-provider.ts", "src/lib/model-settings.ts", "src/lib/model-budget.ts", "src/lib/model-image.ts", "src/lib/investigation-contracts.ts", "src/lib/investigation-domain.ts", "scripts/real-world/core.ts", "scripts/real-world/batch.ts", "scripts/real-world/batch-journal.ts", "scripts/real-world/effort.ts", "scripts/real-world-effort.run.ts", "package-lock.json"];
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
export async function prepareEffortComparison() {
    if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== APPROVED_HEAD) throw new Error("Git baseline changed");
    if (hash(readFileSync(join(PACKET, "batch-proposal.json"))) !== PROPOSAL_SHA) throw new Error("Original proposal changed");
    const manifest = parseManifest(read(join(PACKET, "manifest.json"))), rights = read(join(PACKET, "rights-review.json"));
    if (JSON.stringify(manifest) !== JSON.stringify(parseManifest(read("tests/fixtures/real-world/manifest.json"))) || JSON.stringify(rights) !== JSON.stringify(read("tests/fixtures/real-world/rights-review.json"))) throw new Error("Manifest or rights changed");
    const prepared = await prepareCases(manifest, resolve(".local/real-world-v1"));
    const baseline = initialBatch(manifest, prepared.photos, prepared.cases, rights);
    if (JSON.stringify(baseline) !== JSON.stringify(read(join(PACKET, "batch-proposal.json")))) throw new Error("Baseline preparation/request bytes changed");
    const saved = read(join(PACKET, "inputs.json")) as { case_id: string; input: unknown }[];
    const selected = baseline.requests.map(r => {
        const c = prepared.cases.find(c => c.id === r.case_id)!;
        if (JSON.stringify(c.input) !== JSON.stringify(saved.find(s => s.case_id === c.id)?.input)) throw new Error("Exact input bytes changed");
        return c;
    });
    const protectedFiles = read(join(EFFORT_ROOT, "protected-before.json")) as { path: string; sha256: string }[];
    for (const p of protectedFiles) if (hash(readFileSync(p.path)) !== p.sha256) throw new Error("Retained evidence changed");
    const requests = selected.flatMap(c => (["medium", "high"] as const).map(profile => {
        const request = metaRequest(c.input, "muse-spark-1.3", profile);
        return { experiment_id: `${c.id}-${profile}`, case_id: c.id, input_sha256: c.input_sha256,
            ...inferenceIdentity(request, profile), profile, sources: baseline.requests.find(r => r.case_id === c.id)!.sources,
            reserved_usd: reservationUsd(profile) };
    }));
    return { selected, requests, protected_files: protectedFiles.length, code_files: CODE_FILES.map(path => ({ path, sha256: hash(readFileSync(path)) })) };
}
export function makeEffortProposal(prepared: Awaited<ReturnType<typeof prepareEffortComparison>>, verifiedAt: string) {
    if (!Number.isFinite(Date.parse(verifiedAt)) || Date.parse(verifiedAt) > Date.now() || Date.now() - Date.parse(verifiedAt) > 86400000) throw new Error("Current public verification required");
    const prior = read(".local/real-photo-batch-2026-11-04/post-audit.json");
    const references = [".local/real-photo-batch-2026-11-04/frozen-reference.json", ".local/real-photo-batch-2026-11-04/assistant-findings.json", ".local/real-photo-batch-2026-11-04/rights-confirmed.json"];
    return {
        status: "BLOCKED — exact paid scope requires separate approval", approved_at: null, created_at: new Date().toISOString(),
        git_head: APPROVED_HEAD, model: "muse-spark-1.3", mode: "Standard", max_requests: 20, retries: 0,
        expires_at: "2026-11-05T00:00:00Z", max_total_usd: 27, max_reserved_usd_each: 1.35,
        pricing_verified_at: verifiedAt, catalogue_verified_at: verifiedAt,
        official_sources: ["https://dev.meta.ai/docs/models", "https://dev.meta.ai/docs/reasoning", "https://dev.meta.ai/docs/pricing-rate-limits", "https://dev.meta.ai/docs/protocols/chat-completions"],
        pricing_usd_per_million: { uncached_input: 1.25, output: 4.25 },
        expected_cost: { calculation_usd: (prior.input_tokens * 2 * 1.25 + 20 * 8192 * 4.25) / 1000000, basis: "Planning calculation using twice the first batch prompt usage and the full 8192 output cap. Not a guaranteed charge or the reservation cap; invoice unverified." },
        input_packet: PACKET, original_proposal_sha256: PROPOSAL_SHA, input_packet_sha256: hash(readFileSync(join(PACKET, "inputs.json"))),
        order: "Original case order; medium then high for each case, sequentially. No replacement or repeat.",
        references: references.map(path => ({ path, sha256: hash(readFileSync(path)) })),
        review_protocol: [
            "The medium/high pair uses identical image bytes, source order/revisions, prompt/schema, 8192 completion cap, 180-second timeout and 512 KiB response cap; only reasoning_effort differs.",
            "The old minimal/1200/45s batch is historical context, not a controlled effort-only comparison against the new conditions.",
            "Freeze the existing rubric plus the disclosed rw-14 arrow erratum; reference facts remain HUMAN PENDING. Do not turn the assistant review into gold labels.",
            "Compare every claim, citation, omission, uncertainty, connection and question, including failures. One response per setting is an exploratory paired pilot, not statistical proof of improvement.",
            "Maintain separate medium/high record imports. Do not merge repeated inputs into an inflated unique-photo denominator. Human accuracy stays NOT MEASURED until scored.",
        ],
        execution_rules: [
            "Create fresh request-bound allowances and an exclusive durable journal only after matching explicit approval. Never reset or reuse existing records.",
            "Before every request verify code, input/request/execution hashes, original source bytes, rights confirmation, approval expiry and all aggregate/allowance ledgers.",
            "Any failure, timeout, unknown outcome/cost, incomplete response, schema failure or ledger/hash mismatch stops the entire batch. Zero retry and no fixture substitution.",
            "No Supabase writes, deployment, Git commit/push, public redistribution, extra probes or submission. Disable Live in finally and retain every raw response and failure.",
        ],
        rights: "Same nine public preview editions and one authored false text control. Prior scoped Standard/private assessment retained; recheck pages before actual dispatch. No public demo reuse authorised.",
        allowances: [3, 3, 3, 3, 3, 3, 2].map((count, i) => ({ group: i + 1, max_requests: count, max_usd: count * 135 / 100, experiment_ids: prepared.requests.slice(i * 3, i * 3 + count).map(r => r.experiment_id), status: "NOT CREATED" })),
        human_review: "PENDING", code_files: prepared.code_files, requests: prepared.requests,
    };
}
export type EffortProposal = ReturnType<typeof makeEffortProposal>;
export async function verifyEffortProposal(proposal: EffortProposal) {
    const current = await prepareEffortComparison();
    if (JSON.stringify(current.requests) !== JSON.stringify(proposal.requests) || JSON.stringify(current.code_files) !== JSON.stringify(proposal.code_files)) throw new Error("Approved request settings or code changed");
    if (proposal.max_requests !== 20 || proposal.max_total_usd !== 27 || proposal.retries !== 0 || proposal.mode !== "Standard" || proposal.model !== "muse-spark-1.3") throw new Error("Invalid fixed comparison policy");
    for (const ref of proposal.references) if (hash(readFileSync(ref.path)) !== ref.sha256) throw new Error("Frozen reference changed");
    return current;
}
