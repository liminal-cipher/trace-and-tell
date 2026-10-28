import { z } from "zod";
import { requireUser, storageAdmin } from "@/lib/supabase";
import { AppError, databaseError, failure } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { client } = await requireUser();
    const id = z.uuid().parse((await context.params).id);
    const asset = await client
      .from("assets")
      .select("id,active_revision")
      .eq("id", id)
      .eq("deletion_state", "active")
      .maybeSingle();
    databaseError(asset.error);
    if (!asset.data) throw new AppError(404, "This original is unavailable.");
    const value = new URL(request.url).searchParams.get("revision");
    const revision = value
      ? z.coerce.number().int().positive().parse(value)
      : asset.data.active_revision;
    const visible = await client
      .from("asset_revisions")
      .select("id,content_type")
      .eq("asset_id", id)
      .eq("revision", revision)
      .maybeSingle();
    databaseError(visible.error);
    if (!visible.data?.content_type)
      throw new AppError(404, "This original is unavailable.");
    const admin = storageAdmin();
    const record = await admin
      .from("asset_revisions")
      .select("storage_key")
      .eq("id", visible.data.id)
      .single();
    databaseError(record.error);
    const file = await admin.storage
      .from("archive-originals")
      .download(record.data!.storage_key);
    if (file.error || !file.data)
      throw new AppError(
        503,
        "The original could not be retrieved. Try again.",
      );
    // Recheck after storage I/O so a concurrent deletion prevents the response.
    const active = await client
      .from("assets")
      .select("id")
      .eq("id", id)
      .eq("deletion_state", "active")
      .maybeSingle();
    if (active.error || !active.data)
      throw new AppError(404, "This original is unavailable.");
    return new Response(file.data, {
      headers: {
        "Content-Type": visible.data.content_type,
        "Content-Length": String(file.data.size),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
