import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
// Evaluation is an explicit CLI entry point; ordinary tests stay disconnected.
// Node preserves existing process overrides, including a disabled live gate.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) } }, test: { include: ["scripts/evaluation.run.ts"], fileParallelism: false } });
