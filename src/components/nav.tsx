"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ClipboardIcon, DumbbellIcon, PersonIcon, PlayIcon } from "@/components/icons";
import { chipClass } from "@/components/ui";

const LINKS = [
  { href: "/programs", label: "Plan", short: "Plan", icon: CalendarIcon },
  { href: "/workout", label: "Workout", short: "Workout", icon: PlayIcon },
  { href: "/exercises", label: "Exercises", short: "Library", icon: ClipboardIcon },
  // People absorbed the Progress page; the heat map still lives under
  // /metrics, so that prefix lights this tab too.
  { href: "/users", also: ["/metrics"], label: "Clients", short: "Clients", icon: PersonIcon },
] as const;

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
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
          <Link
            href="/"
            className="mr-2 inline-flex items-center gap-2 py-1 text-base font-bold tracking-tight"
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
                  className={`${chipClass(isActive(link), "min-h-10 px-3 text-sm")} whitespace-nowrap`}
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-8px_rgb(0_0_0/0.25)] md:hidden">
        <div className="mx-auto flex max-w-lg">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${
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

