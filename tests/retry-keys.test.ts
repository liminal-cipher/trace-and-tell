import { expect, it } from "vitest";
import { createRetryKeys } from "@/lib/retry-keys";
it("retains an unknown-outcome request key across unrelated successful operations", () => {
  const retry = createRetryKeys();
  const note = { action: "save_note", content: "Synthetic" };
  const rename = { action: "rename_workspace", name: "New name" };
  const first = retry.forPayload(note);
  expect(retry.forPayload(rename)).not.toBe(first);
  retry.confirmed(rename);
  expect(retry.forPayload(note)).toBe(first);
  retry.confirmed(note);
  expect(retry.forPayload(note)).not.toBe(first);
  retry.clear();
});
