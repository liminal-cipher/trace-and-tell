import { createHash } from "node:crypto";
import { z } from "zod";

export const inferenceProfileSchema = z.enum(["baseline", "medium", "high", "max"]);
export type InferenceProfile = z.infer<typeof inferenceProfileSchema>;
export const META_ENDPOINT = "https://api.meta.ai/v1/chat/completions";
export const INFERENCE_PROFILES = {
    baseline: { reasoning_effort: "minimal", max_completion_tokens: 1200, timeout_ms: 45000, response_byte_limit: 262144 },
    medium: { reasoning_effort: "medium", max_completion_tokens: 8192, timeout_ms: 180000, response_byte_limit: 524288 },
    high: { reasoning_effort: "high", max_completion_tokens: 8192, timeout_ms: 180000, response_byte_limit: 524288 },
    max: { reasoning_effort: "max", max_completion_tokens: 8192, timeout_ms: 180000, response_byte_limit: 524288 },
} as const;

export function inferenceSettings(profile: InferenceProfile = "baseline") {
    return { ...INFERENCE_PROFILES[inferenceProfileSchema.parse(profile)] };
}
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
export function inferenceIdentity(request: unknown, profile: InferenceProfile = "baseline") {
    const settings = inferenceSettings(profile);
    const request_sha256 = sha256(JSON.stringify(request));
    const execution_sha256 = sha256(JSON.stringify({ endpoint: META_ENDPOINT, method: "POST", mode: "Standard", retries: 0, request_sha256, ...settings }));
    return { profile, ...settings, request_sha256, execution_sha256 };
}
export type InferenceEvidence = ReturnType<typeof inferenceIdentity>;
export function reservationUsd(profile: InferenceProfile = "baseline") {
    // Conservative full context plus completion cap, rounded upwards to cents.
    return Math.ceil(((1048576 * 1.25 + inferenceSettings(profile).max_completion_tokens * 4.25) / 1000000) * 100) / 100;
}
