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

/** Clean entries (normalizeName), empties and case-insensitive repeats
 *  dropped — first spelling wins, order kept. */
function uniqueNames(list: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const clean = normalizeName(raw);
    const key = nameKey(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/** Comma-separated alias text → clean, de-duplicated aliases. Shared by the
 *  /exercises editor and its save action so the two agree on what was
 *  typed. */
export function parseAliases(text: string): string[] {
  return uniqueNames(text.split(","));
}

/** Cue inputs → the cues to save, cleaned the same way. */
export function parseCues(lines: readonly string[]): string[] {
  return uniqueNames(lines);
}
