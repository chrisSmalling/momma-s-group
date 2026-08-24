"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const links = [
  ["/today", "Today", "☀️"],
  ["/places", "Explore", "🧭"],
  ["/calendar", "Calendar", "📅"],
  ["/groups", "Groups", "👋"],
  ["/settings", "Me", "🙂"],
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/today" && pathname.startsWith(`${href}/`));
}

export default function Nav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm backdrop-blur">
        <Link href="/today" className="shrink-0" aria-label="Momma's Meetup home">
          <div className="font-display text-base font-bold tracking-tight text-zinc-950">Momma&apos;s Meetup</div>
          <div className="hidden text-[11px] font-medium text-zinc-400 sm:block">Find something worth doing. See who&apos;s in.</div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-xs text-zinc-500 lg:block" title={email}>{email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* Fixed bottom tab bar — position: fixed, so pages need bottom
          clearance (see .has-tabbar in globals.css / (app)/layout.tsx).
          env(safe-area-inset-bottom) covers the iOS home-indicator area. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {links.map(([href, label, emoji]) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex min-h-11 flex-col items-center gap-0.5 py-2 text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
                    : "flex min-h-11 flex-col items-center gap-0.5 py-2 text-zinc-500 transition hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
                }
              >
                <span aria-hidden="true" className="text-lg leading-none">{emoji}</span>
                <span className={active ? "text-[11px] font-bold" : "text-[11px] font-semibold"}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
