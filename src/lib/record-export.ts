export type ExportSource = { title: string; revision: number };
type Context = { sample: boolean; sources: readonly ExportSource[] };
const quote = (text: string) => text.split(/\r?\n/).map(line => `> ${line}`).join("\n");
const sourceList = (sources: readonly ExportSource[]) => sources.map(source =>
  `- ${source.title.replace(/[\r\n]+/g, " ")} · source revision ${source.revision}`).join("\n");
const scope = (sample: boolean) => sample
  ? "FICTIONAL PUBLIC PRACTICE — not testimony from the photographed people."
  : "PRIVATE COLLECTION — share this copy only with people you choose.";

export function conversationNotes(input: Context & { question: string; origin: string; questionRevision?: number }) {
  if (!input.question.trim()) throw new Error("Choose a question first.");
  return `TRACE & TELL — ONE PHOTO, ONE CONVERSATION\n\n${scope(input.sample)}\n\nQUESTION\n${quote(input.question)}\n${input.origin}${input.questionRevision ? ` · question revision ${input.questionRevision}` : ""}\n\nSOURCE REFERENCES\n${sourceList(input.sources)}\n\nBEFORE ASKING\nShow the original photo. Ask whether the person wants to talk about it.\nAsk the open question without suggesting an answer. It is okay to stop.\n\nCONVERSATION NOTES\nSpeaker label (only what they want recorded):\nWhen this conversation happened (not the photo date):\nTheir exact words:\n\nResponse: answered / does not remember / chose not to answer / conflicting account\nHeard directly or reported by someone else:\nWhat is still uncertain:\nWhat may be kept or shared, according to the speaker:\n\nAFTER THE CONVERSATION\nReturn to this question and record the response in Trace & Tell.\nKeep recollections attributed; they are not independently verified facts.\nThis file contains no original image, private URL or login credentials.\n`;
}

export function exhibitNotes(input: Context & { title: string; text: string; question?: string; revision?: number; validity: "current" | "needs_review" | "invalidated" }) {
  if (input.validity !== "current") throw new Error("Review the changed evidence before exporting.");
  return `TRACE & TELL — LIVING GALLERY\n\n${scope(input.sample)}\n\nTITLE\n${quote(input.title)}${input.revision ? `\nExhibit revision ${input.revision}` : ""}${input.question ? `\n\nQUESTION\n${quote(input.question)}` : ""}\n\nATTRIBUTED WORDS\n${quote(input.text)}\n\nSOURCE REFERENCES\n${sourceList(input.sources)}\n\nAn attributed recollection is not independently verified history.\nThis is a text copy, not the complete revision archive or original photograph.\nKeep the original collection to revisit its evidence and corrections.\n`;
}
