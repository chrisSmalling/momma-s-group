import Link from "next/link";

type Proposal = {
  id: string;
  title: string;
  startsAt: string;
  proposerName: string;
};

export default function ProposalBanner({ proposals }: { proposals: Proposal[] }) {
  if (!proposals.length) return null;
  const proposal = proposals[0];
  const count = proposals.length;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(proposal.startsAt));

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg" aria-hidden="true">📣</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-violet-950">New meetup proposal{count > 1 ? "s" : ""}</p>
          <p className="mt-1 text-sm text-violet-900">
            {proposal.proposerName} proposed <strong>{proposal.title}</strong> for {date}.
            {count > 1 ? ` Your group has ${count} proposals to review.` : ""}
          </p>
          <Link href={`/events/${proposal.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-violet-900 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">
            Review proposal →
          </Link>
        </div>
      </div>
    </div>
  );
}
