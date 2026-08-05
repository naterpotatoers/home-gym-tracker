/** Small stroke icons for inline action buttons and nav — one style.
 *
 * Action-icon vocabulary (use these everywhere, never ad-hoc glyphs):
 * - PlusIcon  = create / add something new
 * - CopyIcon  = duplicate an existing thing
 * - TrashIcon = delete / remove / discard
 * - PencilIcon = edit / replace
 * - PlayIcon  = start / launch a workout session (primary-variant button)
 * - SaveIcon  = persist a form ("Save …" buttons)
 * - CheckIcon = finish / complete something
 * - EyeIcon   = view / open a detail page
 * - ArrowLeftIcon = go back
 * - SwapIcon  = swap / replace an exercise
 */

export function iconProps(size = 18) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

export function PencilIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
    </svg>
  );
}

export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7M10 11v6M14 11v6" />
    </svg>
  );
}

export function CopyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9l5 3-5 3z" />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function ChartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </svg>
  );
}

export function ClipboardIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

export function PersonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

export function SaveIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7V3M7 21v-7h10v7" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M4 12.5l5.5 5.5L20 6.5" />
    </svg>
  );
}

export function SwapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M4 8h13M14 4.5L17.5 8 14 11.5M20 16H7M10 12.5L6.5 16l3.5 3.5" />
    </svg>
  );
}

export function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function DumbbellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden>
      <path d="M7 6.5v11M3.5 9.5v5M17 6.5v11M20.5 9.5v5M7 12h10" />
    </svg>
  );
}
