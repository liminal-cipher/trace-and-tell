import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof ZodError
        ? 400
        : 500;
  const message =
    error instanceof AppError
      ? error.message
      : error instanceof ZodError
        ? "Check the required fields and file limits."
        : "The operation could not be completed. Retry safely.";
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function checkOrigin(request: Request) {
  const allowed = process.env.APP_ORIGIN;
  if (!allowed || request.headers.get("origin") !== new URL(allowed).origin)
    throw new AppError(403, "This request origin is not allowed.");
}
export async function readJson(
  request: Request,
  limit = 100_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError(415, "Send JSON for this request.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "The request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(400, "The request is not valid JSON.");
  }
}
export function databaseError(error: { message: string } | null) {
  if (!error) return;
  const messages: Record<string, [number, string]> = {
    not_found: [404, "This record is unavailable."],
    revision_conflict: [
      409,
      "This record changed in another window. Reload before saving your edits.",
    ],
    idempotency_conflict: [
      409,
      "This retry key belongs to a different request.",
    ],
    photo_limit: [
      409,
      "This workspace has reached its limit of 20 photos or pending uploads.",
    ],
    intent_expired: [
      410,
      "The upload permission expired. Choose the file again.",
    ],
    intent_rejected: [
      422,
      "This upload was rejected. Choose a valid file again.",
    ],
    invalid_input: [400, "The record is invalid."],
  };
  const match = Object.keys(messages).find((key) =>
    error.message.includes(key),
  );
  if (match) throw new AppError(...messages[match]);
  throw new AppError(
    503,
    "Storage is unavailable or its schema has not been configured. Your changes have not been confirmed.",
  );
}
