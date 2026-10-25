"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ClipboardIcon, DumbbellIcon, PersonIcon, PlayIcon } from "@/components/icons";
import { chipClass } from "@/components/ui";

// Workout first: the launcher at / is why the app gets opened. /workout/*
// (session runner, board, per-person week) lights it too.
const LINKS = [
  { href: "/", also: ["/workout"], label: "Workout", short: "Workout", icon: PlayIcon },
  { href: "/programs", also: ["/routines"], label: "Plan", short: "Plan", icon: CalendarIcon },
  { href: "/exercises", label: "Library", short: "Library", icon: ClipboardIcon },
  { href: "/users", label: "Clients", short: "Clients", icon: PersonIcon },
] as const;

/** Hidden during a live workout — see "Focus mode" in globals.css. */
export function Nav() {
  const pathname = usePathname();
  const matches = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
  const isActive = (link: (typeof LINKS)[number]) =>
    matches(link.href) || ("also" in link && link.also.some(matches));

  return (
    <>
      {/* Top bar: brand always; links only md+. Sticky so the app always has
          its bearings, with a blur so content sliding under stays legible. */}
      <header data-app-nav className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
          <Link
            href="/"
            className="mr-2 inline-flex min-h-11 items-center gap-2 rounded-md text-base font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <DumbbellIcon size={18} />
            </span>
            Nates Gym
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${chipClass(isActive(link), "min-h-11 px-3 text-sm")} whitespace-nowrap`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Bottom tab bar below md — solid surface with a strong border and an
          upward shadow so it clearly separates from page content (a translucent
          blur made it blend into the page), and the active tab gets a filled
          accent pill. */}
      <nav data-app-nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-8px_var(--shadow)] md:hidden">
        <div className="mx-auto flex max-w-lg">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                  active ? "font-semibold text-accent-text" : "font-medium text-muted"
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-1 ${
                    active ? "bg-accent text-accent-fg" : ""
                  }`}
                >
                  <Icon size={20} />
                </span>
                {link.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

