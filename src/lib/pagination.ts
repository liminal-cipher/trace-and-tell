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
  for (let offset = 0; ; ) {
    const result = await page(offset, offset + size - 1);
    databaseError(result.error);
    const batch = result.data ?? [];
    if (!batch.length) return rows;
    rows.push(...batch);
    // A project can cap responses below our requested range. A short page
    // therefore does not prove exhaustion; advance by what actually arrived.
    offset += batch.length;
  }
}
