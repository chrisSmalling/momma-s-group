import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function Nav({ email }: { email: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-y-2">
      <nav className="flex flex-wrap gap-4 text-sm font-medium">
        <Link href="/calendar" className="text-zinc-700 hover:text-zinc-900">
          Calendar
        </Link>
        <Link href="/groups" className="text-zinc-700 hover:text-zinc-900">
          Groups
        </Link>
        <Link href="/places" className="text-zinc-700 hover:text-zinc-900">
          Places
        </Link>
        <Link href="/settings" className="text-zinc-700 hover:text-zinc-900">
          Settings
        </Link>
      </nav>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-500">{email}</span>
        <SignOutButton />
      </div>
    </div>
  );
}
