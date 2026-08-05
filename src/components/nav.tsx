"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, DumbbellIcon, PersonIcon, PlayIcon } from "@/components/icons";

const LINKS = [
  { href: "/programs", label: "Plan", short: "Plan", icon: CalendarIcon },
  { href: "/workout", label: "Workout", short: "Workout", icon: PlayIcon },
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
                  className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-3 ${
                    isActive(link)
                      ? "bg-accent-soft font-semibold text-accent-text"
                      : "text-muted hover:bg-current/5 hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Bottom tab bar below md — active tab gets a soft pill behind its icon. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium ${
                  active ? "text-accent-text" : "text-muted"
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-0.5 ${
                    active ? "bg-accent-soft" : ""
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

