"use client";
import { useState } from "react";
import { conversationNotes, type ExportSource } from "@/lib/record-export";

export function DownloadNotes({ filename, text, children, disabled = false }: {
  filename: string; text: () => string; children: React.ReactNode; disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  function download() {
    if (disabled) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([text()], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = filename; link.click();
      setMessage("Text copy prepared. Check your downloads; nothing was sent to anyone.");
    } catch { setMessage("The copy could not be prepared. Check the record and try again."); }
    finally { if (url) { const address = url; window.setTimeout(() => URL.revokeObjectURL(address), 1000); } }
  }
  return <div className="record-download"><button type="button" className="secondary" disabled={disabled} onClick={download}>{children}</button>{message && <p role="status" className="muted">{message}</p>}</div>;
}

export function ConversationGuide({ question, origin, sources, questionRevision, sample = false, disabled = false }: {
  question: string; origin: string; sources: readonly ExportSource[]; questionRevision?: number; sample?: boolean; disabled?: boolean;
}) {
  return <aside className="conversation-guide" aria-label="Prepare a conversation">
    <h4>Take one question to someone who might remember.</h4>
    <ol><li>Show the photograph and ask whether they want to talk about it.</li><li>Ask your question, then listen without suggesting the answer.</li><li>Keep their words and permission to share. Not remembering or declining is valid.</li></ol>
    <p>{sample ? "Try this with invented notes here. For your own collection, take the notes into a real conversation and return to record the response." : "Download a note sheet for the conversation, then return here to save their response. The sheet includes this question and its source revisions."}</p>
    <DownloadNotes filename="trace-and-tell-conversation.txt" disabled={disabled || !question.trim()} text={() => conversationNotes({ question, origin, sources, questionRevision, sample })}>Download conversation notes</DownloadNotes>
  </aside>;
}
