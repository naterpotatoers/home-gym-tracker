"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/programs", label: "Programs", short: "Programs", icon: CalendarIcon },
  { href: "/routines", label: "Routines", short: "Routines", icon: ListIcon },
  { href: "/metrics", label: "Metrics", short: "Metrics", icon: ChartIcon },
  { href: "/workout", label: "Start Workout", short: "Workout", icon: PlayIcon },
  { href: "/library", label: "Library", short: "Library", icon: BookIcon },
] as const;

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Top bar: brand always; links only md+ */}
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
          <Link href="/" className="mr-2 py-2 font-bold tracking-tight">
            Home Gym
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap rounded-md px-2 py-2 ${
                  isActive(href)
                    ? "font-semibold text-accent-text"
                    : "text-muted hover:bg-current/5 hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Bottom tab bar below md */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg">
          {LINKS.map(({ href, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium ${
                isActive(href) ? "text-accent-text" : "text-muted"
              }`}
            >
              <Icon />
              {short}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

function CalendarIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9l5 3-5 3z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" />
    </svg>
  );
}
