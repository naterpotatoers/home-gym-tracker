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
