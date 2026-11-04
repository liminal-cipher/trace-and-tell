import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { AppError } from "./errors";
import type { ModelInput } from "./investigation-contracts";
import { inferenceProfileSchema, reservationUsd, type InferenceProfile } from "./model-settings";
// A local, durable experiment allowance shared by the CLI and local app.
// Vercel's ephemeral filesystem is deliberately refused, not used as a budget.
const approvalSchema = z.object({
    id: z.uuid(), model: z.literal("muse-spark-1.3"), approved_at: z.iso.datetime(), expires_at: z.iso.datetime(),
    catalogue_verified_at: z.iso.datetime(), pricing_verified_at: z.iso.datetime(),
    max_requests: z.number().int().min(1).max(20), max_usd: z.number().positive().max(5),
    input_usd_per_million: z.literal(1.25), output_usd_per_million: z.literal(4.25),
    allowed_input_sha256: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    request_bindings: z.array(z.object({
        input_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        execution_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        profile: inferenceProfileSchema,
    }).strict()).min(1).optional(),
}).strict();
export const inputHash = (input: ModelInput) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
type Charge = {
    id: string;
    input_hash: string;
    reserved_usd: number;
    cost_usd: number | null;
    status: "reserved" | "settled";
    created_at: string;
    request_sha256?: string;
    execution_sha256?: string;
    profile?: InferenceProfile;
};
type Execution = { request_sha256: string; execution_sha256: string; profile: InferenceProfile };
export function reserveModelRequest(input: ModelInput, execution?: Execution) {
    const profile = inferenceProfileSchema.parse(execution?.profile ?? "baseline");
    const reservation = reservationUsd(profile);
    if (process.env.VERCEL || process.env.META_LIVE_APPROVED !== "yes")
        throw new AppError(403, "Live model use needs an approved local experiment allowance.");
    const path = process.env.META_APPROVAL_FILE;
    if (!path || !isAbsolute(path))
        throw new AppError(503, "The model allowance is not configured.");
    let approval: z.infer<typeof approvalSchema>;
    try {
        approval = approvalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    }
    catch {
        throw new AppError(503, "The model allowance is missing or invalid.");
    }
    const now = Date.now();
    if (Date.parse(approval.expires_at) <= now || [approval.catalogue_verified_at, approval.pricing_verified_at].some((v) => now - Date.parse(v) > 86400000 || Date.parse(v) > now))
        throw new AppError(403, "Recheck the approved model, price and allowance expiry before calling.");
    const hash = inputHash(input);
    if (!approval.allowed_input_sha256.includes(hash))
        throw new AppError(403, "This input is outside the approved synthetic experiment.");
    if (approval.request_bindings) {
        if (!execution || !approval.request_bindings.some(b => b.input_sha256 === hash && b.request_sha256 === execution.request_sha256 && b.execution_sha256 === execution.execution_sha256 && b.profile === profile))
            throw new AppError(403, "The request settings or execution hash are outside this approval.");
    } else if (profile !== "baseline") {
        throw new AppError(403, "Changed inference settings require a new request-bound approval.");
    }
    const directory = join(dirname(path), `allowance-${approval.id}`);
    mkdirSync(directory, { recursive: true });
    const lock = join(directory, "request.lock");
    let fd: number;
    try {
        fd = openSync(lock, "wx");
    }
    catch {
        throw new AppError(409, "Another model request is in progress. Do not reset its allowance.");
    }
    try {
        const charges: Charge[] = readdirSync(directory).filter((f) => f.endsWith(".reservation.json")).map((f) => {
            const reserved = JSON.parse(readFileSync(join(directory, f), "utf8")) as Charge;
            const settled = join(directory, `${reserved.id}.settlement.json`);
            try {
                return JSON.parse(readFileSync(settled, "utf8")) as Charge;
            }
            catch {
                return reserved;
            }
        });
        if (charges.some((c) => c.status !== "settled" || c.cost_usd === null))
            throw new AppError(409, "A previous request has unknown cost or outcome. Further calls are blocked.");
        if (approval.request_bindings && charges.some(c => c.execution_sha256 === execution!.execution_sha256))
            throw new AppError(409, "This approved execution was already attempted. Retries are forbidden.");
        if (charges.length >= approval.max_requests || charges.reduce((sum, c) => sum + c.cost_usd!, 0) + reservation > approval.max_usd)
            throw new AppError(429, "The experiment's request or cost allowance is exhausted.");
        const charge: Charge = { id: randomUUID(), input_hash: hash, reserved_usd: reservation, cost_usd: null, status: "reserved", created_at: new Date().toISOString(), ...(execution ?? {}) };
        writeFileSync(join(directory, `${charge.id}.reservation.json`), JSON.stringify(charge, null, 2), { flag: "wx" });
        return { model: approval.model, settle(cost: number | null) {
                if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > reservation))
                    cost = null;
                writeFileSync(join(directory, `${charge.id}.settlement.json`), JSON.stringify({ ...charge, status: "settled", cost_usd: cost }, null, 2), { flag: "wx" });
            } };
    }
    finally {
        closeSync(fd);
        unlinkSync(lock);
    }
}
