"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ColorDot, Select } from "@/components/ui";

export type PersonOption = { id: string; label: string; href: string };

/**
 * The Clients hub's title IS its person picker: a native select (the iPad
 * gets the system wheel) beside the selected person's color dot. Each option
 * carries a prebuilt progressHref, so switching keeps the current view and
 * the selection stays in the URL.
 */
export function PersonSwitcher({
  options,
  selectedId,
  color,
}: {
  options: PersonOption[];
  /** Empty while on the add-person pane — the select shows a placeholder. */
  selectedId: string;
  color: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={`flex min-w-0 items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <ColorDot color={selectedId ? color : null} size="lg" />
      <Select
        aria-label="Client"
        value={selectedId}
        onChange={(e) => {
          const href = options.find((o) => o.id === e.target.value)?.href;
          if (href) startTransition(() => router.push(href));
        }}
        // text-xl! — Select's base text-base would otherwise win by CSS order.
        className="min-w-0 max-w-64 text-xl! font-bold tracking-tight"
      >
        {!selectedId && (
          <option value="" disabled>
            Pick a client…
          </option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
