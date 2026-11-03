import { MODEL_IMAGE_MAX_EDGE, MODEL_IMAGE_BYTE_LIMIT, MODEL_REQUEST_BYTE_LIMIT } from "../src/lib/model-image";
import { test, expect } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import cases from "../tests/fixtures/model/cases.json";
import { generateAnalysis, ProviderFailure, metaRequest, PROMPT_VERSION, SCHEMA_VERSION } from "../src/lib/model-provider";
import { inputHash } from "../src/lib/model-budget";
import type { ModelInput, ProviderMode, RunResult } from "../src/lib/investigation-contracts";
test("records an immutable synthetic evaluation batch (not a model-quality assertion)", async () => {
    const mode = (process.env.EVALUATION_MODE ?? "fixture") as ProviderMode;
    if (!["fixture", "meta-live", "replay"].includes(mode))
        throw new Error("Choose fixture, replay or meta-live explicitly.");
    const split = process.env.EVALUATION_SPLIT ?? "development";
    if (!["development", "heldout"].includes(split))
        throw new Error("Choose one fixed evaluation split.");
    const count = Number(process.env.EVALUATION_COUNT ?? "1");
    if (!Number.isInteger(count) || count < 1 || count > 3)
        throw new Error("Run one first, then at most three cases per batch.");
    const directory = join("evaluation-results", `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`);
    mkdirSync(directory, { recursive: true });
    let failed = 0, completed = 0;
    for (const item of cases.filter((c) => c.split === split).slice(0, count)) {
        const input: ModelInput = { operation: item.operation as ModelInput["operation"], observations: [], sources: item.files.map((file) => {
                const bytes = readFileSync(join("tests/fixtures/model/inputs", file));
                const index = Number(file.slice(0, 2));
                return { asset_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, revision: 1, content: null, image: `data:image/png;base64,${bytes.toString("base64")}` };
            }) };
        // This plan contains hashes only. Ground truth is never part of the input.
        const identity = { case_id: item.id, split, input_sha256: inputHash(input), source_revisions: input.sources.map(({ asset_id, revision, image }) => ({ asset_id, revision, image_sha256: createHash("sha256").update(Buffer.from(image!.split(",")[1], "base64")).digest("hex") })), prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION, mode };
        if (process.env.EVALUATION_PLAN_ONLY === "1") {
            const request = metaRequest(input, "muse-spark-1.3");
            const images = input.sources.flatMap(({ image }) => {
                if (!image) return [];
                const png = Buffer.from(image.split(",")[1], "base64");
                return [{ bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) }];
            });
            const textCharacters = request.messages.reduce((sum, message) => sum + (typeof message.content === "string" ? message.content.length : message.content.reduce((length, part) => length + (part.type === "text" ? part.text.length : 0), 0)), 0);
            writeFileSync(join(directory, `${item.id}.plan.json`), JSON.stringify({ ...identity, model: request.model, request_limits: { images: 2, dimension: MODEL_IMAGE_MAX_EDGE, bytes_each: MODEL_IMAGE_BYTE_LIMIT, request_bytes: MODEL_REQUEST_BYTE_LIMIT, text_characters: 6000, output_tokens: 1200 }, actual_input: { images, text_characters: textCharacters }, environment: { model_api_key_configured: Boolean(process.env.MODEL_API_KEY), live_enabled: process.env.META_LIVE_APPROVED === "yes", approval_path_configured: Boolean(process.env.META_APPROVAL_FILE) }, request_valid: true, live_calls: 0 }, null, 2), { flag: "wx" });
            continue;
        }
        try {
            let replay: RunResult | undefined;
            if (mode === "replay") {
                const path = process.env.EVALUATION_REPLAY_FILE;
                if (!path)
                    throw new Error("A recorded live response is required.");
                replay = JSON.parse(readFileSync(path, "utf8")).run;
            }
            const run = await generateAnalysis(input, mode, { replay });
            writeFileSync(join(directory, `${item.id}.json`), JSON.stringify({ ...identity, run, validation: "passed", semantic_review: { visible_grounding: null, forced_connection: null, appropriate_abstention: null, leading_question: null, corrections: [], reason: mode === "fixture" ? "Authored fixture: cannot score model quality." : "Human comparison with the separate ground truth is required." } }, null, 2), { flag: "wx" });
            completed++;
        }
        catch (error) {
            failed++;
            writeFileSync(join(directory, `${item.id}.json`), JSON.stringify({ ...identity, validation: "failed", failure: error instanceof ProviderFailure ? error.record : { category: "configuration_or_provider_failure", cost_usd: null }, semantic_review: null }, null, 2), { flag: "wx" });
            // Unknown usage or outcome stops the batch. Never silently switch provider.
            if (mode === "meta-live")
                break;
        }
    }
    writeFileSync(join(directory, "summary.json"), JSON.stringify({ mode, split, completed, failed, model_quality: "not assessed", live_calls: process.env.EVALUATION_PLAN_ONLY === "1" ? 0 : mode === "meta-live" ? "See durable allowance records; failures may have unknown outcome" : 0 }, null, 2), { flag: "wx" });
    console.log(`Evaluation records: ${directory}; completed=${completed}, failed=${failed}; semantic quality not assessed.`);
    expect(failed, "Evaluation failures are recorded; inspect the sanitised records.").toBe(0);
}, 120000);
