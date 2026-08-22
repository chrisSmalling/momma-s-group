"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const links = [
  ["/today", "Today"],
  ["/places", "Explore"],
  ["/calendar", "Calendar"],
  ["/groups", "Groups"],
  ["/settings", "Me"],
] as const;

export default function Nav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="mb-8 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm backdrop-blur sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/today" className="shrink-0" aria-label="Momma's Meetup home">
          <div className="text-base font-extrabold tracking-tight text-zinc-950">Momma&apos;s Meetup</div>
          <div className="hidden text-[11px] font-medium text-zinc-400 sm:block">Find something worth doing. See who&apos;s in.</div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-xs text-zinc-500 lg:block" title={email}>{email}</span>
          <SignOutButton />
        </div>
      </div>
      <nav aria-label="Primary" className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-zinc-100 p-1">
        {links.map(([href, label]) => {
          const active = pathname === href || (href !== "/today" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={active
                ? "rounded-lg bg-white px-2 py-2 text-center text-xs font-bold text-zinc-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                : "rounded-lg px-2 py-2 text-center text-xs font-semibold text-zinc-600 transition hover:bg-white hover:text-zinc-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
