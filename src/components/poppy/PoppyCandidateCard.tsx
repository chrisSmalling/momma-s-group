import Link from "next/link";
import type { RecommendationCandidate } from "@/lib/recommend/types";

const EVENT_TIME_ZONE = "America/New_York";

function formatWhen(candidate: RecommendationCandidate): string | null {
  if (candidate.type !== "event" || !candidate.startsAt) return null;
  const d = new Date(candidate.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

function formatVerifiedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const ageHours = (Date.now() - date.getTime()) / 3_600_000;
  if (ageHours < 24) return "Verified today";
  if (ageHours < 24 * 7) return `Verified ${Math.floor(ageHours / 24)}d ago`;
  return `Last verified ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`;
}

function PricePill({ candidate }: { candidate: RecommendationCandidate }) {
  if (candidate.isFree) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Free</span>;
  if (candidate.price?.trim()) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{candidate.price}</span>;
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">Cost unknown</span>;
}

export default function PoppyCandidateCard({ candidate, rankLabel }: { candidate: RecommendationCandidate; rankLabel: string }) {
  const when = formatWhen(candidate);
  const venue = candidate.address?.trim() || null;
  const description = candidate.description?.trim() || null;
  const verifiedLabel = formatVerifiedAt(candidate.lastVerifiedAt);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-rose-200 hover:shadow-md">
      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-600">{rankLabel}</div>
          {verifiedLabel ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">✓ {verifiedLabel}</span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">Details may have changed</span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-tight text-zinc-950">{candidate.title}</h3>
          <PricePill candidate={candidate} />
        </div>

        {description && (
          <p className="mt-2 text-sm leading-5 text-zinc-700">{description}</p>
        )}

        {venue && (
          <div className="mt-2 text-sm font-semibold text-zinc-600">📍 {venue}</div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
          {candidate.distanceLabel && <span className="inline-flex items-center gap-1 font-semibold text-zinc-700">{candidate.distanceLabel}</span>}
          {when && <span className="inline-flex items-center gap-1">🕐 {when}</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {candidate.goodAgeFit && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">👶 Great for their age</span>}
          {candidate.isOutdoor != null && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">{candidate.isOutdoor ? "🌳 Outside" : "🏠 Indoor"}</span>
          )}
          {candidate.driveMinutes != null && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">🚗 ~{candidate.driveMinutes} min drive</span>}
        </div>

        {candidate.reason && <p className="mt-3 text-sm leading-5 text-zinc-600">{candidate.reason}</p>}

        <div className="mt-4">
          <Link
            href={candidate.href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            {candidate.type === "place" ? "View & plan a meetup" : "View details"}
          </Link>
        </div>
      </div>
    </article>
  );
}
