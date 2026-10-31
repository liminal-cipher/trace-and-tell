"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RecordDialog } from "./record-dialog";
import { PrivateImage, UploadPreview } from "./archive-image";
import { createRetryKeys } from "@/lib/retry-keys";
import {
  MAX_BYTES,
  mimeSchema,
  type Asset,
  type Revision,
  type UploadIntent,
  type Workspace,
} from "@/lib/contracts";
interface Snapshot {
  workspaces: Workspace[];
  selected?: string;
  assets: Asset[];
  revisions: Revision[];
  intents: UploadIntent[];
}
interface Upload {
  key: string;
  file: File;
  workspace: string;
  intent?: string;
  url?: string;
  state: string;
  error?: string;
  finished?: boolean;
}
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new RequestError(
      data.error ?? "The request failed.",
      response.status,
    );
  return data;
}
async function command(payload: object) {
  return jsonRequest("/api/archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "The operation failed. Try again.";
export function Archive() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    workspaces: [],
    assets: [],
    revisions: [],
    intents: [],
  });
  const [workspace, setWorkspace] = useState<string>();
  const [message, setMessage] = useState("Loading your archive…");
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeUpload = useRef(new Set<string>());
  const mutationInFlight = useRef(false);
  const retry = useRef(createRetryKeys());
  const loadSequence = useRef(0);
  const handleError = useCallback((err: unknown) => {
    setError(errorText(err));
    if (err instanceof RequestError && err.status === 401) {
      retry.current.clear();
      setUnauthorized(true);
      setSnapshot({ workspaces: [], assets: [], revisions: [], intents: [] });
      setSelected(undefined);
    }
  }, []);
  const load = useCallback(
    async (id?: string) => {
      const sequence = ++loadSequence.current;
      try {
        const data: Snapshot = await jsonRequest(
          `/api/archive${id ? `?workspace=${id}` : ""}`,
        );
        if (sequence !== loadSequence.current) return;
        setSnapshot(data);
        setWorkspace(data.selected);
        setMessage("");
        setUnauthorized(false);
      } catch (err) {
        if (sequence === loadSequence.current) {
          setMessage("");
          handleError(err);
        }
      }
    },
    [handleError],
  );
  useEffect(() => {
    // load only sets state after the asynchronous API response, never during
    // the synchronous effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function mutate(payload: object, done?: () => void) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    const cleaning = "action" in payload && payload.action === "cleanup";
    setMessage(cleaning ? "Checking file cleanup…" : "Saving…");
    try {
      const result = await command({
        ...payload,
        key: retry.current.forPayload(payload),
      });
      retry.current.confirmed(payload);
      done?.();
      await load(
        "action" in payload && payload.action === "create_workspace"
          ? result.id
          : workspace,
      );
      setMessage(
        result.warnings?.join(" ") || (cleaning
          ? "File cleanup checked. Any remaining work is listed below."
          : "Saved to your private archive."),
      );
    } catch (err) {
      setMessage("");
      handleError(err);
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  function updateUpload(item: Upload, changes: Partial<Upload>) {
    Object.assign(item, changes);
    setUploads((items) =>
      items.map((row) => (row.key === item.key ? { ...item } : row)),
    );
  }
  async function runUpload(item: Upload) {
    if (activeUpload.current.has(item.key)) return;
    activeUpload.current.add(item.key);
    updateUpload(item, { state: "Preparing upload…", error: undefined });
    try {
      if (
        !mimeSchema.safeParse(item.file.type).success ||
        item.file.size > MAX_BYTES ||
        !item.file.size
      )
        throw new Error("Choose a JPEG, PNG or WebP file up to 6 MiB.");
      if (!item.intent) {
        const result = await command({
          action: "create_upload",
          key: item.key,
          workspace_id: item.workspace,
          metadata: {
            title: item.file.name.slice(0, 160),
            user_date: "",
            source_note: "",
          },
          size: item.file.size,
          content_type: item.file.type,
        });
        updateUpload(item, { intent: result.id, url: result.upload_url });
      }
      updateUpload(item, { state: "Uploading to private storage…" });
      // The URL contains a scoped upload capability, never a Supabase API key.
      // Always ask the server to verify after a network error: the upload may
      // already have succeeded, and overwriting staged bytes is prohibited.
      try {
        await fetch(item.url!, {
          method: "PUT",
          headers: { "Content-Type": item.file.type, "x-upsert": "false" },
          body: item.file,
          credentials: "omit",
        });
      } catch {
        /* Resolve unknown outcome through finalisation. */
      }
      updateUpload(item, { state: "Verifying the original…" });
      const result = await command({
        action: "finalize_upload",
        key: item.intent,
        intent_id: item.intent,
      });
      updateUpload(item, {
        state: result.duplicate
          ? "Already in this workspace — duplicate skipped."
          : "Saved and verified.",
        finished: true,
      });
      await load(item.workspace);
      if (result.warnings?.length) setMessage(result.warnings.join(" "));
    } catch (err) {
      updateUpload(item, { state: "Not saved", error: errorText(err) });
      if (err instanceof RequestError && err.status === 401) handleError(err);
    } finally {
      activeUpload.current.delete(item.key);
    }
  }
  const current = snapshot.workspaces.find((w) => w.id === workspace);
  const asset = snapshot.assets.find(
    (a) => a.id === selected && a.deletion_state === "active",
  );
  const revision = snapshot.revisions.find(
    (r) => r.asset_id === selected && r.revision === asset?.active_revision,
  );
  if (unauthorized)
    return (
      <section className="notice">
        <h2>Sign in to open your archive.</h2>
        <p>{error}</p>
        <Link className="button" href="/login">
          Sign in with email
        </Link>
      </section>
    );
  return (
    <>
      <div className="toolbar">
        <label>
          Workspace
          <select
            aria-label="Workspace"
            value={workspace ?? ""}
            disabled={busy}
            onChange={(event) => {
              setSelected(undefined);
              setError("");
              void load(event.target.value);
            }}
          >
            <option value="" disabled>
              Choose a workspace
            </option>
            {snapshot.workspaces.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setError("");
            void load(workspace);
          }}
        >
          Refresh records
        </button>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await jsonRequest("/api/auth/logout", { method: "POST" });
              window.location.reload();
            } catch (err) {
              handleError(err);
            }
          }}
        >
          Sign out
        </button>
      </div>
      <div role="status" aria-live="polite">
        {message}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="archive-layout">
        <aside className="sidebar stack">
          <form
            className="panel stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void mutate(
                {
                  action: "create_workspace",
                  name: new FormData(form).get("name"),
                },
                () => form.reset(),
              );
            }}
          >
            <h2>Start a collection</h2>
            <label>
              Workspace name
              <input
                name="name"
                required
                maxLength={100}
                placeholder="A collection of small things"
              />
            </label>
            <button disabled={busy}>Create workspace</button>
          </form>
          {current && (
            <>
              <Link className="button" href={`/investigation?workspace=${current.id}`}>
                Open investigation
              </Link>
              <form
                className="panel stack"
                key={`${current.id}-${current.revision}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate({
                    action: "rename_workspace",
                    workspace_id: current.id,
                    expected_revision: current.revision,
                    name: new FormData(event.currentTarget).get("name"),
                  });
                }}
              >
                <h2>Collection details</h2>
                <label>
                  Rename workspace
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={current.name}
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Save name
                </button>
              </form>
              <section className="panel stack">
                <h2>Add photographs</h2>
                <p>
                  JPEG, PNG or WebP · up to 6 MiB each.
                  <br />
                  20 photographs per workspace.
                </p>
                <label className="upload-label">
                  Choose photographs
                  <input
                    aria-label="Choose photographs"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const items = Array.from(event.target.files ?? []).map(
                        (file) => ({
                          file,
                          key: crypto.randomUUID(),
                          workspace: current.id,
                          state: "Queued",
                        }),
                      );
                      setUploads((old) => [...old, ...items]);
                      void (async () => {
                        for (const item of items) await runUpload(item);
                      })();
                      event.target.value = "";
                    }}
                  />
                </label>
                <p className="muted">
                  A record is saved only after server verification.
                </p>
              </section>
              <form
                className="panel stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void mutate(
                    {
                      action: "save_note",
                      workspace_id: current.id,
                      metadata: {
                        title: data.get("title"),
                        user_date: data.get("user_date"),
                        source_note: data.get("source_note"),
                      },
                      content: data.get("content"),
                    },
                    () => form.reset(),
                  );
                }}
              >
                <h2>Keep a note</h2>
                <label>
                  Note title
                  <input name="title" required maxLength={160} />
                </label>
                <label>
                  Original text
                  <textarea
                    name="content"
                    required
                    maxLength={20000}
                    rows={5}
                  />
                </label>
                <label>
                  Date or period you know
                  <input
                    name="user_date"
                    maxLength={100}
                    placeholder="Unknown, circa 1980, or a date"
                  />
                </label>
                <label>
                  Source / context
                  <textarea name="source_note" maxLength={4000} rows={2} />
                </label>
                <button disabled={busy}>Save note</button>
              </form>
            </>
          )}
        </aside>
        <section aria-label="Records" className="records">
          <div className="section-line">
            <h2>{current?.name ?? "Your collections begin here"}</h2>
            <span>
              {
                snapshot.assets.filter((a) => a.deletion_state === "active")
                  .length
              }{" "}
              records
            </span>
          </div>
          {uploads
            .filter((u) => u.workspace === workspace)
            .map((item) => (
              <div
                key={item.key}
                className={item.error ? "upload-status error" : "upload-status"}
              >
                {!item.finished &&
                  !item.error &&
                  mimeSchema.safeParse(item.file.type).success && (
                    <UploadPreview file={item.file} />
                  )}
                <strong>{item.file.name}</strong>
                <span>{item.state}</span>
                {item.error && (
                  <>
                    <p>{item.error}</p>
                    <button
                      className="secondary"
                      onClick={() => void runUpload(item)}
                    >
                      Retry this file
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        const next = {
                          ...item,
                          key: crypto.randomUUID(),
                          intent: undefined,
                          url: undefined,
                          error: undefined,
                          state: "Queued",
                        };
                        setUploads((items) =>
                          items.filter((i) => i.key !== item.key).concat(next),
                        );
                        void runUpload(next);
                      }}
                    >
                      Start a new upload
                    </button>
                  </>
                )}
              </div>
            ))}
          {!snapshot.assets.length && (
            <div className="empty">
              <span className="folio">THE FIRST RECORD</span>
              <h3>Make room for a memory.</h3>
              <p>
                {current
                  ? "Add a photograph or write a note. Its original and your revisions will stay together."
                  : "Create a workspace to begin your private collection."}
              </p>
            </div>
          )}
          <div className="record-grid">
            {snapshot.assets.map((item) => {
              const rev = snapshot.revisions.find(
                (r) =>
                  r.asset_id === item.id && r.revision === item.active_revision,
              );
              return item.deletion_state !== "active" ? (
                <article className="panel" key={item.id}>
                  <h3>Deletion pending</h3>
                  <p>Access is blocked. File cleanup needs to finish.</p>
                  <code>{item.id}</code>
                </article>
              ) : (
                <button
                  className="record-card"
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setConfirmDelete(false);
                  }}
                >
                  {item.kind === "photo" ? (
                    <PrivateImage
                      assetId={item.id}
                      title={rev?.title ?? "Archived photograph"}
                    />
                  ) : (
                    <div className="note-preview">{rev?.content}</div>
                  )}
                  <div className="caption">
                    <span className="eyebrow">
                      {item.kind === "photo" ? "PHOTOGRAPH" : "TYPED NOTE"} ·
                      REV {item.active_revision}
                    </span>
                    <h3>{rev?.title}</h3>
                    <p>{rev?.user_date || "Date unknown"}</p>
                    <span className="muted">
                      Registered{" "}
                      {new Date(item.created_at).toLocaleDateString("en-AU")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {current && (
            <details className="panel recovery">
              <summary>Upload recovery & file cleanup</summary>
              <p>
                Pending uploads survive refresh. Verify files that reached
                storage, or choose a file again if its permission expired.
                Cleanup remains pending until upload capabilities expire.
              </p>
              {snapshot.intents
                .filter((i) => i.state === "pending" || i.cleanup_state !== "done")
                .map((intent) => (
                  <div className="upload-status" key={intent.id}>
                    <strong>{intent.metadata.title}</strong>
                    <span>
                      {intent.state} · cleanup {intent.cleanup_state} · upload permission expires{" "}
                      {new Date(intent.expires_at).toLocaleString("en-AU")}
                    </span>
                    {intent.state === "pending" && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            action: "finalize_upload",
                            intent_id: intent.id,
                          })
                        }
                      >
                        Retry verification
                      </button>
                    )}
                  </div>
                ))}
              {!snapshot.intents.some((i) => i.state === "pending" || i.cleanup_state !== "done") && (
                <p>No pending uploads or file cleanup.</p>
              )}
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void mutate({ action: "cleanup", workspace_id: current.id })
                }
              >
                Retry file cleanup
              </button>
            </details>
          )}
        </section>
      </div>
      {asset && revision && (
        <RecordDialog onClose={() => setSelected(undefined)}>
          <section className="detail-panel">
            <button
              autoFocus
              className="close"
              onClick={() => setSelected(undefined)}
              aria-label="Close record"
            >
              Close ×
            </button>
            <h2 id="record-heading">{revision.title}</h2>
            <p className="muted">
              Record {asset.id} · Revision {asset.active_revision}
            </p>
            {asset.kind === "photo" ? (
              <>
                <PrivateImage
                  className="original"
                  assetId={asset.id}
                  title={revision.title}
                />
                <a
                  href={`/api/archive/assets/${asset.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original ↗
                </a>
                <p className="muted">
                  {revision.width} × {revision.height} pixels ·{" "}
                  {revision.size?.toLocaleString("en-AU")} bytes. Camera / EXIF
                  dates are not inferred.
                </p>
              </>
            ) : (
              <blockquote className="original-note">
                {revision.content}
              </blockquote>
            )}
            <form
              key={`${asset.id}-${asset.active_revision}`}
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate({
                  action: "revise_asset",
                  workspace_id: asset.workspace_id,
                  asset_id: asset.id,
                  expected_revision: asset.active_revision,
                  metadata: {
                    title: data.get("title"),
                    user_date: data.get("user_date"),
                    source_note: data.get("source_note"),
                  },
                  ...(asset.kind === "note"
                    ? { content: data.get("content") }
                    : {}),
                });
              }}
            >
              <label>
                Record title
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={revision.title}
                />
              </label>
              {asset.kind === "note" && (
                <label>
                  Note text
                  <textarea
                    name="content"
                    required
                    maxLength={20000}
                    defaultValue={revision.content ?? ""}
                    rows={5}
                  />
                </label>
              )}
              <label>
                Date / period (entered by you)
                <input
                  name="user_date"
                  maxLength={100}
                  defaultValue={revision.user_date}
                />
              </label>
              <label>
                Source / context
                <textarea
                  name="source_note"
                  maxLength={4000}
                  defaultValue={revision.source_note}
                  rows={3}
                />
              </label>
              <button disabled={busy}>Save new revision</button>
              <p className="muted">
                Earlier revisions are preserved. Saving does not verify the
                historical details.
              </p>
            </form>
            <details>
              <summary>Revision history</summary>
              {snapshot.revisions
                .filter((r) => r.asset_id === asset.id)
                .map((r) => (
                  <article className="history" key={r.id}>
                    <strong>
                      Revision {r.revision} · {r.title}
                    </strong>
                    <p>
                      {r.user_date || "Date unknown"} · {r.source_note}
                    </p>
                    {r.content && <blockquote>{r.content}</blockquote>}
                  </article>
                ))}
            </details>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <p role="status">{message}</p>
            {confirmDelete ? (
              <div className="error">
                <p>
                  Delete this record? Access to every revision will be blocked
                  immediately. This cannot be undone.
                </p>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      {
                        action: "delete_asset",
                        workspace_id: asset.workspace_id,
                        asset_id: asset.id,
                        expected_revision: asset.active_revision,
                      },
                      () => setSelected(undefined),
                    )
                  }
                >
                  Confirm deletion
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep record
                </button>
              </div>
            ) : (
              <button
                className="text-button danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                Delete record
              </button>
            )}
          </section>
        </RecordDialog>
      )}
    </>
  );
}
