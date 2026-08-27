import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveEvent } from "@/lib/resolveEvent";
import Nav from "@/components/Nav";

export default async function ProposalSuccessPage(
  props: PageProps<"/proposal/success/[id]">,
) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/proposal/success/${id}`);

  // A fresh proposal has no verification tier/score, so it never appears
  // in feed_events — resolveEvent falls back to the base, RLS-scoped
  // events table so this confirmation page (and the "View meetup" link on
  // it) doesn't 404 immediately after proposing.
  const event = await resolveEvent(supabase, id);

  if (!event) notFound();

  const group = event.proposed_by_group
    ? await supabase.from("groups").select("id, name").eq("id", event.proposed_by_group).maybeSingle()
    : { data: null };
  const groupName = group.data?.name ?? "your group";
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(event.starts_at));

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Nav email={user.email ?? ""} />
        <main className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
          <div className="text-3xl" aria-hidden="true">🎉</div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-rose-700">Meetup proposed</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-zinc-950">{event.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.starts_at))}
          </p>
          {event.venue && <p className="mt-1 text-sm text-zinc-500">{event.venue}</p>}
          <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-900">
            Proposed to <span className="font-bold">{groupName}</span>. Your group can now RSVP and coordinate around it.
          </p>

          <div className="mt-5 grid gap-2">
            <Link href={`/events/${event.id}`} className="flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">
              View meetup &amp; Who&apos;s going →
            </Link>
            <Link href={`/calendar?month=${month}#event-${event.id}`} className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:bg-zinc-50">
              View on Calendar
            </Link>
            <Link href={`/plans?group=${event.proposed_by_group ?? ""}`} className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:bg-zinc-50">
              View {groupName}&apos;s plans
            </Link>
            <Link href="/today" className="flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              Back to Poppy
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
