"use client";
import { useState } from "react";
import type { Entry } from "@/lib/investigation-contracts";
export function EvidenceReference({ workspace, id, revision }: { workspace: string; id: string; revision: number }) {
  const [result,setResult]=useState<{entry:Entry|null;validity:string;historical:boolean}>();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function open() {
    setBusy(true);setError("");setResult(undefined);
    try {
      const response=await fetch(`/api/investigation/evidence?workspace=${workspace}&id=${id}&revision=${revision}`,{cache:"no-store"});
      if(!response.ok)throw new Error("This evidence revision could not be opened. Reload or sign in again.");
      setResult(await response.json());
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <div className="evidence-reference"><button className="secondary" disabled={busy} onClick={()=>void open()}>Open evidence revision {revision}</button>
    {error&&<p role="alert" className="error">{error}</p>}
    {result&&(result.entry ? <div><div className="eyebrow">{result.entry.kind} · {result.entry.mode} · revision {result.entry.revision}</div>
      <p>{result.historical?"Historical revision; a newer correction exists.":"Saved source revision."} · {result.validity.replaceAll("_"," ")}</p>
      <p>{result.entry.details.speaker??""}</p><blockquote>{result.entry.text||result.entry.details.response}</blockquote>
      {result.entry.kind==="observation"&&<p>Uncertainty: {result.entry.details.uncertainty??"Not recorded."}</p>}
      <p className="muted">{result.entry.details.recorder?`Recorder: ${result.entry.details.recorder}`:""}</p></div>:<p className="error">Broken source: its original is deleted or unavailable.</p>)}
  </div>;
}
