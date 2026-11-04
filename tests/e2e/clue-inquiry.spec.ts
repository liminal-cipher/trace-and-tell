import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { investigationDb } from "../support/investigation-db";
import { investigationCommandSchema } from "../../src/lib/investigation-contracts";

test("one photograph → selected clue → question → testimony → illustrated exhibit", async ({ page }) => {
  test.setTimeout(90000);
  const repo = await investigationDb();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const initial = await repo.snapshot();
    const photo = initial.archive.assets[0].id;
    const image = readFileSync("tests/fixtures/model/inputs/01.png");
    await repo.db.query("update assets set kind='photo' where id=$1", [photo]);
    await repo.db.query("update asset_revisions set content=null,storage_key='synthetic/01.png',content_type='image/png',size=$2,width=640,height=480 where asset_id=$1", [photo, image.length]);
    // The real UI, reducer and local SQL run; external Auth/Storage/AI do not.
    await page.route("https://**/*", (route) => route.abort());
    await page.route(`**/api/archive/assets/${photo}/file*`, (route) => route.fulfill({ contentType: "image/png", body: image }));
    await page.route("**/api/investigation**", async (route) => {
      try {
        const data = route.request().method() === "POST" ? await repo.execute(investigationCommandSchema.parse(route.request().postDataJSON())) : await repo.snapshot();
        await route.fulfill({ json: data });
      } catch (error) { await route.fulfill({ status: 409, json: { error: String(error) } }); }
    });
    await page.goto(`/investigation?workspace=${repo.workspace}`);
    await page.getByRole("checkbox", { name: "Record A", exact: true }).check();
    await page.getByRole("button", { name: "Suggest observations", exact: true }).click();
    const clue = page.locator(".evidence-desk .evidence-card").first();
    const choose = clue.getByRole("button", { name: "Ask about this clue", exact: true });
    await choose.focus();
    await page.keyboard.press("Enter");
    await expect(clue).toContainText("accepted for inquiry");
    await clue.getByRole("button", { name: "Suggest questions about this clue", exact: true }).click();
    const question = page.locator(".question-card").first();
    await expect(question).toContainText("Question supplied by the authored fixture");
    await expect(clue.getByRole("button", { name: "Suggest questions about this clue" })).toBeDisabled();
    await clue.getByLabel("Your question").fill("What do you remember about this object? (Synthetic test)");
    await clue.getByRole("button", { name: "Save my question" }).click();
    await expect(page.locator(".question-card")).toHaveCount(2);
    await expect(page.locator(".question-card").last()).toContainText("human-authored");
    await question.getByRole("button", { name: "Select question", exact: true }).click();
    const notesEvent = page.waitForEvent("download");
    await question.getByRole("button", { name: "Download conversation notes", exact: true }).click();
    const notes = readFileSync((await (await notesEvent).path())!, "utf8");
    expect(notes).toContain("Authored fixture question");
    expect(notes).toContain("Record A · source revision 1");
    expect(notes).not.toContain(repo.workspace);
    await question.getByLabel("Speaker label").fill("Synthetic speaker");
    await question.getByLabel("Their words").fill("An invented demonstration answer, not a historical memory.");
    await question.getByRole("button", { name: "Save testimony" }).click();
    await page.getByLabel("Exhibit title").fill("One detail, one question");
    await page.getByRole("checkbox", { name: "Synthetic speaker · answered" }).check();
    await page.getByRole("button", { name: "Save exhibit", exact: true }).click();
    const exhibit = page.locator(".exhibit-card");
    await expect(exhibit.getByRole("img").first()).toHaveAttribute("src", `/api/archive/assets/${photo}/file?revision=1`);
    await expect(exhibit.getByRole("link", { name: "Open full original · revision 1 (new tab)", exact: true }).first()).toHaveAttribute("href", `/api/archive/assets/${photo}/file?revision=1`);
    const exhibitEvent = page.waitForEvent("download");
    await exhibit.getByRole("button", { name: "Download exhibit text", exact: true }).click();
    const textCopy = readFileSync((await (await exhibitEvent).path())!, "utf8");
    expect(textCopy).toContain("Synthetic speaker: An invented demonstration answer");
    expect(textCopy).not.toContain("/api/");
    await page.reload();
    await expect(exhibit).toContainText("One detail, one question");
    expect((await repo.snapshot()).document.entries.some((entry) => entry.kind === "hypothesis")).toBe(false);
    await exhibit.scrollIntoViewIfNeeded();
    await expect.poll(() => exhibit.getByRole("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/clue-inquiry-${test.info().project.name}.png`, fullPage: true });
    await clue.getByRole("button", { name: "Reject observation", exact: true }).click();
    await expect(exhibit).toContainText("needs review");
    await expect(exhibit.getByRole("button", { name: "Download exhibit text", exact: true })).toBeDisabled();
    await expect(question.getByRole("button", { name: "Save testimony", exact: true })).toBeDisabled();
    await expect(clue.getByLabel("Your question")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await repo.db.close(); }
});
