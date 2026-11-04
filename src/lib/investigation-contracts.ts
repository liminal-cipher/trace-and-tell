import { z } from "zod";
export const providerMode = z.enum(["fixture", "replay", "meta-live"]);
export type ProviderMode = z.infer<typeof providerMode>;
export const sourceSchema = z.object({ asset_id: z.uuid(), revision: z.number().int().positive() }).strict();
export type Source = z.infer<typeof sourceSchema>;
const text = z.string().trim().min(1).max(2000);
const evidence = sourceSchema.extend({ detail: text });
export const analysisSchema = z.object({
    observations: z.array(sourceSchema.extend({ claim: text, locator: text, uncertainty: text })).max(6),
    connection: z.object({
        outcome: z.enum(["candidate", "no_connection"]), statement: text,
        supports: z.array(evidence).max(6), contradicts: z.array(evidence).max(6),
        unknowns: z.array(text).min(1).max(6),
    }).strict().nullable(),
    questions: z.array(text).max(3),
}).strict();
export type Analysis = z.infer<typeof analysisSchema>;
export interface ModelInput {
    operation: "observe" | "compare";
    sources: (Source & {
        content: string | null;
        image?: string;
    })[];
    observations: {
        id: string;
        revision: number;
        text: string;
        sources: Source[];
        review_state: Entry["review_state"];
        mode: ProviderMode;
    }[];
}
export interface RunResult {
    inference?: import("./model-settings").InferenceEvidence;
    id: string;
    mode: ProviderMode;
    model: string;
    prompt_version: string;
    schema_version: string;
    input: ModelInput;
    raw: unknown;
    output: Analysis;
    latency_ms: number;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
    } | null;
    cost_usd: number | null;
    replay_of?: string;
}
export interface Entry {
    id: string;
    kind: "observation" | "hypothesis" | "question" | "testimony" | "exhibit";
    revision: number;
    text: string;
    original_text: string;
    review_state: "unreviewed" | "corrected" | "rejected" | "accepted_for_inquiry" | "selected" | "recorded";
    evidence_validity: "current" | "needs_review" | "invalidated";
    sources: Source[];
    parents: {
        id: string;
        revision: number;
    }[];
    mode: ProviderMode | "human";
    model: string | null;
    run_id: string | null;
    created_at: string;
    details: {
        locator?: string;
        uncertainty?: string;
        original_uncertainty?: string | null;
        outcome?: "candidate" | "no_connection";
        supports?: {
            asset_id: string;
            revision: number;
            detail: string;
        }[];
        contradicts?: {
            asset_id: string;
            revision: number;
            detail: string;
        }[];
        unknowns?: string[];
        speaker?: string;
        recorder?: string;
        response?: "answered" | "unknown" | "declined" | "conflicting";
        source_mode?: "heard_directly" | "reported";
        title?: string;
    };
}
export interface InvestigationDocument {
    entries: Entry[];
    analysed: string[];
}
export interface InvestigationSnapshot {
    workspace_id: string;
    revision: number;
    document: InvestigationDocument;
    runs: {
        id: string;
        mode: ProviderMode;
        model: string;
        status: string;
        created_at: string;
        error: string | null;
    }[];
}
const envelope = { key: z.uuid(), workspace_id: z.uuid(), expected_revision: z.number().int().nonnegative() };
export const investigationCommandSchema = z.discriminatedUnion("action", [
    z.object({ ...envelope, action: z.literal("ask"), hypothesis_id: z.uuid(),
        hypothesis_revision: z.number().int().positive(), text }),
    z.object({ ...envelope, action: z.literal("analyse"), operation: z.enum(["observe", "compare"]),
        sources: z.array(sourceSchema).min(1).max(2), mode: providerMode, replay_id: z.uuid().optional() }),
    z.object({ ...envelope, action: z.literal("review"), id: z.uuid(), entry_revision: z.number().int().positive(),
        decision: z.enum(["corrected", "rejected", "accepted_for_inquiry", "selected"]), text: text.optional(), uncertainty: text.optional() }),
    z.object({ ...envelope, action: z.literal("testify"), question_id: z.uuid(), speaker: z.string().trim().min(1).max(100),
        response: z.enum(["answered", "unknown", "declined", "conflicting"]), source_mode: z.enum(["heard_directly", "reported"]),
        text: z.string().max(4000), id: z.uuid().optional(), entry_revision: z.number().int().positive().optional() }),
    z.object({ ...envelope, action: z.literal("exhibit"), testimony_ids: z.array(z.uuid()).min(1).max(6),
        title: z.string().trim().min(1).max(160), id: z.uuid().optional(), entry_revision: z.number().int().positive().optional() }),
]);
export type InvestigationCommand = z.infer<typeof investigationCommandSchema>;
export const emptyDocument = (): InvestigationDocument => ({ entries: [], analysed: [] });
export function analysisIdentity(input: ModelInput) {
    return JSON.stringify({ operation: input.operation,
        sources: input.sources.map(({ asset_id, revision }) => ({ asset_id, revision })).sort((a, b) => a.asset_id.localeCompare(b.asset_id)),
        observations: input.observations.map(({ id, revision }) => ({ id, revision })).sort((a, b) => a.id.localeCompare(b.id)) });
}
export function withoutImages(input: ModelInput): ModelInput {
    return { ...input, sources: input.sources.map((s) => ({ asset_id: s.asset_id, revision: s.revision, content: s.content })) };
}
