/**
 * Name normalization shared by the food and exercise catalogs — both guard
 * duplicates the same way.
 */

/** Display name cleanup: trimmed, single-spaced. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Case-insensitive comparison key — matches the DB's lower(name) unique
 *  indexes, so "exists already?" checks agree with what an insert would hit. */
export function nameKey(raw: string): string {
  return normalizeName(raw).toLowerCase();
}

/** Comma-separated alias text → clean, de-duplicated aliases (first spelling
 *  wins). Shared by the /exercises editor and its save action so the two
 *  agree on what was typed. */
export function parseAliases(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const alias = normalizeName(raw);
    const key = nameKey(alias);
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out;
}
