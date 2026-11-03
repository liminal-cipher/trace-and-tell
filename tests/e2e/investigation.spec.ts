import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { investigationDb, fixtureRepository } from "../support/investigation-db";
import { investigationCommandSchema } from "../../src/lib/investigation-contracts";
test("fixture UI to PGlite: observation, inquiry, testimony, exhibit and broken sources", async ({ page }) => {
    test.setTimeout(90000);
    const directory = mkdtempSync(join(tmpdir(), "trace-browser-fixture-"));
    let repo = await investigationDb(directory);
    try {
        const initial = await repo.snapshot();
        const photo = initial.archive.assets[0].id;
        const image = readFileSync("tests/fixtures/model/inputs/01.png");
        // Seed an immutable synthetic original; Storage HTTP remains out of scope.
        await repo.db.query("update assets set kind='photo' where id=$1", [photo]);
        await repo.db.query("update asset_revisions set content=null,storage_key='synthetic/01.png',content_type='image/png',size=$2,width=640,height=480 where asset_id=$1", [photo, image.length]);
        await page.route(`**/api/archive/assets/${photo}/file`, async (route) => { await route.fulfill({ contentType: "image/png", body: image, headers: { "Cache-Control": "private, no-store" } }); });
        // Only this test's authenticated API boundary is replaced. The real UI,
        // domain reducer and production SQL migrations/RPC execute below. This is
        // not GoTrue, PostgREST, Storage or a production route-handler E2E.
        await page.route("**/api/investigation**", async (route) => {
            try {
                if (new URL(route.request().url()).pathname.endsWith("/evidence")) {
                    const params=new URL(route.request().url()).searchParams;
                    const id=params.get("id"),revision=Number(params.get("revision"));
                    const snapshots=(await repo.db.query<{document:{entries:import("../../src/lib/investigation-contracts").Entry[]}}>("select document from investigation_versions where workspace_id=$1 order by revision desc",[repo.workspace])).rows;
                    const entry=snapshots.flatMap((v)=>v.document.entries).find((e)=>e.id===id&&e.revision===revision);
                    const latest=(await repo.snapshot()).document.entries.find((e)=>e.id===id);
                    await route.fulfill({json:{entry:latest?.evidence_validity==="invalidated"?null:entry,validity:latest?.evidence_validity,historical:latest?.revision!==revision}});return;
                }
                const data = route.request().method() === "POST" ? await repo.execute(investigationCommandSchema.parse(route.request().postDataJSON())) : await repo.snapshot();
                await route.fulfill({ json: data });
            }
            catch (error) {
                await route.fulfill({ status: 409, json: { error: (error as Error).message } });
            }
        });
        await page.goto(`/investigation?workspace=${repo.workspace}`);
        await expect(page.getByText("FIXTURE: authored software examples.", { exact: false })).toBeVisible();
        await page.getByRole("checkbox", { name: "Record A", exact: true }).check();
        await page.getByRole("button", { name: "Suggest observations" }).click();
        const observation = page.locator(".evidence-card").filter({ hasText: "observation · fixture" }).first();
        await expect(observation).toContainText("No automatic image reading");
        await observation.getByText("Compare original suggestion and correct", { exact: true }).click();
        await observation.getByLabel("Corrected observation").fill("ORBIT 47 appears on the ticket; its date is unknown.");
        await observation.getByRole("button", { name: "Save correction" }).click();
        await expect(observation).toContainText("corrected · current");
        await expect(observation).toContainText("Original suggestion: No automatic image reading");
        await expect(page.getByRole("status")).toContainText("Observation revision 2 saved");
        const originalUncertainty = await observation.getByLabel("Current uncertainty explanation").inputValue();
        const correctedUncertainty = "This record alone cannot establish the exact colour or the cause of uncertainty.";
        await expect(observation).toContainText(`Original uncertainty: ${originalUncertainty}`);
        await observation.getByLabel("Current uncertainty explanation").fill(correctedUncertainty);
        await observation.getByRole("button", { name: "Save correction" }).click();
        await expect(page.getByRole("status")).toContainText("Observation revision 3 saved");
        await expect(observation.getByLabel("Corrected observation")).toHaveValue("ORBIT 47 appears on the ticket; its date is unknown.");
        await expect(observation).toContainText(`Original uncertainty: ${originalUncertainty}`);
        await observation.getByText("Previous observation revisions", { exact: true }).click();
        await observation.getByRole("button", { name: "Open evidence revision 2", exact: true }).click();
        await expect(observation.locator(".evidence-reference").nth(1)).toContainText(`Uncertainty: ${originalUncertainty}`);
        await expect(observation.locator(".evidence-reference").nth(1)).toContainText("Historical revision");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/investigation-observation-${test.info().project.name}.png`, fullPage: true });
        await page.getByRole("checkbox", { name: "Record B", exact: true }).check();
        await page.getByRole("button", { name: "Compare selected records" }).click();
        const hypothesis = page.locator(".evidence-card").filter({ has: page.getByRole("heading", { name: "Connection hypothesis" }) });
        await expect(hypothesis).toContainText("Supporting evidence");
        await hypothesis.getByRole("button", { name: "Use for inquiry" }).click();
        await expect(hypothesis).toContainText("hypothesis · fixture");
        await expect(hypothesis).toContainText("accepted for inquiry");
        const question = page.locator(".question-card").first();
        await question.getByRole("button", { name: "Select question" }).click();
        await expect(question.getByRole("heading", { name: "Record a response" })).toBeVisible();
        await page.screenshot({ path: `test-results/investigation-inquiry-${test.info().project.name}.png`, fullPage: true });
        await question.getByLabel("Speaker label").fill("Synthetic speaker A");
        await question.getByLabel("Their words").fill("I remember a blue ticket, but not its date.");
        await question.getByRole("button", { name: "Save testimony" }).click();
        await expect(page.getByRole("heading", { name: "Synthetic speaker A" })).toBeVisible();
        await question.getByLabel("Speaker label").fill("Synthetic speaker B");
        await question.getByLabel("Response type").selectOption("unknown");
        await question.getByLabel("Their words").fill("");
        await question.getByRole("button", { name: "Save testimony" }).click();
        await expect(page.getByRole("heading", { name: "Synthetic speaker B" })).toBeVisible();
        await page.getByLabel("Exhibit title").fill("Two recollections, one open question");
        await page.getByRole("checkbox", { name: "Synthetic speaker A · answered" }).check();
        await page.getByRole("checkbox", { name: "Synthetic speaker B · unknown" }).check();
        await page.getByRole("button", { name: "Save exhibit", exact: true }).click();
        await expect(page.locator(".exhibit-card")).toContainText("Does not remember.");
        await expect(page.locator(".exhibit-card")).toContainText("exhibit · human-authored");
        await page.locator(".exhibit-card").getByRole("button",{name:"Open evidence revision 1"}).first().click();
        await expect(page.locator(".exhibit-card .evidence-reference").first()).toContainText("I remember a blue ticket");
        await page.screenshot({ path: `test-results/investigation-exhibit-${test.info().project.name}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const workspace = repo.workspace;
        await repo.db.close();
        repo = fixtureRepository(new PGlite(directory), workspace);
        await page.reload();
        await expect(page.locator(".exhibit-card")).toContainText("Two recollections, one open question");
        const original = page.locator(".evidence-card").filter({ hasText: "observation · fixture" }).first();
        await original.getByText("Compare original suggestion and correct", { exact: true }).click();
        await expect(original.getByLabel("Current uncertainty explanation")).toHaveValue(correctedUncertainty);
        await expect(original).toContainText(`Original uncertainty: ${originalUncertainty}`);
        await original.getByLabel("Corrected observation").fill("The writing may instead read ORBIT 41.");
        await original.getByLabel("Current uncertainty explanation").fill("The lettering and its cause of uncertainty remain unconfirmed.");
        await original.getByRole("button", { name: "Save correction" }).click();
        await expect(page.getByRole("status")).toContainText("Observation revision 4 saved");
        await expect(page.locator(".exhibit-card")).toContainText("needs review");
        await original.getByText("Previous observation revisions", { exact: true }).click();
        await original.getByRole("button", { name: "Open evidence revision 3", exact: true }).click();
        await expect(original.locator(".evidence-reference").nth(2)).toContainText(`Uncertainty: ${correctedUncertainty}`);
        await original.getByRole("button", { name: "Reject observation" }).click();
        await page.reload();
        await expect(original).toContainText("rejected");
        const state = await repo.snapshot();
        const source = state.document.entries.find((e) => e.kind === "observation")!.sources[0];
        await repo.db.query("update assets set deletion_state='pending' where id=$1", [source.asset_id]);
        await page.getByRole("button", { name: "Reload saved investigation" }).click();
        await expect(page.locator(".exhibit-card")).toContainText("Broken source");
        await expect(page.locator(".exhibit-card")).toContainText("invalidated");
    }
    finally {
        await repo.db.close();
        if (directory.startsWith(join(tmpdir(), "trace-browser-fixture-")))
            rmSync(directory, { recursive: true, force: true });
    }
});
