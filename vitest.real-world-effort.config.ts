import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) } },
    test: { include: [process.env.EFFORT_EXECUTE === "yes" ? "scripts/real-world-effort.run.ts" : "scripts/real-world-effort.plan.ts"], fileParallelism: false, retry: 0 },
});
