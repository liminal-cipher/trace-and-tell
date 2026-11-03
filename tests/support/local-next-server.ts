import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";

// Own a separate local process so persistence tests can restart it without
// touching a developer's server or loading remote credentials from .env.local.
export async function localNextServer() {
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((done, reject) => probe.close((error) => error ? reject(error) : done()));
    const origin = `http://127.0.0.1:${port}`;
    let child: ChildProcess;
    async function close() {
        if (child && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, "exit");
            child.kill();
            await exited;
        }
    }
    async function start() {
        child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
            windowsHide: true, stdio: "ignore",
            env: { ...process.env, APP_ORIGIN: origin, SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", MODEL_API_KEY: "", META_LIVE_APPROVED: "no", META_APPROVAL_FILE: "", RUN_LOCAL_SUPABASE_E2E: "0" },
        });
        try {
            for (let attempt = 0; attempt < 100; attempt++) {
                if (child.exitCode !== null) throw new Error("Local test server exited before readiness");
                try {
                    if ((await fetch(`${origin}/demo`, { signal: AbortSignal.timeout(500), redirect: "error" })).ok) return;
                } catch { /* The owned process may still be starting. */ }
                await new Promise((done) => setTimeout(done, 100));
            }
            throw new Error("Local test server did not become ready");
        } catch (error) {
            await close();
            throw error;
        }
    }
    await start();
    return { origin, close, restart: async () => { await close(); await start(); } };
}
