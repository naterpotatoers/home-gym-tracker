"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/programs", label: "Programs" },
  { href: "/routines", label: "Routines" },
  { href: "/metrics", label: "Metrics" },
  { href: "/workout", label: "Start Workout" },
  { href: "/library", label: "Library" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-current/10">
      <nav className="mx-auto flex max-w-5xl items-baseline gap-5 overflow-x-auto px-6 py-3 font-sans text-sm">
        <Link href="/" className="mr-2 font-bold tracking-tight">
          Home Gym
        </Link>
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap ${
              pathname === href || pathname.startsWith(`${href}/`)
                ? "font-semibold"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
