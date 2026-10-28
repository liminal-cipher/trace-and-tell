import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
const enabled = process.env.RUN_LOCAL_SUPABASE_E2E === "1";
const url = process.env.SUPABASE_URL ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const mailbox = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
function assertLocal(value: string) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname))
    throw new Error("Integration tests refuse remote targets.");
}
async function signIn(page: Page) {
  const email = `archive-${crypto.randomUUID()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  let link = "";
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${mailbox}/view/latest.html?query=${encodeURIComponent(`to:${email}`)}`,
        );
        if (!response.ok()) return false;
        const html = await response.text();
        link = (
          html.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1] ?? ""
        ).replaceAll("&amp;", "&");
        return Boolean(link);
      },
      { timeout: 15000 },
    )
    .toBe(true);
  assertLocal(link);
  await page.goto(link);
  await expect(page).toHaveURL(/\/archive$/);
  await expect(
    page.getByRole("button", { name: "Create workspace" }),
  ).toBeVisible();
  return email;
}
async function post(page: Page, body: object) {
  return page.request.post("/api/archive", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: body,
  });
}
test.describe("real local Supabase Auth / PostgreSQL / Storage", () => {
  test.skip(
    !enabled,
    "Not run: requires an explicitly enabled local Supabase stack and server credentials.",
  );
  test.beforeAll(() => {
    assertLocal(url);
    assertLocal(mailbox);
    if (!publishable || !secret)
      throw new Error("Local Supabase keys are required.");
  });
  test("magic link, private archive, revisions, refresh, upload failures, isolation and logout", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);
    await signIn(page);
    await page
      .getByLabel("Workspace name", { exact: true })
      .fill("Synthetic browser collection");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Synthetic browser collection" }),
    ).toBeVisible();
    await page
      .getByLabel("Note title", { exact: true })
      .fill("A synthetic note");
    await page
      .getByLabel("Original text")
      .fill("한국어 원문. Fictional material only.");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await page.getByRole("button", { name: /A synthetic note/ }).click();
    await page.getByLabel("Record title").fill("Revised synthetic note");
    await page.getByRole("button", { name: "Save new revision" }).click();
    await expect(page.getByRole("dialog")).toContainText("Revision 2");
    await page.getByLabel("Close record").click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Revised synthetic note/ }),
    ).toBeVisible();
    await page
      .getByLabel("Rename workspace")
      .fill("Renamed synthetic collection");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(
      page.getByRole("heading", { name: "Renamed synthetic collection" }),
    ).toBeVisible();

    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#52787a" },
    })
      .png()
      .toBuffer();
    await page.getByLabel("Choose photographs").setInputFiles([
      { name: "synthetic.png", mimeType: "image/png", buffer: bytes },
      {
        name: "damaged.png",
        mimeType: "image/png",
        buffer: Buffer.from("This is not an image"),
      },
      {
        name: "oversized.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(6291457),
      },
    ]);
    await expect(
      page.getByText("Saved and verified.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/file is damaged/)).toBeVisible();
    await expect(
      page.getByText("Choose a JPEG, PNG or WebP file up to 6 MiB."),
    ).toBeVisible();
    await page.getByLabel("Choose photographs").setInputFiles({
      name: "duplicate.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await expect(page.getByText(/duplicate skipped/)).toBeVisible();
    const snapshot = await (await page.request.get("/api/archive")).json();
    const photo = snapshot.assets.find(
      (a: { kind: string }) => a.kind === "photo",
    );
    const note = snapshot.assets.find(
      (a: { kind: string }) => a.kind === "note",
    );
    const original = await page.request.get(
      `/api/archive/assets/${photo.id}/file`,
    );
    expect(original.ok()).toBe(true);
    expect(await original.body()).toEqual(bytes);
    expect(original.headers()["cache-control"]).toContain("no-store");

    const request = {
      action: "revise_asset",
      workspace_id: photo.workspace_id,
      asset_id: note.id,
      expected_revision: note.active_revision,
      metadata: { title: "Concurrent edit" },
      content: "New synthetic revision",
    };
    const results = await Promise.all([
      post(page, { ...request, key: crypto.randomUUID() }),
      post(page, { ...request, key: crypto.randomUUID() }),
    ]);
    expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
    const repeated = {
      action: "save_note",
      key: crypto.randomUUID(),
      workspace_id: photo.workspace_id,
      metadata: { title: "Idempotent note" },
      content: "Only once",
    };
    expect((await (await post(page, repeated)).json()).id).toBe(
      (await (await post(page, repeated)).json()).id,
    );

    const otherContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    const other = await otherContext.newPage();
    await signIn(other);
    expect(
      (
        await other.request.get(`/api/archive?workspace=${photo.workspace_id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.request.get(`/api/archive/assets/${photo.id}/file`)
      ).status(),
    ).toBe(404);
    expect(
      (await post(other, { ...request, key: crypto.randomUUID() })).status(),
    ).toBe(404);
    const anonymous = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    expect((await anonymous.request.get("/api/archive")).status()).toBe(401);
    expect(
      (
        await anonymous.request.get(`/api/archive/assets/${photo.id}/file`)
      ).status(),
    ).toBe(401);

    // Exercise the actual Data API with another authenticated user's JWT.
    const admin = createClient(url, secret, {
      auth: { persistSession: false },
    });
    const passwordEmail = `rls-${crypto.randomUUID()}@example.test`,
      password = crypto.randomUUID();
    const created = await admin.auth.admin.createUser({
      email: passwordEmail,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    const stranger = createClient(url, publishable, {
      auth: { persistSession: false },
    });
    expect(
      (
        await stranger.auth.signInWithPassword({
          email: passwordEmail,
          password,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await stranger
          .from("workspaces")
          .select("id")
          .eq("id", photo.workspace_id)
      ).data,
    ).toEqual([]);
    expect(
      (await stranger.from("assets").select("id").eq("id", photo.id)).data,
    ).toEqual([]);
    const revision = await admin
      .from("asset_revisions")
      .select("storage_key")
      .eq("asset_id", photo.id)
      .eq("revision", 1)
      .single();
    expect(
      (
        await stranger.storage
          .from("archive-originals")
          .download(revision.data!.storage_key)
      ).error,
    ).not.toBeNull();
    const anon = createClient(url, publishable, {
      auth: { persistSession: false },
    });
    expect((await anon.from("workspaces").select("id")).error).not.toBeNull();
    expect(
      (
        await anon.storage
          .from("archive-originals")
          .download(revision.data!.storage_key)
      ).error,
    ).not.toBeNull();
    const signed = await stranger.storage
      .from("archive-originals")
      .createSignedUrl(revision.data!.storage_key, 60);
    expect(signed.error).not.toBeNull();

    const intentResponse = await post(page, {
      action: "create_upload",
      key: crypto.randomUUID(),
      workspace_id: photo.workspace_id,
      metadata: { title: "Expiry test" },
      size: bytes.length,
      content_type: "image/png",
    });
    const intent = await intentResponse.json();
    const badUrl = new URL(intent.upload_url);
    badUrl.searchParams.set("token", "invalid");
    expect(
      (
        await page.request.put(badUrl.toString(), {
          data: bytes,
          headers: { "Content-Type": "image/png" },
        })
      ).ok(),
    ).toBe(false);
    await admin
      .from("upload_intents")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", intent.id);
    expect(
      (
        await post(page, {
          action: "finalize_upload",
          key: crypto.randomUUID(),
          intent_id: intent.id,
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await post(page, {
          action: "cleanup",
          key: crypto.randomUUID(),
          workspace_id: photo.workspace_id,
        })
      ).ok(),
    ).toBe(true);

    await page.reload();
    await page.getByRole("button", { name: /synthetic.png/ }).click();
    await page
      .getByRole("button", { name: "Delete record", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm deletion" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (await page.request.get(`/api/archive/assets/${photo.id}/file`)).status(),
    ).toBe(404);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("link", { name: "Sign in with email" }),
    ).toBeVisible();
    expect((await page.request.get("/api/archive")).status()).toBe(401);
    await anonymous.close();
    await otherContext.close();
  });
});
