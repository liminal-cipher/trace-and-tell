// Manually curated public excerpts; never load private runs or environment data.
// Evidence selection and content hashes: docs/submission-readiness.md.
export const demoEvidence = {
  note: "ORBIT 47\nBLUE TICKET",
  observation: "Dark rectangular card with light border bearing the text 'ORBIT 47', 'ADMIT ONE', 'BLUE TICKET' separated by a horizontal line.",
  originalUncertainty: "Background color description uncertain from image compression.",
  correctedUncertainty: "The exact colour and the cause of colour uncertainty cannot be established from the current source material. Image compression is not a verified cause.",
  connection: "Both records show the strings ORBIT 47 and BLUE TICKET.",
  supports: ["Visible text reads ORBIT 47 and BLUE TICKET", "Supplied content reads ORBIT 47 and BLUE TICKET"],
  unknown: "Whether the records refer to the same physical item is not shown by the supplied data",
  question: "What do you know about the markings ORBIT 47 and BLUE TICKET?",
  testimony: "I don’t know where these records came from. The words look familiar, but I cannot say whether they belong together.",
} as const;
