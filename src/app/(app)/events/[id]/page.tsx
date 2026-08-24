import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EventCardShell from "@/components/EventCardShell";
import LiveAttendees from "@/components/LiveAttendees";
import PracticalityIcons from "@/components/PracticalityIcons";
import EventComments from "@/components/EventComments";
import TipsSection from "@/components/TipsSection";
import AskGroupButton from "@/components/AskGroupButton";
import GroupAvailability from "@/components/GroupAvailability";
import Nav from "@/components/Nav";
import { isGoodAgeFit } from "@/lib/ageFit";
import { createClient } from "@/lib/supabase/server";
import type { EventComment, FeedEvent, Place, PlaceTip, RsvpStatus, VenuePracticalities } from "@/types";

type Attendee = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
type CommentDisplay = EventComment & { display_name: string };
type TipDisplay = PlaceTip & { display_name: string };
type PlaceContext = Pick<Place, "is_enclosed" | "has_changing_table" | "nursing_friendly" | "stroller_accessible" | "food_onsite" | "quiet_or_sensory_friendly" | "parking_notes" | "best_time_note" | "typical_crowd_note" | "what_to_bring" | "address" | "website" | "booking_url" | "description" | "toddler_notes">;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatEndTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Cost({ event }: { event: FeedEvent }) {
  const cost = event.cost?.trim();
  const free = event.is_free || cost?.toLowerCase() === "free" || cost === "$0" || cost === "$0.00";
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Cost</p>
      <p className="mt-0.5 text-sm font-bold text-zinc-900">{free ? "Free" : cost || "Cost not listed"}</p>
    </div>
  );
}

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/events/${id}`);

  const { data: event } = await supabase.from("feed_events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();
  const feedEvent = event as FeedEvent;

  const [{ data: myProfile }, { data: groups }] = await Promise.all([
    supabase.from("profiles").select("display_name, child_age_months").eq("id", user.id).maybeSingle(),
    supabase.from("groups").select("id, name").order("created_at", { ascending: true }),
  ]);

  const groupList = groups ?? [];
  const activeGroupId = groupList[0]?.id ?? null;
  const activeGroupName = groupList[0]?.name ?? null;
  let activeGroupMemberIds: string[] = [];
  if (activeGroupId) {
    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", activeGroupId);
    activeGroupMemberIds = (members ?? []).map((m) => m.user_id);
  }

  const [placeResult, rsvpResult, commentsResult, tipsResult] = await Promise.all([
    feedEvent.place_id
      ? supabase.from("places").select("is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly, parking_notes, best_time_note, typical_crowd_note, what_to_bring, address, website, booking_url, description, toddler_notes").eq("id", feedEvent.place_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("rsvps").select("user_id, status, note").eq("event_id", id),
    activeGroupId ? supabase.from("event_comments").select("*").eq("group_id", activeGroupId).eq("event_id", id).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as EventComment[] }),
    activeGroupId
      ? feedEvent.place_id
        ? supabase.from("place_tips").select("*").eq("group_id", activeGroupId).eq("place_id", feedEvent.place_id).order("created_at", { ascending: false })
        : supabase.from("place_tips").select("*").eq("group_id", activeGroupId).eq("event_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as PlaceTip[] }),
  ]);

  const place = placeResult.data as PlaceContext | null;
  const rsvpRows = rsvpResult.data ?? [];
  const currentRsvp = (rsvpRows.find((r) => r.user_id === user.id)?.status as RsvpStatus | undefined) ?? null;
  const currentNote = rsvpRows.find((r) => r.user_id === user.id)?.note ?? null;
  const groupRsvps = rsvpRows.filter((r) => activeGroupMemberIds.includes(r.user_id));
  const profileIds = [...new Set([...activeGroupMemberIds, ...groupRsvps.map((r) => r.user_id), ...(commentsResult.data ?? []).map((c) => c.user_id), ...(tipsResult.data ?? []).map((t) => t.user_id)])];
  const { data: profiles } = profileIds.length ? await supabase.from("profiles").select("id, display_name, avatar_color").in("id", profileIds) : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roster = Object.fromEntries(activeGroupMemberIds.map((memberId) => [memberId, { display_name: profileById.get(memberId)?.display_name ?? "Someone", avatar_color: profileById.get(memberId)?.avatar_color ?? "#C0356E" }]));
  const attendees: Attendee[] = groupRsvps.map((r) => ({ user_id: r.user_id, status: r.status as RsvpStatus, display_name: profileById.get(r.user_id)?.display_name ?? "Someone", avatar_color: profileById.get(r.user_id)?.avatar_color ?? "#C0356E" }));
  const comments: CommentDisplay[] = ((commentsResult.data ?? []) as EventComment[]).map((comment) => ({ ...comment, display_name: profileById.get(comment.user_id)?.display_name ?? "Someone" }));
  const tips: TipDisplay[] = ((tipsResult.data ?? []) as PlaceTip[]).map((tip) => ({ ...tip, display_name: profileById.get(tip.user_id)?.display_name ?? "Someone" }));

  const cancelled = feedEvent.status === "cancelled";
  const goodAgeFit = isGoodAgeFit(myProfile?.child_age_months, feedEvent.age_min_months, feedEvent.age_max_months);
  const bring = feedEvent.what_to_bring.length > 0 ? feedEvent.what_to_bring : (place?.what_to_bring ?? []);
  const end = formatEndTime(feedEvent.ends_at);
  const practicalities: VenuePracticalities = {
    is_enclosed: place?.is_enclosed ?? null,
    has_changing_table: place?.has_changing_table ?? null,
    nursing_friendly: place?.nursing_friendly ?? null,
    stroller_accessible: place?.stroller_accessible ?? null,
    food_onsite: place?.food_onsite ?? null,
    quiet_or_sensory_friendly: place?.quiet_or_sensory_friendly ?? null,
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-1">
      <Nav email={user.email ?? ""} />
      <div className="mb-4">
        <Link href="/today" className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-bold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><span aria-hidden="true">←</span> Back to today</Link>
      </div>

      <EventCardShell eventId={feedEvent.id} currentStatus={currentRsvp} currentNote={currentNote} disabled={cancelled}>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            {feedEvent.is_free && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Free</span>}
            {goodAgeFit && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Great for their age</span>}
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{feedEvent.is_outdoor ? "Outside" : "Indoor"}</span>
            {feedEvent.registration_required && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Registration required</span>}
            {cancelled && <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-600">Cancelled</span>}
          </div>
          <h1 className={`mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl ${cancelled ? "text-zinc-400 line-through" : "text-zinc-950"}`}>{feedEvent.title}</h1>
          {feedEvent.organizer && <p className="mt-2 text-sm font-semibold text-zinc-500">Hosted by {feedEvent.organizer}</p>}
        </header>

        <section className="mt-6 grid grid-cols-2 gap-2" aria-label="Event essentials">
          <div className="rounded-2xl bg-rose-50 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">When</p><p className="mt-0.5 text-sm font-bold text-zinc-900">{formatDateTime(feedEvent.starts_at)}</p>{end && <p className="text-xs font-medium text-zinc-500">until {end}</p>}</div>
          <Cost event={feedEvent} />
        </section>

        <section className="mt-3 rounded-2xl bg-zinc-50 px-4 py-4 ring-1 ring-zinc-100" aria-label="Location">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Where</p>
          <p className="mt-1 text-base font-bold text-zinc-900">{feedEvent.venue ?? "Location not listed"}</p>
          {feedEvent.room_name && <p className="text-sm text-zinc-500">{feedEvent.room_name}</p>}
          {(feedEvent.address || place?.address) && <p className="mt-1 text-sm text-zinc-600">{feedEvent.address ?? place?.address}</p>}
          {place?.parking_notes && <p className="mt-2 text-xs text-zinc-500"><span className="font-bold text-zinc-700">Parking:</span> {place.parking_notes}</p>}
        </section>

        {(feedEvent.description || place?.description || place?.toddler_notes) && <section className="mt-6"><h2 className="font-display text-2xl font-bold text-zinc-900">What to expect</h2>{feedEvent.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{feedEvent.description}</p>}{place?.description && !feedEvent.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{place.description}</p>}{place?.toddler_notes && <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-zinc-700"><span className="font-bold text-rose-800">Momma note:</span> {place.toddler_notes}</p>}</section>}

        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold text-zinc-900">Good to know</h2>
          <div className="mt-3 flex flex-col gap-3">
            <PracticalityIcons practicalities={practicalities} />
            {feedEvent.age_tags.length > 0 && <p className="text-sm text-zinc-600"><span className="font-bold text-zinc-800">Ages:</span> {feedEvent.age_tags.join(" · ")}</p>}
            {feedEvent.registration_required && feedEvent.registration_url && <a href={feedEvent.registration_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-rose-700">Register for this event ↗</a>}
            {bring.length > 0 && <p className="text-sm text-zinc-600"><span className="font-bold text-rose-700">Bring:</span> {bring.join(", ")}</p>}
            {place?.best_time_note && <p className="text-sm text-zinc-600"><span className="font-bold text-zinc-800">Best time:</span> {place.best_time_note}</p>}
            {place?.typical_crowd_note && <p className="text-sm text-zinc-600"><span className="font-bold text-zinc-800">Typical crowd:</span> {place.typical_crowd_note}</p>}
            {(place?.website || place?.booking_url || feedEvent.source_url) && <div className="flex flex-wrap gap-3 pt-1">{place?.booking_url && <a href={place.booking_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-rose-700 underline underline-offset-2">Booking</a>}{place?.website && <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-rose-700 underline underline-offset-2">Venue website</a>}{feedEvent.source_url && <a href={feedEvent.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-rose-700 underline underline-offset-2">Event source</a>}</div>}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-bold text-zinc-900">Who&apos;s going?</h2><p className="mt-0.5 text-sm text-zinc-500">See if your group is already making plans.</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{attendees.filter((a) => a.status === "going").length} going</span></div>
          <div className="mt-4"><LiveAttendees eventId={feedEvent.id} currentUserId={user.id} hasActiveGroup={Boolean(activeGroupId)} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} initialAttendees={attendees} /></div>
          <div className="mt-4"><AskGroupButton eventId={feedEvent.id} groupId={activeGroupId} groupName={activeGroupName} /><GroupAvailability eventId={feedEvent.id} groupId={activeGroupId} /></div>
        </section>

        {activeGroupId && <section className="mt-7"><h2 className="font-display text-2xl font-bold text-zinc-900">Mommas&apos; tips</h2><div className="mt-3"><TipsSection placeId={feedEvent.place_id ?? undefined} eventId={feedEvent.place_id ? undefined : feedEvent.id} groupId={activeGroupId} groupName={activeGroupName} currentUserId={user.id} tips={tips} /></div></section>}
        {activeGroupId && <section className="mt-7"><h2 className="font-display text-2xl font-bold text-zinc-900">Conversation</h2><div className="mt-3"><EventComments eventId={feedEvent.id} groupId={activeGroupId} currentUserId={user.id} currentUserName={myProfile?.display_name ?? "You"} initialComments={comments} roster={Object.fromEntries(Object.entries(roster).map(([memberId, member]) => [memberId, member.display_name]))} /></div></section>}
      </EventCardShell>
    </div>
  );
}
