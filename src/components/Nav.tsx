"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

type NavIconName = "today" | "explore" | "calendar" | "groups" | "me";

const links: readonly [string, string, NavIconName][] = [
  ["/today", "Today", "today"],
  ["/places", "Explore", "explore"],
  ["/calendar", "Calendar", "calendar"],
  ["/groups", "Groups", "groups"],
  ["/settings", "Me", "me"],
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/today" && pathname.startsWith(`${href}/`));
}

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  return (
    <svg {...common} className={active ? "scale-105" : ""}>
      {name === "today" && <><path d="M12 3v2" /><path d="M5.64 5.64 7.05 7.05" /><path d="M3 12h2" /><path d="M17 12h4" /><path d="M16.95 7.05l1.41-1.41" /><path d="M6.5 16.5a6 6 0 1 1 11 0" /></>}
      {name === "explore" && <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>}
      {name === "calendar" && <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7 3v4M17 3v4M3.5 9h17" /><path d="M8 13h2M12 13h2M16 13h.01M8 17h2M12 17h2" /></>}
      {name === "groups" && <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5" /><path d="M14.5 15.5c2.8-.2 4.7 1.1 5.5 3.8" /></>}
      {name === "me" && <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" /></>}
    </svg>
  );
}

export default function Nav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm backdrop-blur">
        <Link href="/today" prefetch className="shrink-0" aria-label="Momma's Meetup home">
          <div className="font-display text-base font-bold tracking-tight text-zinc-950">Momma&apos;s Meetup</div>
          <div className="hidden text-[11px] font-medium text-zinc-400 sm:block">Find something worth doing. See who&apos;s in.</div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-xs text-zinc-500 lg:block" title={email}>{email}</span>
          <SignOutButton />
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/90 bg-white/95 shadow-[0_-8px_24px_rgba(42,26,31,0.06)] backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5 px-1">
          {links.map(([href, label, icon]) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 ${active ? "font-bold text-rose-600" : "font-semibold text-zinc-500 hover:text-zinc-800"}`}
              >
                {active && <span aria-hidden="true" className="absolute top-0 h-0.5 w-9 rounded-full bg-rose-600" />}
                <NavIcon name={icon} active={active} />
                <span className="text-[11px] leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
