/** Tiny display formatters shared across pages and components. */

/** "185 lb" / "12,340 lb" — rounded, locale-grouped. */
export function lbs(value: number): string {
  return `${Math.round(value).toLocaleString()} lb`;
}

/** Em-dash for missing values, formatter for present ones. */
export function dash(
  value: number | null | undefined,
  format: (value: number) => string = String,
): string {
  return value === null || value === undefined ? "—" : format(value);
}

/** The message out of an unknown thrown value — server actions throw real
 *  Errors; anything else gets the fallback. */
export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
