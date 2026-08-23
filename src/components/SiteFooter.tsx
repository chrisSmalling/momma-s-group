import Link from "next/link";

// Rendered explicitly on public pages (login, terms, privacy) — not in the
// root layout, since the fixed bottom tab bar (Nav.tsx) replaces it for
// signed-in users and the two would otherwise collide. Signed-in users
// reach these same links from Settings instead.
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Momma&apos;s Meetup · Local family activities, together.</p>
        <nav aria-label="Site" className="flex flex-wrap gap-4">
          <Link className="hover:text-zinc-900" href="/privacy">Privacy</Link>
          <Link className="hover:text-zinc-900" href="/terms">Terms</Link>
          <Link className="hover:text-zinc-900" href="/account/delete">Delete account</Link>
        </nav>
      </div>
    </footer>
  );
}
