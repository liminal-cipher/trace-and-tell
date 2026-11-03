import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { investigationDb, fixtureRepository } from "../support/investigation-db";
import { emptyDocument, investigationCommandSchema, type InvestigationDocument, type RunResult } from "../../src/lib/investigation-contracts";
import { importAnalysis, modelInput } from "../../src/lib/investigation-domain";
import { fixtureAnalysis } from "../../src/lib/model-fixture";
import { localNextServer } from "../support/local-next-server";

test("questionless fixture → human question → testimony → exhibit survives server and database restart", async ({ page }) => {
    test.setTimeout(90000);
    const directory = mkdtempSync(join(tmpdir(), "trace-human-question-"));
    let repo = await investigationDb(directory);
    let server: Awaited<ReturnType<typeof localNextServer>> | undefined;
    try {
        server = await localNextServer();
        const initial = await repo.snapshot();
        const context = { workspace_id: repo.workspace, assets: initial.archive.assets, revisions: initial.archive.revisions };
        const input = modelInput("compare", context.assets.slice(0, 2).map((a) => ({ asset_id: a.id, revision: 1 })), emptyDocument(), context);
        const output = { ...fixtureAnalysis(input), questions: [] };
        const command = { action: "analyse" as const, operation: "compare" as const, mode: "fixture" as const, workspace_id: repo.workspace, expected_revision: 0, key: crypto.randomUUID(), sources: input.sources };
        const begun = await repo.rpc({ ...command, op: "begin_run", request: command, model: "authored-questionless-fixture" });
        const run: RunResult = { id: begun.id as string, mode: "fixture", model: "authored-questionless-fixture", input, output, raw: output, prompt_version: "test", schema_version: "analysis-v1", latency_ms: 0, usage: null, cost_usd: null };
        await repo.rpc({ ...command, op: "save", request: command, document: importAnalysis(emptyDocument(), run, context), run_id: run.id, record: run });
        // Real UI/domain/SQL, with an explicitly local authenticated API boundary.
        // No production Auth, PostgREST, Storage or model service is exercised.
        await page.route("https://**/*", (route) => route.abort());
        await page.route("**/api/investigation**", async (route) => {
            try {
                const url = new URL(route.request().url());
                if (url.pathname.endsWith("/evidence")) {
                    const id = url.searchParams.get("id"), revision = Number(url.searchParams.get("revision"));
                    const saved = (await repo.db.query<{ document: InvestigationDocument }>("select document from investigation_versions where workspace_id=$1 order by revision desc", [repo.workspace])).rows;
                    const entry = saved.flatMap((r) => r.document.entries).find((e) => e.id === id && e.revision === revision);
                    const latest = (await repo.snapshot()).document.entries.find((e) => e.id === id);
                    await route.fulfill({ json: { entry, historical: latest?.revision !== revision, validity: latest?.evidence_validity } });
                    return;
                }
                const data = route.request().method() === "POST" ? await repo.execute(investigationCommandSchema.parse(route.request().postDataJSON())) : await repo.snapshot();
                await route.fulfill({ json: data });
            } catch (error) {
                await route.fulfill({ status: 409, json: { error: (error as Error).message } });
            }
        });
        await page.goto(`${server.origin}/investigation?workspace=${repo.workspace}`);
        const hypothesis = page.locator(".evidence-card").filter({ has: page.getByRole("heading", { name: "Connection hypothesis", exact: true }) });
        await expect(hypothesis).toContainText("No questions were supplied");
        await expect(page.getByLabel("Your question")).toHaveCount(0);
        await hypothesis.getByRole("button", { name: "Use for inquiry" }).click();
        await expect(hypothesis).toContainText("accepted for inquiry");
        await expect(hypothesis.getByRole("button", { name: "Save my question" })).toBeDisabled();
        const text = "What, if anything, do you know about these records?";
        await hypothesis.getByLabel("Your question").fill(text);
        await hypothesis.getByRole("button", { name: "Save my question" }).click({ clickCount: 2 });
        const question = page.locator(".question-card");
        await expect(question).toHaveCount(1);
        await expect(question).toContainText("question · human-authored · revision 1");
        await expect(question).toContainText("No model generated this question.");
        await expect(hypothesis.getByLabel("Your question")).toHaveValue("");
        await expect(hypothesis).toContainText("No questions were supplied");
        await question.getByRole("button", { name: "Open evidence revision 2", exact: true }).click();
        await expect(question.locator(".evidence-reference")).toContainText("hypothesis · fixture · revision 2");
        await question.getByRole("button", { name: "Select question", exact: true }).click();
        await question.getByLabel("Speaker label").fill("Synthetic human-question speaker");
        await question.getByLabel("Their words").fill("This is a synthetic response. I do not know their origin.");
        await question.getByRole("button", { name: "Save testimony" }).click();
        await expect(page.getByRole("heading", { name: "Synthetic human-question speaker", exact: true })).toBeVisible();
        await page.getByLabel("Exhibit title").fill("Human inquiry with uncertain origins");
        await page.getByRole("checkbox", { name: "Synthetic human-question speaker · answered" }).check();
        await page.getByRole("button", { name: "Save exhibit", exact: true }).click();
        await expect(page.locator(".exhibit-card")).toContainText("This is a synthetic response.");
        const state = await repo.snapshot();
        expect(state.document.entries.filter((e) => e.kind === "question")).toHaveLength(1);
        expect(state.document.entries.find((e) => e.kind === "question")).toMatchObject({ mode: "human", model: null, run_id: null, parents: [{ id: state.document.entries[0].id, revision: 2 }], sources: command.sources.map(({ asset_id, revision }) => ({ asset_id, revision })) });
        expect(state.runs).toHaveLength(1);
        const workspace = repo.workspace;
        await repo.db.close();
        repo = fixtureRepository(new PGlite(directory), workspace);
        await server.restart();
        await page.reload();
        await expect(question).toContainText("human-authored");
        await expect(page.locator(".exhibit-card")).toContainText("Human inquiry with uncertain origins");
        expect((await repo.db.query<{ record: unknown }>("select record from investigation_runs where id=$1", [run.id])).rows[0].record).toEqual(run);
        await question.getByText("Compare original question and correct", { exact: true }).click();
        await question.getByLabel("Corrected question").fill("What can you tell me about the wording?");
        await question.getByRole("button", { name: "Save correction", exact: true }).click();
        await expect(question).toContainText("Original question: " + text);
        await question.getByText("Previous question revisions", { exact: true }).click();
        await question.getByRole("button", { name: "Open evidence revision 1", exact: true }).click();
        await expect(question).toContainText("question · human-authored · revision 1");
        await expect(page.locator(".exhibit-card")).toContainText("needs review");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/human-questions-${test.info().project.name}.png`, fullPage: true });
        await hypothesis.getByRole("button", { name: "Reject hypothesis" }).click();
        await expect(question).toContainText("needs review");
        await expect(page.getByLabel("Your question")).toHaveCount(0);
    } finally {
        await server?.close();
        await repo.db.close();
        const absolute = resolve(directory);
        if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.includes("trace-human-question-")) throw new Error("Unexpected test directory");
        rmSync(absolute, { recursive: true, force: true });
    }
});
