// Retain each unresolved operation across interleaved form submissions. Never
// persist private payloads or keys to browser storage.
export function createRetryKeys() {
  const pending = new Map<string, string>();
  return {
    forPayload(payload: object) {
      const signature = JSON.stringify(payload);
      const key = pending.get(signature) ?? crypto.randomUUID();
      pending.set(signature, key);
      return key;
    },
    confirmed(payload: object) {
      pending.delete(JSON.stringify(payload));
    },
    clear() {
      pending.clear();
    },
  };
}
