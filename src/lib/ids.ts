/** New-record ids keep the readable-slug convention: a short prefix says what
 *  the row is, a random suffix keeps it unique without a counter. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/** For rows the user names (routines, programs): the name is the readable part
 *  and a short suffix guards against rename collisions. */
export function slugId(prefix: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${prefix}_${slug || "untitled"}_${crypto.randomUUID().slice(0, 4)}`;
}
