"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PrivateImage } from "./archive-image";
import { EvidenceReference } from "./evidence-reference";
import { ConversationGuide, DownloadNotes } from "./conversation-guide";
import { exhibitNotes } from "@/lib/record-export";
import { createRetryKeys } from "@/lib/retry-keys";
import type { Asset, Revision } from "@/lib/contracts";
import { analysisIdentity, type Entry, type InvestigationSnapshot, type ProviderMode } from "@/lib/investigation-contracts";
type Snapshot = InvestigationSnapshot & {
    archive: {
        assets: Asset[];
        revisions: Revision[];
        workspaces: {
            id: string;
            name: string;
        }[];
    };
};
class RequestError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, { ...options, cache: "no-store" });
    const data = await response.json();
    if (!response.ok)
        throw new RequestError(response.status, response.status === 401 ? "Your session ended. Sign in again to continue." : data.error ?? "The request failed.");
    return data as Snapshot;
}
export function Investigation({ workspace }: {
    workspace: string;
}) {
    const [snapshot, setSnapshot] = useState<Snapshot>();
    const [selected, setSelected] = useState<string[]>([]);
    const [mode, setMode] = useState<ProviderMode>("fixture");
    const [replayId, setReplayId] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const keys = useRef(createRetryKeys());
    const inFlight = useRef(false);
    const fail = useCallback((error: unknown) => {
        setError(error instanceof Error ? error.message : "The request failed.");
        if (error instanceof RequestError && error.status === 401) {
            setSnapshot(undefined);
            setSelected([]);
            keys.current.clear();
        }
    }, []);
    const load = useCallback(async () => {
        try {
            setSnapshot(await request(`/api/investigation?workspace=${workspace}`));
            setError("");
        }
        catch (e) {
            fail(e);
        }
    }, [workspace, fail]);
    useEffect(() => {
        let active = true;
        request(`/api/investigation?workspace=${workspace}`).then((data) => { if (active)
            setSnapshot(data); }, (e: Error) => { if (active)
            fail(e); });
        return () => { active = false; };
    }, [workspace, fail]);
    async function mutate(action: Record<string, unknown>) {
        if (!snapshot || inFlight.current)
            return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        setNotice(action.action === "analyse" ? action.operation === "inquire" ? "Preparing questions from the selected clue…" : "Examining the selected records…" : "Saving…");
        const payload = { ...action, workspace_id: workspace, expected_revision: snapshot.revision };
        try {
            const next = await request("/api/investigation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, key: keys.current.forPayload(payload) }) });
            keys.current.confirmed(payload);
            setSnapshot(next);
            const corrected = action.action === "review" && action.decision === "corrected"
                ? next.document.entries.find((entry) => entry.id === action.id && entry.kind === "observation") : undefined;
            setNotice(corrected ? `Observation revision ${corrected.revision} saved to your private collection.` : "Saved to your private collection.");
            return true;
        }
        catch (e) {
            fail(e);
            setNotice("Save not confirmed. Reload to check the saved state before retrying.");
            return false;
        }
        finally {
            inFlight.current = false;
            setBusy(false);
        }
    }
    const entries = snapshot?.document.entries ?? [];
    const assets = snapshot?.archive.assets.filter((a) => a.deletion_state === "active") ?? [];
    const currentRevision = (id: string) => snapshot?.archive.revisions.find((r) => r.asset_id === id && r.revision === assets.find((a) => a.id === id)?.active_revision);
    const exportSources = (entry: Entry) => entry.sources.map(source => ({ title: snapshot?.archive.revisions.find(revision => revision.asset_id === source.asset_id && revision.revision === source.revision)?.title ?? "Unavailable source", revision: source.revision }));
    const analyse = (operation: "observe" | "compare") => mutate({ action: "analyse", operation, mode, ...(mode === "replay" ? { replay_id: replayId } : {}), sources: selected.map((id) => ({ asset_id: id, revision: assets.find((a) => a.id === id)!.active_revision })) });
    const inquire = (entry: Entry) => mutate({ action: "analyse", operation: "inquire", mode, ...(mode === "replay" ? { replay_id: replayId } : {}), sources: entry.sources, clue_id: entry.id, clue_revision: entry.revision });
    const alreadyInquired = (entry: Entry) => snapshot?.document.analysed.includes(analysisIdentity({ operation: "inquire", sources: entry.sources.map((s) => ({ ...s, content: null })), observations: [{ id: entry.id, revision: entry.revision, text: entry.text, sources: entry.sources, review_state: entry.review_state, mode: entry.mode === "human" ? "fixture" : entry.mode }] }));
    function sourceLinks(entry: Entry) {
        return <div className="source-links" aria-label="Evidence sources">{entry.sources.map((s) => {
                const revision = snapshot?.archive.revisions.find((r) => r.asset_id === s.asset_id && r.revision === s.revision);
                const active = assets.some((a) => a.id === s.asset_id);
                return active && revision ? <details key={s.asset_id}><summary>Source: {revision.title} · revision {s.revision}</summary>
        <p className="muted">{s.asset_id}</p>{revision.content !== null ? <blockquote>{revision.content}</blockquote> : <PrivateImage assetId={s.asset_id} revision={s.revision} title={revision.title} className="original" zoom/>}
        <p>{revision.source_note}</p></details> : <p className="error" key={s.asset_id}>Broken source · record deleted or unavailable · revision {s.revision}</p>;
            })}{entry.parents.map((p)=><EvidenceReference key={`${p.id}-${p.revision}-${entry.evidence_validity}`} workspace={workspace} id={p.id} revision={p.revision}/>)}</div>;
    }
    function review(entry: Entry, decision: string, text?: string, uncertainty?: string) { return mutate({ action: "review", id: entry.id, entry_revision: entry.revision, decision, ...(text ? { text } : {}), ...(uncertainty !== undefined ? { uncertainty } : {}) }); }
    function entryHeader(entry: Entry) { return <><div className="eyebrow">{entry.kind} · {entry.mode === "human" || entry.kind === "testimony" || entry.kind === "exhibit" ? "human-authored" : entry.mode} · revision {entry.revision}</div><p className="entry-status">{entry.review_state.replaceAll("_", " ")} · {entry.evidence_validity.replaceAll("_", " ")}</p>
      {(entry.kind === "testimony" || entry.kind === "exhibit") && entry.mode !== "human" && <p className="muted">Human-recorded content. The historical {entry.mode} attribution refers to upstream suggestions, not authorship of these words.</p>}
      {entry.kind === "question" && <p className="muted">{entry.mode === "human" ? `Written by signed-in record keeper (${entry.details.recorder}). No model generated this question.` : `Question supplied by ${entry.mode === "fixture" ? "the authored fixture" : entry.mode === "replay" ? "a saved model response" : entry.model}.`}</p>}</>; }
    function correction(entry: Entry) {
        const observation = entry.kind === "observation";
        const originalUncertainty = entry.details.original_uncertainty !== undefined ? entry.details.original_uncertainty : entry.details.uncertainty;
        return <details><summary>{entry.mode === "human" ? "Compare original question and correct" : "Compare original suggestion and correct"}</summary><blockquote className="model-original">{entry.mode === "human" ? "Original question" : "Original suggestion"}: {entry.original_text}</blockquote>
    {observation && <blockquote className="model-original">Original uncertainty: {originalUncertainty ?? "Not recorded."}</blockquote>}
    <form className="stack" key={`${entry.id}-${entry.revision}`} onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const uncertainty = observation ? String(data.get("uncertainty")) : undefined;
        void review(entry, "corrected", String(data.get("text")),
            uncertainty !== (entry.details.uncertainty ?? "") ? uncertainty : undefined);
    }}>
      <label>Corrected {entry.kind}<textarea name="text" defaultValue={entry.text} required maxLength={2000}/></label>
      {observation && <label>Current uncertainty explanation<textarea name="uncertainty" defaultValue={entry.details.uncertainty ?? ""} required={entry.details.uncertainty !== undefined} maxLength={2000}/></label>}
      <button disabled={busy || entry.review_state === "rejected"}>Save correction</button></form>
    {(observation || entry.kind === "question") && entry.revision > 1 && <details><summary>Previous {entry.kind} revisions</summary>{Array.from({ length: entry.revision - 1 }, (_, index) => <EvidenceReference key={`${index + 1}-${entry.revision}-${entry.evidence_validity}`} workspace={workspace} id={entry.id} revision={index + 1}/>)}</details>}</details>;
    }
    return <div className="investigation">
    <div className="research-toolbar"><label>Suggestion provider<select value={mode} onChange={(e) => setMode(e.target.value as ProviderMode)} disabled={busy}><option value="fixture">FIXTURE · authored examples</option><option value="replay">REPLAY · saved live response</option><option value="meta-live">META-LIVE · approval required</option></select></label>
      <button className="secondary" disabled={busy} onClick={() => void load()}>Reload saved investigation</button></div>
    <p className="provider-notice">{mode === "fixture" ? "FIXTURE: authored software examples. No image understanding or Meta call is performed." : mode === "replay" ? "REPLAY: requires a matching saved live response. No new inference is performed." : "META-LIVE: synthetic inputs and a verified, bounded allowance are required. Failures never switch to fixture."}</p>
    {mode === "replay" && <label>Saved live run ID<input value={replayId} onChange={(e) => setReplayId(e.target.value)}/></label>}
    {error && <div role="alert" className="error">{error} <Link href="/login">Sign in</Link></div>}
    <p role="status" className="save-status">{notice}</p>
    {!snapshot ? <p>Waiting for the private collection…</p> : <>
      <div className="research-grid"><section className="source-desk"><div className="section-line"><h2>01 / Look closely</h2><span>Select one record to observe, two to compare.</span></div>
        <div className="source-grid">{assets.map((asset) => {
                const r = currentRevision(asset.id);
                return <article className={`source-card ${selected.includes(asset.id) ? "is-selected" : ""}`} key={asset.id}>
          <label className="source-choice"><input type="checkbox" checked={selected.includes(asset.id)} disabled={busy || (!selected.includes(asset.id) && selected.length === 2)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, asset.id] : old.filter((id) => id !== asset.id))}/>{r?.title ?? "Untitled record"}</label>
          {r?.content !== null && r?.content !== undefined ? <blockquote>{r.content}</blockquote> : <PrivateImage assetId={asset.id} revision={asset.active_revision} title={r?.title ?? "Source original"} className="original" zoom/>}<p className="muted">Original · revision {asset.active_revision}</p>
        </article>;
            })}</div>
        {!assets.length && <p>Add a photograph or typed note in Archive to begin.</p>}
        {mode === "meta-live" && <p className="muted">The original stays unchanged. A separate image is oriented, stripped of metadata and fitted within 2048 pixels without enlargement, using lossless PNG encoding. Review small lettering against the original. Images exceeding the app’s 8 MiB prepared-input limit are rejected before any model call.</p>}
        <div className="actions"><button disabled={busy || selected.length !== 1} onClick={() => void analyse("observe")}>Suggest observations</button><button disabled={busy || selected.length !== 2} onClick={() => void analyse("compare")}>Compare selected records</button></div>
      </section><section className="evidence-desk"><h2>Observation notebook</h2><p>Compare every reading with its original.</p>
        {entries.filter((e) => e.kind === "observation").map((entry) => <article className="evidence-card" key={entry.id}>{entryHeader(entry)}<p>{entry.text}</p><p className="muted">{entry.details.locator} · {entry.details.uncertainty}</p>{sourceLinks(entry)}{correction(entry)}
          <div className="actions"><button disabled={busy || entry.review_state === "rejected" || entry.evidence_validity !== "current" || entry.review_state === "accepted_for_inquiry"} onClick={() => void review(entry, "accepted_for_inquiry")}>Ask about this clue</button><button className="secondary" disabled={busy || entry.review_state === "rejected"} onClick={() => void review(entry, "rejected")}>Reject observation</button></div>
          {entry.review_state === "accepted_for_inquiry" && entry.evidence_validity === "current" && <div className="clue-inquiry"><p>This clue is a starting point, not confirmed history. Ask about it without assuming who, when or why.</p>
            <button disabled={busy || alreadyInquired(entry)} onClick={() => void inquire(entry)}>Suggest questions about this clue</button>
            {alreadyInquired(entry) && <p className="muted">Question request saved for this clue revision. An empty result is valid; you can write your own question below.</p>}
            <HumanQuestionForm key={`${entry.id}-${entry.revision}`} entry={entry} busy={busy} save={mutate}/></div>}
        </article>)}
      </section></div>
      <section className="investigation-section"><div className="section-line"><h2>02 / A question worth asking</h2><span>Start from one visible clue or a tentative connection.</span></div>
        {entries.filter((e) => e.kind === "hypothesis").map((entry) => <article className="evidence-card" key={entry.id}>{entryHeader(entry)}<h3>{entry.details.outcome === "no_connection" ? "No supported connection" : "Connection hypothesis"}</h3><p>{entry.text}</p>
          <div className="evidence-columns"><div><h4>Supporting evidence</h4>{entry.details.supports?.length ? entry.details.supports.map((s, i) => <p key={i}>{s.detail}</p>) : <p>None supplied.</p>}</div><div><h4>Contrary evidence</h4>{entry.details.contradicts?.length ? entry.details.contradicts.map((s, i) => <p key={i}>{s.detail}</p>) : <p>None supplied. This does not establish the hypothesis.</p>}</div><div><h4>Still unknown</h4>{entry.details.unknowns?.map((s) => <p key={s}>{s}</p>)}</div></div>
          {sourceLinks(entry)}{correction(entry)}<div className="actions"><button disabled={busy || entry.review_state === "rejected" || (entry.review_state === "accepted_for_inquiry" && entry.evidence_validity === "current")} onClick={() => void review(entry, "accepted_for_inquiry")}>Use for inquiry</button><button className="secondary" disabled={busy || entry.review_state === "rejected"} onClick={() => void review(entry, "rejected")}>Reject hypothesis</button></div>
          {!entries.some((q) => q.kind === "question" && q.mode !== "human" && q.parents.some((p) => p.id === entry.id)) && <p className="muted">No questions were supplied with this hypothesis.</p>}
          {entry.review_state === "accepted_for_inquiry" && entry.evidence_validity === "current"
            ? <HumanQuestionForm key={`${entry.id}-${entry.revision}`} entry={entry} busy={busy} save={mutate}/>
            : entry.review_state !== "rejected" && <p className="muted">Choose Use for inquiry after reviewing the evidence to write your own question.</p>}
        </article>)}
        {entries.filter((e) => e.kind === "question").map((entry) => <article className="question-card" key={entry.id}>{entryHeader(entry)}<h3>{entry.text}</h3>{sourceLinks(entry)}{correction(entry)}<button disabled={busy || entry.review_state === "rejected"} onClick={() => void review(entry, "selected")}>Select question</button>
          {entry.review_state === "selected" && <><ConversationGuide question={entry.text} questionRevision={entry.revision} origin={entry.mode === "human" ? "Human-authored question" : entry.mode === "fixture" ? "Authored fixture question · software example" : "Recorded model question"} sources={exportSources(entry)} disabled={busy || entry.evidence_validity !== "current"}/>
          {entry.evidence_validity !== "current" && <p className="notice">Review the changed question and its sources before using it for a conversation or recording another response.</p>}
          <TestimonyForm entry={entry} busy={busy || entry.evidence_validity !== "current"} save={mutate}/></>}
        </article>)}
      </section>
      <section className="investigation-section"><div className="section-line"><h2>03 / Keep the words and their sources</h2><span>Testimony is attributed, not independently verified.</span></div>
        {entries.filter((e) => e.kind === "testimony").map((entry) => <article className="evidence-card" key={entry.id}>{entryHeader(entry)}<h3>{entry.details.speaker}</h3><p>{entry.details.response?.replaceAll("_", " ")} · {entry.details.source_mode?.replaceAll("_", " ")}</p><blockquote>{entry.text || "No answer recorded."}</blockquote><p className="muted">Recorder: signed-in record keeper ({entry.details.recorder})</p>{sourceLinks(entry)}<details><summary>Correct testimony</summary><TestimonyForm entry={entries.find((e) => e.id === entry.parents[0]?.id)!} previous={entry} busy={busy} save={mutate}/></details></article>)}
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate({ action: "exhibit", title: data.get("title"), testimony_ids: data.getAll("testimony") }); }}><h3>Compose a small exhibit</h3><label>Exhibit title<input name="title" required maxLength={160}/></label>
          {entries.filter((e) => e.kind === "testimony").map((entry) => <label className="source-choice" key={entry.id}><input type="checkbox" name="testimony" value={entry.id} disabled={entry.evidence_validity !== "current"}/>{entry.details.speaker} · {entry.details.response}</label>)}<button disabled={busy}>Save exhibit</button></form>
        <div className="exhibit-grid">{entries.filter((e) => e.kind === "exhibit").map((entry) => <article className="exhibit-card" key={entry.id}>{entryHeader(entry)}<h2>{entry.details.title}</h2>
          <div className="exhibit-photographs">{entry.sources.map((s) => {
            const r = snapshot.archive.revisions.find((r) => r.asset_id === s.asset_id && r.revision === s.revision);
            return r?.content === null && assets.some((a) => a.id === s.asset_id) ? <figure key={s.asset_id}><PrivateImage assetId={s.asset_id} revision={s.revision} title={r.title} className="original" zoom/><figcaption>{r.title} · source revision {s.revision}</figcaption></figure> : null;
          })}</div>
          <blockquote>{entry.text}</blockquote><p className="muted">A collection of attributed words. Connections remain open to review.</p>{sourceLinks(entry)}<details><summary>Testimony sources</summary>{entry.parents.map((p) => { const t = entries.find((e) => e.id === p.id); return <p key={p.id}>{t?.details.speaker ?? "Missing testimony"} · quoted revision {p.revision} · {t?.mode ?? "unavailable"}</p>; })}</details>
          <DownloadNotes filename="trace-and-tell-exhibit.txt" disabled={busy || entry.evidence_validity !== "current"} text={() => exhibitNotes({ sample: false, title: entry.details.title ?? "Untitled exhibit", text: entry.text, revision: entry.revision, sources: exportSources(entry), validity: entry.evidence_validity })}>Download exhibit text</DownloadNotes>
          {entry.evidence_validity !== "current" && <p className="muted">Review and update the exhibit before downloading its text.</p>}</article>)}</div>
      </section>
      <details className="run-register"><summary>Analysis run register</summary>{snapshot.runs.map((run) => <p key={run.id}>{run.mode} · {run.model} · {run.status} · {run.error ?? run.created_at} <code>{run.id}</code></p>)}</details>
    </>}
  </div>;
}
function HumanQuestionForm({ entry, busy, save }: {
    entry: Entry;
    busy: boolean;
    save: (action: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
    const [text, setText] = useState("");
    return <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault();
        if (await save(entry.kind === "observation" ? { action: "ask_clue", clue_id: entry.id, clue_revision: entry.revision, text } : { action: "ask", hypothesis_id: entry.id, hypothesis_revision: entry.revision, text }))
            setText("");
    }}>
      <label>Your question<textarea value={text} onChange={(event) => setText(event.target.value)} required maxLength={2000} disabled={busy}/></label>
      <p className="muted">Ask an open question without assuming a person, date, event or connection. Your words will be labelled as human-authored.</p>
      <button disabled={busy || !text.trim()}>Save my question</button>
    </form>;
}
function TestimonyForm({ entry, previous, busy, save }: {
    entry: Entry;
    previous?: Entry;
    busy: boolean;
    save: (action: Record<string, unknown>) => Promise<unknown>;
}) {
    if (!entry)
        return <p className="error">The source question is missing.</p>;
    return <form className="panel stack" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void save({ action: "testify", question_id: entry.id, speaker: data.get("speaker"), response: data.get("response"), source_mode: data.get("source_mode"), text: data.get("text"), ...(previous ? { id: previous.id, entry_revision: previous.revision } : {}) }); }}>
    <h4>Record a response</h4><label>Speaker label<input name="speaker" required maxLength={100} defaultValue={previous?.details.speaker}/></label>
    <label>Response type<select name="response" defaultValue={previous?.details.response ?? "answered"}><option value="answered">Answered</option><option value="unknown">Does not remember</option><option value="declined">Chose not to answer</option><option value="conflicting">Conflicts with another account</option></select></label>
    <label>How this was recorded<select name="source_mode" defaultValue={previous?.details.source_mode ?? "heard_directly"}><option value="heard_directly">Heard directly</option><option value="reported">Reported by someone else</option></select></label>
    <label>Their words<textarea name="text" maxLength={4000} defaultValue={previous?.text ?? ""}/></label><p className="muted">The signed-in record keeper is recorded separately from the speaker.</p><button disabled={busy}>Save testimony</button>
  </form>;
}
