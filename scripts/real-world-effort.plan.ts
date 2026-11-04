import { test, vi } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { prepareEffortComparison, makeEffortProposal, EFFORT_ROOT } from "./real-world/effort";
import { durableJson } from "./real-world/batch-journal";
import { hash } from "./real-world/core";

test("prepares the exact medium/high comparison offline without creating allowances", async () => {
    vi.stubGlobal("fetch", () => { throw new Error("Offline planning only"); });
    try {
        const prepared = await prepareEffortComparison();
        const proposal = makeEffortProposal(prepared, process.env.EFFORT_PUBLIC_VERIFIED_AT ?? "");
        const path = join(EFFORT_ROOT, "proposal.json");
        durableJson(path, proposal);
        writeFileSync(join(EFFORT_ROOT, "proposal.sha256"), hash(readFileSync(path)) + "\n", { flag: "wx" });
        console.log(JSON.stringify({ requests: proposal.requests.length, reservation_cap: proposal.max_total_usd, planning_cost: proposal.expected_cost.calculation_usd, protected_files: prepared.protected_files, paid_calls: 0 }));
    } finally { vi.unstubAllGlobals(); }
}, 60000);
