import Link from "next/link";
import AgeFitBadge from "@/components/AgeFitBadge";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import type { RecommendationCandidate } from "@/lib/recommend/types";
import { buildGroundedWhy, getTrustSummary } from "@/lib/recommend/trust";

const EVENT_TIME_ZONE = "America/New_York";

function formatWhen(candidate: RecommendationCandidate): string | null {
  if (candidate.type !== "event" || !candidate.startsAt) return null;
  const d = new Date(candidate.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

function PricePill({ candidate }: { candidate: RecommendationCandidate }) {
  if (candidate.isFree) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Free</span>;
  if (candidate.price?.trim()) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{candidate.price}</span>;
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">Cost unknown</span>;
}

function TrustBadge({ candidate }: { candidate: RecommendationCandidate }) {
  const trust = getTrustSummary(candidate);
  if (trust.freshness === "verified") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">✓ Verified today</span>;
  if (trust.freshness === "recent") return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">✓ Recently verified</span>;
  if (trust.freshness === "stale") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">↻ May need rechecking</span>;
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">Verification date unknown</span>;
}

function practicalDetailsList(candidate: RecommendationCandidate): string[] {
  const details: string[] = [];
  if (candidate.strollerAccessible === true) details.push("Stroller friendly");
  if (candidate.changingTable === true) details.push("Changing table");
  if (candidate.nursingFriendly === true) details.push("Nursing friendly");
  if (candidate.parkingNotes?.trim()) details.push(`Parking: ${candidate.parkingNotes.trim()}`);
  if (candidate.typicalCrowdNote?.trim()) details.push(`Crowd: ${candidate.typicalCrowdNote.trim()}`);
  if (candidate.bestTimeNote?.trim()) details.push(`Best time: ${candidate.bestTimeNote.trim()}`);
  return details;
}

function hasPracticalDetails(candidate: RecommendationCandidate): boolean {
  const communityTips = (candidate.communityTips ?? []).filter(Boolean);
  return practicalDetailsList(candidate).length > 0 || candidate.whatToBring.length > 0 || communityTips.length > 0;
}

function PracticalDetails({ candidate }: { candidate: RecommendationCandidate }) {
  const details = practicalDetailsList(candidate);
  const communityTips = (candidate.communityTips ?? []).filter(Boolean).slice(0, 3);
  if (details.length === 0 && candidate.whatToBring.length === 0 && communityTips.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-zinc-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Good to know</div>
      <div className="mt-1.5 space-y-1.5 text-sm text-zinc-700">
        {details.map((d) => <div key={d}>{d}</div>)}
        {candidate.whatToBring.length > 0 && <div>Bring: {candidate.whatToBring.slice(0, 4).join(", ")}</div>}
        {communityTips.length > 0 && (
          <div className="border-t border-zinc-200 pt-1.5">
            <span className="font-semibold text-zinc-600">From moms in the group:</span> {communityTips.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function WhyPoppy({ candidate }: { candidate: RecommendationCandidate }) {
  const facts = buildGroundedWhy(candidate);
  if (facts.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-rose-700">Why Poppy picked this</div>
      <p className="mt-1.5 text-sm leading-5 text-zinc-700">Because it {facts.join(", ")}. </p>
    </div>
  );
}

// The positive branch uses the same shared badge every other surface uses
// for a confirmed age match; the other two states have no "not a match"/
// "unknown" counterpart in that shared component by design (see
// AgeFitBadge.tsx), so they stay local to this richer recommendation card.
function AgeFit({ candidate }: { candidate: RecommendationCandidate }) {
  if (candidate.goodAgeFit) return <AgeFitBadge />;
  if (candidate.ageMinMonths != null || candidate.ageMaxMonths != null) return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">Age range on file</span>;
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">Age fit unknown</span>;
}

export default function PoppyCandidateCard({ candidate, rankLabel, groupId }: { candidate: RecommendationCandidate; rankLabel: string; groupId?: string | null }) {
  const when = formatWhen(candidate);
  const venue = candidate.address?.trim() || null;
  const description = candidate.description?.trim() || null;
  const why = buildGroundedWhy(candidate);
  const showMoreDetails = why.length > 0 || hasPracticalDetails(candidate);
  // Only the place->/propose href has a group picker to pre-select; event
  // hrefs go to /events/[id], which doesn't take a group param.
  const href = candidate.type === "place" && groupId ? `${candidate.href}?group=${encodeURIComponent(groupId)}` : candidate.href;
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-rose-200 hover:shadow-md">
      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-600">{rankLabel}</div>
          <TrustBadge candidate={candidate} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-tight text-zinc-950">{candidate.title}</h3>
          <PricePill candidate={candidate} />
        </div>
        {description && <p className="mt-2 text-sm leading-5 text-zinc-700">{description}</p>}
        {venue && <div className="mt-2 text-sm font-semibold text-zinc-600">📍 {venue}</div>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
          {candidate.distanceLabel && <span className="font-semibold text-zinc-700">{candidate.distanceLabel}</span>}
          {when && <span>🕐 {when}</span>}
          {candidate.driveMinutes != null && <span>🚗 ~{candidate.driveMinutes} min drive</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AgeFit candidate={candidate} />
          {candidate.isOutdoor != null && <IndoorOutdoorTag isOutdoor={candidate.isOutdoor} />}
          {candidate.registrationRequired && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Registration required</span>}
        </div>
        <div className="mt-4">
          <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
            {candidate.type === "place" ? "View & plan a meetup" : "View details"}
          </Link>
        </div>
        {showMoreDetails && (
          <details className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-bold text-zinc-700"><span>More details</span><span aria-hidden="true" className="text-zinc-400">⌄</span></summary>
            <div className="pb-3">
              {why.length > 0 && <WhyPoppy candidate={candidate} />}
              <PracticalDetails candidate={candidate} />
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
