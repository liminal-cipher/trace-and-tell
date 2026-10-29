import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, databaseError } from "./errors";
import { storageAdmin } from "./supabase";
import { ImageValidationError, validateImage } from "./image-validation";
import type { Command } from "./contracts";
import { allRows } from "./pagination";
export const revisionColumns =
  "id,asset_id,revision,title,user_date,source_note,content,content_type,size,width,height,created_at";
export const intentColumns =
  "id,workspace_id,metadata,state,asset_id,cleanup_state,expires_at,created_at";
async function ownWorkspace(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("workspaces")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  databaseError(error);
  if (!data) throw new AppError(404, "This workspace is unavailable.");
}
async function rpc(actor: string, payload: object) {
  const { data, error } = await storageAdmin().rpc("archive_command", {
    actor,
    payload,
  });
  databaseError(error);
  return data;
}
export async function listArchive(
  client: SupabaseClient,
  workspaceId?: string,
) {
  const workspaces = await allRows((from, to) =>
    client
      .from("workspaces")
      .select("id,name,revision,created_at")
      .order("created_at")
      .order("id")
      .range(from, to),
  );
  const id = workspaceId ?? workspaces?.[0]?.id;
  if (!id) return { workspaces, assets: [], revisions: [], intents: [] };
  await ownWorkspace(client, id);
  const [assets, intents] = await Promise.all([
    allRows((from, to) =>
      client
        .from("assets")
        .select(
          "id,workspace_id,kind,active_revision,deletion_state,created_at",
        )
        .eq("workspace_id", id)
        .neq("deletion_state", "deleted")
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      client
        .from("upload_intents")
        .select(intentColumns)
        .eq("workspace_id", id)
        .or("state.neq.complete,cleanup_state.neq.done")
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  const ids = assets
    .filter((a) => a.deletion_state === "active")
    .map((a) => a.id);
  const revisions = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    revisions.push(
      ...(await allRows((from, to) =>
        client
          .from("asset_revisions")
          .select(revisionColumns)
          .in("asset_id", ids.slice(offset, offset + 100))
          .order("revision", { ascending: false })
          .order("id")
          .range(from, to),
      )),
    );
  }
  return {
    workspaces,
    selected: id,
    assets,
    revisions,
    intents,
  };
}

export async function cleanupWorkspace(
  client: SupabaseClient,
  workspaceId: string,
) {
  await ownWorkspace(client, workspaceId);
  const admin = storageAdmin();
  const failures: string[] = [];
  const expiry = await admin
    .from("upload_intents")
    .update({ state: "expired" })
    .eq("workspace_id", workspaceId)
    .eq("state", "pending")
    .lte("expires_at", new Date().toISOString());
  databaseError(expiry.error);
  const pending = await allRows((from, to) =>
    admin
      .from("assets")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("deletion_state", "pending")
      .order("id")
      .range(from, to),
  );
  for (const asset of pending) {
    const revisions = await admin
      .from("asset_revisions")
      .select("storage_key")
      .eq("asset_id", asset.id);
    databaseError(revisions.error);
    const paths = [
      ...new Set<string>(
        (revisions.data ?? []).map((r) => r.storage_key).filter(Boolean),
      ),
    ];
    const removal = paths.length
      ? await admin.storage.from("archive-originals").remove(paths)
      : { error: null };
    if (removal.error) {
      failures.push(
        "An original could not be removed. Access remains blocked.",
      );
      continue;
    }
    const update = await admin
      .from("assets")
      .update({ deletion_state: "deleted" })
      .eq("id", asset.id)
      .eq("deletion_state", "pending");
    databaseError(update.error);
  }
  const intents = await allRows((from, to) =>
    admin
      .from("upload_intents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("state", "pending")
      .neq("cleanup_state", "done")
      .order("id")
      .range(from, to),
  );
  for (const intent of intents) {
    if (
      intent.cleanup_state === "done" &&
      new Date(intent.capability_expires_at).getTime() < Date.now()
    )
      continue;
    const stage = await admin.storage
      .from("archive-staging")
      .remove([intent.stage_key]);
    // A duplicate's copied file and late copies from expired intents are orphans.
    const references = await admin
      .from("asset_revisions")
      .select("asset_id,assets!inner(deletion_state)")
      .eq("storage_key", intent.final_key)
      .neq("assets.deletion_state", "deleted")
      .limit(1);
    databaseError(references.error);
    const original = references.data?.length
      ? { error: null }
      : await admin.storage
          .from("archive-originals")
          .remove([intent.final_key]);
    const failed = Boolean(stage.error || original.error);
    const capabilityExpired =
      new Date(intent.capability_expires_at).getTime() < Date.now();
    const update = await admin
      .from("upload_intents")
      .update({
        cleanup_state: failed
          ? "failed"
          : capabilityExpired
            ? "done"
            : "pending",
      })
      .eq("id", intent.id);
    databaseError(update.error);
    if (failed) failures.push("Temporary file cleanup failed. Retry cleanup.");
  }
  return {
    cleanup: failures.length ? "failed" : "checked",
    warnings: failures,
  };
}

async function finalize(
  client: SupabaseClient,
  actor: string,
  command: Extract<Command, { action: "finalize_upload" }>,
) {
  const visible = await client
    .from("upload_intents")
    .select("id,workspace_id")
    .eq("id", command.intent_id)
    .maybeSingle();
  databaseError(visible.error);
  if (!visible.data) throw new AppError(404, "This upload is unavailable.");
  const admin = storageAdmin();
  const { data: intent, error } = await admin
    .from("upload_intents")
    .select("*")
    .eq("id", command.intent_id)
    .single();
  databaseError(error);
  if (intent.state === "complete") {
    const asset = await client
      .from("assets")
      .select("id")
      .eq("id", intent.asset_id)
      .eq("deletion_state", "active")
      .maybeSingle();
    databaseError(asset.error);
    if (!asset.data) throw new AppError(404, "This record has been deleted.");
    return { ...(await rpc(actor, command)), already_saved: true };
  }
  if (intent.state === "rejected")
    throw new AppError(
      422,
      "This file was rejected. Choose a valid file again.",
    );
  if (
    intent.state !== "pending" ||
    new Date(intent.expires_at).getTime() <= Date.now()
  )
    throw new AppError(
      410,
      "The upload expired. Choose the file again and run cleanup.",
    );
  const download = await admin.storage
    .from("archive-staging")
    .download(intent.stage_key);
  if (download.error || !download.data)
    throw new AppError(
      409,
      "The file has not arrived yet. Retry the upload or verification.",
    );
  let verified;
  const bytes = Buffer.from(await download.data.arrayBuffer());
  try {
    verified = await validateImage(bytes, intent.size, intent.content_type);
  } catch (error) {
    if (!(error instanceof ImageValidationError)) throw error;
    await rpc(actor, {
      action: "reject_upload",
      key: randomUUID(),
      intent_id: intent.id,
    });
    let cleanupPending = false;
    try {
      const cleanup = await cleanupWorkspace(client, intent.workspace_id);
      cleanupPending = cleanup.warnings.length > 0;
    } catch {
      cleanupPending = true;
    }
    throw new AppError(
      422,
      error.message +
        (cleanupPending
          ? " Temporary file cleanup is pending; retry cleanup."
          : ""),
    );
  }
  const uploaded = await admin.storage
    .from("archive-originals")
    .upload(intent.final_key, bytes, {
      contentType: verified.content_type,
      upsert: false,
      cacheControl: "0",
    });
  if (uploaded.error) {
    // A previous attempt may have copied the bytes before its DB response failed.
    const existing = await admin.storage
      .from("archive-originals")
      .download(intent.final_key);
    if (existing.error || !existing.data)
      throw new AppError(
        503,
        "The verified file could not be stored. Retry verification.",
      );
    const previous = await validateImage(
      Buffer.from(await existing.data.arrayBuffer()),
      intent.size,
      intent.content_type,
    );
    if (previous.sha256 !== verified.sha256)
      throw new AppError(
        409,
        "The upload changed unexpectedly. Choose the file again.",
      );
  }
  const saved = await rpc(actor, { ...command, ...verified });
  // The DB is committed at this point; cleanup must never masquerade as save failure.
  try {
    return {
      ...saved,
      ...(await cleanupWorkspace(client, intent.workspace_id)),
    };
  } catch {
    return {
      ...saved,
      warnings: ["Saved. Temporary file cleanup is still pending."],
    };
  }
}

export async function executeCommand(
  client: SupabaseClient,
  actor: string,
  command: Command,
) {
  if (command.action === "finalize_upload")
    return finalize(client, actor, command);
  if ("workspace_id" in command)
    await ownWorkspace(client, command.workspace_id);
  if (command.action === "cleanup")
    return cleanupWorkspace(client, command.workspace_id);
  const result = await rpc(actor, command);
  if (command.action === "create_upload") {
    const admin = storageAdmin();
    const current = await admin
      .from("upload_intents")
      .select("*")
      .eq("id", result.id)
      .single();
    databaseError(current.error);
    if (
      current.data.state !== "pending" ||
      new Date(current.data.expires_at).getTime() <= Date.now()
    )
      throw new AppError(
        410,
        "This upload intent is no longer active. Choose the file again.",
      );
    const { data, error } = await admin.storage
      .from("archive-staging")
      .createSignedUploadUrl(current.data.stage_key, { upsert: false });
    if (error || !data)
      throw new AppError(
        503,
        "Upload permission could not be created. Retry this file.",
      );
    const update = await admin
      .from("upload_intents")
      .update({
        capability_expires_at: new Date(
          Date.now() + 125 * 60_000,
        ).toISOString(),
        cleanup_state: "pending",
      })
      .eq("id", result.id);
    databaseError(update.error);
    return {
      id: result.id,
      upload_url: data.signedUrl,
      expires_at: current.data.expires_at,
    };
  }
  if (command.action === "delete_asset") {
    try {
      return {
        ...result,
        ...(await cleanupWorkspace(client, command.workspace_id)),
      };
    } catch {
      return {
        ...result,
        warnings: ["Access blocked. File cleanup is pending; retry cleanup."],
      };
    }
  }
  return result;
}
