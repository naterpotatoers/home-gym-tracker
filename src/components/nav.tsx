"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconProps } from "@/components/icons";

const LINKS = [
  { href: "/programs", label: "Plan", short: "Plan", icon: CalendarIcon },
  { href: "/metrics", label: "Progress", short: "Progress", icon: ChartIcon },
  { href: "/workout", label: "Start Workout", short: "Workout", icon: PlayIcon },
  { href: "/users", label: "Users", short: "Users", icon: PersonIcon },
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

function CalendarIcon() {
  return (
    <svg {...iconProps(20)} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps(20)} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps(20)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9l5 3-5 3z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...iconProps(20)} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
