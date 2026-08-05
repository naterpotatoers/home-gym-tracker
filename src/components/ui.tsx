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
      // Native spinners are hidden — they'd eat the narrow field's width, and
      // every numeric flow has its own +/- steppers or touch keypad.
      className={`${inputClass} ${inputSize[size]} text-right font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
    />
  );
}

/** NumberInput flanked by −/+ steppers — the iPad-friendly way to nudge small
 *  prescriptions (sets, reps, rest). Not for weights: they vary too much for
 *  ±step taps to help. Typing stays available; only the buttons clamp. */
export function StepperInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  size = "md",
  className = "w-20",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: ControlSize;
  className?: string;
}) {
  function nudge(direction: 1 | -1) {
    const next = value === null ? min : value + direction * step;
    onChange(Math.min(max ?? Infinity, Math.max(min, next)));
  }
  return (
    <div className="flex items-center gap-1">
      <IconButton
        size={size}
        onClick={() => nudge(-1)}
        disabled={value !== null && value <= min}
        aria-label="Decrease"
      >
        −
      </IconButton>
      <NumberInput
        value={value}
        onChange={onChange}
        min={min}
        step={step}
        size={size}
        className={className}
      />
      <IconButton
        size={size}
        onClick={() => nudge(1)}
        disabled={max !== undefined && value !== null && value >= max}
        aria-label="Increase"
      >
        +
      </IconButton>
    </div>
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

/** Styled checkbox: sr-only native input (forms, form-state selectors, and
 *  label-click toggling all keep working) behind an accent-filled box with an
 *  animated check. CSS-only, so it renders from server components. */
export function Checkbox({
  className = "",
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "size">) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <input type="checkbox" {...props} className="peer sr-only" />
      <span
        aria-hidden
        className="flex size-6 cursor-pointer items-center justify-center rounded-md border-2 border-border-strong bg-surface-input text-transparent transition-colors duration-150 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5l5.5 5.5L20 6.5" />
        </svg>
      </span>
    </span>
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
  /* Warm-accent outline: the "do the thing" button — one per view, pops. */
  primary:
    "border border-accent-warm/60 text-accent-warm-text hover:bg-accent-warm/10",
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

/** Summary row for a `<details className="group">` disclosure — pair with
 *  `<Caret />` as its first child. `extra` carries the padding/rounding that
 *  differs per context. */
export function summaryClass(extra = "px-4 py-2"): string {
  return `flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 hover:bg-current/5 [&::-webkit-details-marker]:hidden ${extra}`;
}

/** Open/closed indicator for disclosure summaries — CSS-only via group-open. */
export function Caret() {
  return (
    <>
      <span className="text-[10px] text-muted group-open:hidden">▸</span>
      <span className="hidden text-[10px] text-muted group-open:inline">▾</span>
    </>
  );
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

const dotSize = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
} as const;

/** Identity dot — person card colors and muscle-group hues. Renders nothing
 *  when there's no color, so call sites don't need the `color &&` dance. */
export function ColorDot({
  color,
  size = "sm",
  title,
}: {
  color: string | null | undefined;
  size?: keyof typeof dotSize;
  title?: string;
}) {
  if (!color) return null;
  return (
    <span
      className={`${dotSize[size]} shrink-0 rounded-full`}
      style={{ backgroundColor: color }}
      title={title}
    />
  );
}

/** Recap line treatment for a logged set: completed dims slightly, a skipped
 *  set is struck through — same reading on the session page and the
 *  recent-workouts accordion. */
export function recapSetClass(completed: boolean): string {
  return completed ? "opacity-80" : "text-muted line-through decoration-current/40";
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

/** Inline action-failure message — always paired with the failing control. */
export function ErrorText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-danger-text">{children}</span>;
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
      yet. Run supabase/schema.sql in the Supabase SQL editor, then add people
      at{" "}
      <a href="/users" className="text-accent-text underline">
        /users
      </a>
      . Saving anything will fail until then.
    </p>
  );
}
