import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
// Default is a disconnected preflight. Never load project secrets here.
export default defineConfig({
  resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url)),"server-only":fileURLToPath(new URL("./tests/server-only.ts",import.meta.url))}},
  test:{include:["scripts/real-world-batch.run.ts"],fileParallelism:false,retry:0},
});
