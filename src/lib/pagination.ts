import { databaseError } from "./errors";
// Supabase caps each Data API response. Never silently lose older records or
// cleanup jobs just because the default response limit has been reached.
export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const result = await page(offset, offset + size - 1);
    databaseError(result.error);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < size) return rows;
  }
}
