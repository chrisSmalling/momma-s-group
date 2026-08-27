import Link from "next/link";
import type { HomeStatus } from "@/lib/homeStatus";

// States A and B need different copy: A has genuinely nothing saved, B has
// a saved address that hasn't geocoded (transient or failed) — telling a
// state-B viewer to "add" an address they already entered is the bug this
// component exists to fix.
export default function HomeAddressNudge({ status, purpose }: { status: HomeStatus; purpose: string }) {
  if (status === "ready") return null;
  if (status === "pending_geocode") {
    return (
      <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        We couldn&apos;t place your saved address on the map yet — double-check it in <Link href="/settings" className="underline">Settings</Link> to {purpose}.
      </p>
    );
  }
  return (
    <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Add your home address in <Link href="/settings" className="underline">Settings</Link> to {purpose}.
    </p>
  );
}
