import { isFreeCost } from "@/lib/cost";

// The one place a cost figure becomes a pill — shared by every surface that
// shows a place's or event's price (search results, place/event detail,
// event cards, Poppy's recommendations) so the same fact never renders as a
// visually different badge depending on which screen it's on.
export default function CostPill({ cost }: { cost: string | null }) {
  if (isFreeCost(cost)) {
    return <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Free</span>;
  }
  if (!cost?.trim()) {
    return <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">Cost unknown</span>;
  }
  return <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{cost}</span>;
}
