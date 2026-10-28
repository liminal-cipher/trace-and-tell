import { test, expect } from "@playwright/test";
test("synthetic archive is read only, responsive and survives reload", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/demo");
  await expect(page.getByText("SYNTHETIC / FIXTURE · READ ONLY")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The morning collection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A note without a date" }),
  ).toBeVisible();
  expect(
    await page.locator("main button, main input, main textarea").count(),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByText("3 synthetic records · No AI model used"),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({
    path: `test-results/demo-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("unconfigured private archive never claims to save data", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.SUPABASE_URL),
    "Configuration-present behaviour is covered by local-stack tests.",
  );
  await page.goto("/archive");
  await expect(
    page.getByRole("heading", {
      name: "The private archive is not configured yet.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore the synthetic demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeDisabled();
});
test("API rejects cross-origin writes and anonymous access without leaking records", async ({
  request,
}) => {
  const crossOrigin = await request.post("/api/archive", {
    headers: { Origin: "https://attacker.invalid" },
    data: { action: "create_workspace", name: "Attack" },
  });
  expect(crossOrigin.status()).toBe(403);
  const read = await request.get("/api/archive");
  expect([401, 503]).toContain(read.status());
  expect(await read.json()).toHaveProperty("error");
  const file = await request.get(
    "/api/archive/assets/11111111-1111-4111-8111-111111111111/file",
  );
  expect([401, 503]).toContain(file.status());
  const noModel = await request.post("/api/meta", { data: {} });
  expect(noModel.status()).toBe(404);
});
