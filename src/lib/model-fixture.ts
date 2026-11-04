import type { Analysis, ModelInput } from "./investigation-contracts";
// Deliberately authored examples, never represented as OCR or model inference.
export function fixtureAnalysis(input: ModelInput): Analysis {
    if (input.operation === "inquire")
        return { observations: [], connection: null, questions: ["What, if anything, do you remember about the detail you selected?"] };
    if (input.operation === "observe")
        return { observations: input.sources.map((s) => ({ asset_id: s.asset_id, revision: s.revision,
                claim: s.content ? `The typed note says: ${s.content.slice(0, 500)}` : "No automatic image reading is performed in fixture mode. Add your own reading after comparing the original.",
                locator: s.content ? "Typed note, whole record" : "Whole image; no verified location",
                uncertainty: "Authored software fixture. This is not a model finding or historical verification." })), connection: null, questions: [] };
    const shared = input.sources.every((s) => s.content?.includes("ORBIT 47") || input.observations.some((o) => o.text.includes("ORBIT 47") && o.sources.some((r) => r.asset_id === s.asset_id)));
    return { observations: [], connection: { outcome: shared ? "candidate" : "no_connection",
            statement: shared ? "Both records mention ORBIT 47. A shared reference is possible; a shared event is unverified." : "No supported connection is available in this authored fixture.",
            supports: shared ? input.sources.map(({ asset_id, revision }) => ({ asset_id, revision, detail: "The supplied reading mentions ORBIT 47; compare it with the original." })) : [],
            contradicts: [], unknowns: ["Who made these records, and whether they concern the same occasion, is unknown."] },
        questions: ["What, if anything, do you remember about these records?", "What seems similar or different to you, and what are you unsure about?"] };
}
