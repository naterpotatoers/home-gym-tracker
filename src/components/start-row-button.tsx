"use client";

import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui";

/** Per-row quick-start: checks only this client, then submits the outer form.
 *  Pass `href` instead to render as a navigation link (e.g. resume board). */
export function StartRowButton({
  clientId,
  isResume,
  href,
  className = "",
}: {
  clientId?: string;
  isResume: boolean;
  href?: string;
  className?: string;
}) {
  const label = isResume ? "Resume" : "Start";
  const sharedClass =
    `inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-xs font-semibold min-h-9 hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`;

  if (href) {
    return (
      <Link href={href} className={sharedClass}>
        <PlayIcon size={14} /> {label}
      </Link>
    );
  }

  return (
    <Button
      type="submit"
      form="workout-form"
      variant={isResume ? "secondary" : "primary"}
      size="sm"
      className="shrink-0"
      onClick={() => {
        const form = document.getElementById("workout-form") as HTMLFormElement | null;
        if (!form) return;
        form
          .querySelectorAll<HTMLInputElement>('input[name^="include_"]')
          .forEach((cb) => {
            cb.checked = cb.name === `include_${clientId}`;
          });
      }}
    >
      <PlayIcon size={14} /> {label}
    </Button>
  );
}
