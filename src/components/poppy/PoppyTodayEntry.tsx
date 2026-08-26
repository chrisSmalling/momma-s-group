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
    <section aria-labelledby="poppy-today-heading" className="overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-2xl">🌼</span>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Poppy</div>
          <h2 id="poppy-today-heading" className="font-display text-lg font-bold tracking-tight text-zinc-950">{question}</h2>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <Link
            key={chip.label}
            href={`/places?ask=${encodeURIComponent(chip.ask)}`}
            prefetch={false}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-rose-300 hover:text-rose-700"
          >
            {chip.label}
          </Link>
        ))}
        <Link
          href="/places"
          prefetch={false}
          className="rounded-full bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
        >
          Ask Poppy →
        </Link>
      </div>
    </section>
  );
}
