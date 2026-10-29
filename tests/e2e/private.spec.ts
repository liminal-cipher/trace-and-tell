import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { assertLocalOrigin } from "../local-environment";
const enabled = process.env.RUN_LOCAL_SUPABASE_E2E === "1";
const url = process.env.SUPABASE_URL ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const mailbox = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
function assertLocal(value: string) {
  const target = new URL(value);
  assertLocalOrigin(target.origin);
  if (target.username || target.password) throw new Error("Integration tests refuse URL credentials.");
}
async function signedPut(target: string, bytes: Buffer, upsert = false) {
  assertLocal(target);
  try {
    return (await fetch(target, { method: "PUT", redirect: "error", headers: {
      "Content-Type": "image/png", "x-upsert": String(upsert),
    }, body: new Uint8Array(bytes) })).ok;
  } catch { throw new Error("Local signed upload request failed; capability omitted."); }
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
  try { await page.goto(link); }
  catch { throw new Error("Local Magic Link navigation failed; link omitted."); }
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
    const sessionCookies = (await page.context().cookies()).filter((cookie) => cookie.name.includes("auth-token"));
    expect(sessionCookies.length > 0).toBe(true);
    expect(sessionCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax" && !cookie.secure)).toBe(true);
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
    expect((await post(page, { ...repeated, content: "Different payload" })).status()).toBe(409);
    expect(snapshot.revisions.filter((r: { asset_id: string }) => r.asset_id === note.id).length).toBe(2);

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
    expect((await post(other, { action: "delete_asset", key: crypto.randomUUID(), workspace_id: photo.workspace_id, asset_id: photo.id, expected_revision: 1 })).status()).toBe(404);
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
    expect((await stranger.rpc("archive_command", { actor: created.data.user!.id, payload: repeated })).error !== null).toBe(true);
    expect((await stranger.from("command_receipts").select("key")).error !== null).toBe(true);
    expect((await stranger.from("assets").delete().eq("id", photo.id)).error !== null).toBe(true);
    expect((await stranger.from("asset_revisions").select("storage_key")).error !== null).toBe(true);

    // A revoked access token must also lose direct Data API read access.
    const ownWorkspace = await admin.rpc("archive_command", { actor: created.data.user!.id, payload: { action: "create_workspace", key: crypto.randomUUID(), name: "Session boundary" } });
    expect(ownWorkspace.error === null).toBe(true);
    expect((await stranger.from("workspaces").select("id")).data?.length).toBe(1);
    const access = (await stranger.auth.getSession()).data.session!.access_token;
    expect((await stranger.auth.signOut()).error === null).toBe(true);
    const revoked = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${access}` } } });
    expect((await revoked.from("workspaces").select("id")).data).toEqual([]);

    // Lose the upload request, then retry the same pending intent through UI.
    await page.route("**/storage/v1/object/upload/sign/**", (route) => route.abort("failed"));
    const interruptedBytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ab4266" } }).png().toBuffer();
    await page.getByLabel("Choose photographs").setInputFiles({ name: "interrupted.png", mimeType: "image/png", buffer: interruptedBytes });
    const interrupted = page.locator(".upload-status").filter({ hasText: "interrupted.png" });
    await expect(interrupted).toContainText("Not saved");
    await page.unroute("**/storage/v1/object/upload/sign/**");
    await interrupted.getByRole("button", { name: "Retry this file", exact: true }).click();
    await expect(interrupted).toContainText("Saved and verified.");

    const intentResponse = await post(page, {
      action: "create_upload",
      key: crypto.randomUUID(),
      workspace_id: photo.workspace_id,
      metadata: { title: "Expiry test" },
      size: bytes.length,
      content_type: "image/png",
    });
    const intent = await intentResponse.json();
    expect(intentResponse.ok()).toBe(true);
    assertLocal(intent.upload_url);
    const capability = new URL(intent.upload_url);
    const claims = JSON.parse(Buffer.from(capability.searchParams.get("token")!.split(".")[1], "base64url").toString());
    const lifetime = claims.exp * 1000 - Date.now();
    expect(lifetime > 110 * 60_000 && lifetime <= 125 * 60_000).toBe(true);
    const wrongPath = new URL(capability); wrongPath.pathname += "-wrong";
    expect(await signedPut(wrongPath.toString(), bytes)).toBe(false);
    const wrongBucket = new URL(capability); wrongBucket.pathname = wrongBucket.pathname.replace("archive-staging", "archive-originals");
    expect(await signedPut(wrongBucket.toString(), bytes)).toBe(false);
    const badUrl = new URL(intent.upload_url);
    badUrl.searchParams.set("token", "invalid");
    expect(await signedPut(badUrl.toString(), bytes)).toBe(false);
    expect(await signedPut(intent.upload_url, Buffer.alloc(6291457))).toBe(false);
    expect(await signedPut(intent.upload_url, bytes)).toBe(true);
    expect(await signedPut(intent.upload_url, interruptedBytes, true)).toBe(false);
    const expired = await admin
      .from("upload_intents")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", intent.id);
    expect(expired.error === null).toBe(true);
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
    // Cleanup can remove staging before the native token expires. A replay may
    // recreate staging, but may never create an active record after intent expiry.
    await signedPut(intent.upload_url, bytes);
    expect((await post(page, { action: "finalize_upload", key: crypto.randomUUID(), intent_id: intent.id })).status()).toBe(410);
    expect((await post(page, { action: "cleanup", key: crypto.randomUUID(), workspace_id: photo.workspace_id })).ok()).toBe(true);

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
    const quotaWorkspace = await (await post(page, { action: "create_workspace", key: crypto.randomUUID(), name: "Synthetic quota test" })).json();
    const reservations = await Promise.all(Array.from({ length: 21 }, () => post(page, {
      action: "create_upload", key: crypto.randomUUID(), workspace_id: quotaWorkspace.id,
      metadata: { title: "Concurrent reservation" }, size: bytes.length, content_type: "image/png",
    })));
    expect(reservations.filter((response) => response.status() === 200).length).toBe(20);
    expect(reservations.filter((response) => response.status() === 409).length).toBe(1);
    const beforeLogout = await page.context().cookies();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("link", { name: "Sign in with email" }),
    ).toBeVisible();
    expect((await page.request.get("/api/archive")).status()).toBe(401);
    await anonymous.addCookies(beforeLogout);
    expect((await anonymous.request.get("/api/archive")).status()).toBe(401);
    await anonymous.close();
    await otherContext.close();
  });
});
