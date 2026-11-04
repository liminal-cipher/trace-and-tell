import { describe, expect, it } from "vitest";
import { conversationNotes, exhibitNotes } from "../src/lib/record-export";
describe("portable conversation and exhibit notes", () => {
  it("preserves the chosen question and historical revision without serialising private source fields", () => {
    const source = { title: "Family table", revision: 2, storage_key: "private-storage-key", signed_url: "https://private.invalid/token", recorder: "private-recorder" };
    const text = conversationNotes({ sample: false, question: "What do you remember?\nIt is okay not to know.", origin: "Human-authored", questionRevision: 4, sources: [source] });
    expect(text).toContain("> What do you remember?\n> It is okay not to know.");
    expect(text).toContain("question revision 4"); expect(text).toContain("source revision 2");
    expect(text).not.toMatch(/private-storage-key|private\.invalid|private-recorder/);
    expect(text).toContain("chose not to answer"); expect(text).toContain("Heard directly or reported");
  });
  it("does not turn practice words into historical testimony or accept a blank question", () => {
    const context = { sample: true, sources: [{ title: "Public photograph", revision: 1 }] };
    expect(conversationNotes({ ...context, question: "A question", origin: "Recorded Meta question" })).toContain("FICTIONAL PUBLIC PRACTICE");
    expect(() => conversationNotes({ ...context, question: " \n", origin: "Human" })).toThrow("Choose a question");
  });
  it.each(["needs_review", "invalidated"] as const)("refuses a %s exhibit", validity => {
    expect(() => exhibitNotes({ sample: false, sources: [], title: "Earlier story", text: "Earlier words", validity })).toThrow("Review the changed evidence");
  });
  it("keeps attributed words literal and distinguishes a text copy from the complete archive", () => {
    const text = exhibitNotes({ sample: false, sources: [{ title: "Two\nlines", revision: 3 }], title: "A record", text: "Speaker: Does not remember.\n<script>example</script>", revision: 2, validity: "current" });
    expect(text).toContain("> Speaker: Does not remember.\n> <script>example</script>");
    expect(text).toContain("Two lines · source revision 3"); expect(text).toContain("not the complete revision archive");
  });
});
