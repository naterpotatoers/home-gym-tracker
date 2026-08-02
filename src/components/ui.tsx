/**
 * The app's visual vocabulary: borders and fills are opacity blends of
 * `currentColor` (current/10, current/20) rather than named colors, so every
 * piece adapts to light and dark without a theme system. Numbers are mono.
 */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 border-b border-current/20 pb-1 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      className={`py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide opacity-60 ${
        numeric ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

export function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td className={`py-1.5 pr-3 ${numeric ? "text-right font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-60">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed opacity-60">{children}</p>;
}

/** Small inline tag — modality names, statuses, "trainer". */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs font-normal">
      {children}
    </span>
  );
}

/** Shown while the database tables don't exist yet. */
export function SeedBanner() {
  return (
    <p className="mb-6 rounded border border-current/20 bg-current/5 px-3 py-2 text-xs opacity-80">
      Running read-only from seed data — the Supabase tables don&apos;t exist
      yet. Run the migration, then seed at{" "}
      <a href="/dev/seed" className="underline">
        /dev/seed
      </a>
      . Saving anything will fail until then.
    </p>
  );
}
