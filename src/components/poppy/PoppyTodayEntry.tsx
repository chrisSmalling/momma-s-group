import Link from "next/link";

// Compact Today entry. Deliberately a server component built from links (no
// client JS, no extra network on Today) so it enhances Today without touching
// the bottom-nav performance path. The full conversational experience lives on
// /places; these chips deep-link into it with a starting request.
const CHIPS: { label: string; ask: string }[] = [
  { label: "Something fun", ask: "Something fun to do today" },
  { label: "Indoor", ask: "Something indoors" },
  { label: "Outdoor", ask: "Something outdoors where my toddler can run around" },
  { label: "Near me", ask: "Something close by" },
];

export default function PoppyTodayEntry({ childName }: { childName: string | null }) {
  const question = childName ? `What do you and ${childName} feel like doing?` : "What do you guys want to do today?";
  return (
    <section aria-labelledby="poppy-today-heading" className="overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-lg">🌼</span>
        <h2 id="poppy-today-heading" className="min-w-0 truncate text-sm font-bold text-zinc-900">{question}</h2>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        {CHIPS.map((chip) => (
          <Link
            key={chip.label}
            href={`/places?ask=${encodeURIComponent(chip.ask)}`}
            prefetch={false}
            className="min-h-9 shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-rose-300 hover:text-rose-700"
          >
            {chip.label}
          </Link>
        ))}
        <Link
          href="/places"
          prefetch={false}
          className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
        >
          Ask Poppy →
        </Link>
      </div>
    </section>
  );
}
