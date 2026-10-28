import { z } from "zod";
export const MAX_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTOS = 20;
export const mimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
export const metadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  user_date: z.string().max(100).default(""),
  source_note: z.string().max(4000).default(""),
});
const key = z.uuid();
const workspace_id = z.uuid();
const expected_revision = z.number().int().positive();
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_workspace"),
    key,
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("rename_workspace"),
    key,
    workspace_id,
    expected_revision,
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("save_note"),
    key,
    workspace_id,
    metadata: metadataSchema,
    content: z.string().min(1).max(20000),
  }),
  z.object({
    action: z.literal("create_upload"),
    key,
    workspace_id,
    metadata: metadataSchema,
    size: z.number().int().positive().max(MAX_BYTES),
    content_type: mimeSchema,
  }),
  z.object({ action: z.literal("finalize_upload"), key, intent_id: z.uuid() }),
  z.object({
    action: z.literal("revise_asset"),
    key,
    workspace_id,
    asset_id: z.uuid(),
    expected_revision,
    metadata: metadataSchema,
    content: z.string().min(1).max(20000).optional(),
  }),
  z.object({
    action: z.literal("delete_asset"),
    key,
    workspace_id,
    asset_id: z.uuid(),
    expected_revision,
  }),
  z.object({ action: z.literal("cleanup"), key, workspace_id }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export interface Workspace {
  id: string;
  name: string;
  revision: number;
  created_at: string;
}
export interface Revision extends Metadata {
  id: string;
  asset_id: string;
  revision: number;
  content: string | null;
  content_type: string | null;
  size: number | null;
  created_at: string;
  width: number | null;
  height: number | null;
}
export interface Asset {
  id: string;
  workspace_id: string;
  kind: "photo" | "note";
  active_revision: number;
  deletion_state: "active" | "pending" | "deleted";
  created_at: string;
}
export interface UploadIntent {
  id: string;
  workspace_id: string;
  state: "pending" | "complete" | "rejected" | "expired";
  metadata: Metadata;
  expires_at: string;
  created_at: string;
  cleanup_state: string;
  asset_id: string | null;
}
