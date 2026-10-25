/** PostgREST caps every response (Supabase's default `max_rows` is 1000) and
 *  truncates silently, so whole-table reads must page. Pages are requested
 *  until one comes back short; the caller's ORDER BY must be total (end on a
 *  unique key) or rows can repeat/skip across page boundaries. */
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
