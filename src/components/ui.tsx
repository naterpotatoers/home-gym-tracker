/**
 * The app's visual vocabulary: semantic tokens from globals.css (surface,
 * border, muted, blue accent family, success/warning/danger status colors).
 * Controls sit on `bg-surface-input` at text-base — 16px keeps iOS Safari
 * from zooming on focus — with ≥44px touch targets (h-11/size-11) and
 * focus-visible rings. `currentColor` blends survive only as hover washes
 * on neutral elements. Numbers are mono.
 */

/** Base classes for text controls. `size="sm"` (h-9) is an escape hatch for
 *  dense desktop-only table cells — never for primary touch flows. */
export const inputClass =
  "rounded-md border border-border-strong bg-surface-input text-base " +
  "text-foreground placeholder:text-muted/70 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent";

const inputSize = {
  md: "h-11 px-3",
  sm: "h-9 px-2",
} as const;

type ControlSize = keyof typeof inputSize;

export function Input({
  size = "md",
  align,
  className = "",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: ControlSize;
  align?: "right";
}) {
  return (
    <input
      {...props}
      className={`${inputClass} ${inputSize[size]} ${
        align === "right" ? "text-right font-mono" : ""
      } ${className}`}
    />
  );
}

/** Numeric field: null-safe value/onChange, decimal keypad on touch. */
export function NumberInput({
  value,
  onChange,
  min,
  step,
  size = "md",
  placeholder,
  className = "w-20",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  step?: number;
  size?: ControlSize;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      min={min}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={`${inputClass} ${inputSize[size]} text-right font-mono ${className}`}
    />
  );
}

export function Select({
  size = "md",
  className = "",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: ControlSize }) {
  return (
    <select
      {...props}
      className={`${inputClass} ${size === "md" ? "h-11 pl-3 pr-8" : "h-9 pl-2 pr-6"} ${className}`}
    />
  );
}

/** Labeled control wrapper. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

const buttonVariant = {
  primary: "border border-accent/50 text-accent-text hover:bg-accent/10",
  secondary: "border border-border-strong bg-surface hover:bg-current/5",
  ghost: "text-muted hover:text-foreground hover:bg-current/5",
  danger: "border border-danger/40 text-danger-text hover:bg-danger/10",
} as const;

export type ButtonVariant = keyof typeof buttonVariant;

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-semibold " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
}) {
  return (
    <button
      {...props}
      type={type}
      className={`${buttonBase} ${buttonVariant[variant]} ${
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-xs"
      } ${className}`}
    />
  );
}

/** Square button for steppers, remove-✕, arrows. md = 44px touch target;
 *  sm is for dense contexts like the group-board set rows. */
export function IconButton({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: "md" | "sm" }) {
  return (
    <button
      {...props}
      type={type}
      className={`${buttonBase} ${buttonVariant[variant]} ${
        size === "md" ? "size-11 text-lg" : "size-9 text-base"
      } ${className}`}
    />
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      {children}
    </div>
  );
}

/** Standard page wrapper — bottom padding clears the mobile tab bar. */
export function PageShell({
  className = "max-w-5xl",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={`mx-auto w-full px-4 py-6 pb-24 sm:px-6 sm:py-10 md:pb-10 ${className}`}>
      {children}
    </main>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** Optional control (e.g. a create form) rendered flex-end in the header. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Standard mobile-safe wrapper for wide tables — full-bleed scroll on phones. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>;
}

/** The app's selected/unselected chip-button vocabulary — tabs, filters,
 *  person switchers. */
export function chipClass(selected: boolean, extra = "min-h-10 px-3 text-xs"): string {
  return `inline-flex cursor-pointer items-center gap-1.5 rounded-md ${extra} ${
    selected
      ? "bg-accent-soft font-semibold text-accent-text"
      : "text-muted hover:bg-current/5 hover:text-foreground"
  }`;
}

/** Border tint for person-colored cards — one blend everywhere. */
export function clientBorderStyle(color: string | null): React.CSSProperties | undefined {
  return color
    ? { borderColor: `color-mix(in oklab, ${color} 50%, var(--border))` }
    : undefined;
}

export function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      className={`py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-muted ${
        numeric ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

export function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td className={`py-2 pr-3 ${numeric ? "text-right font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

export function Stat({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`font-mono text-xs ${valueClassName}`}>{value}</dd>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-muted">{children}</p>;
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
    <p className="mb-6 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
      Running read-only from seed data — the Supabase tables don&apos;t exist
      yet. Run the migration, then seed at{" "}
      <a href="/dev/seed" className="text-accent-text underline">
        /dev/seed
      </a>
      . Saving anything will fail until then.
    </p>
  );
}
