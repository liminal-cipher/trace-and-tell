import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Offline entry point: never load .env.local or activate a model provider.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src",import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts",import.meta.url)) } },
  test: { include: ["scripts/real-world.run.ts"], fileParallelism: false, testTimeout: 60000 },
});
