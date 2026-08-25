// The one place "does this cost string mean free" is decided — shared by
// EventCard's CostPill and the Explorer assistant's budget matching so a
// "free" match can never disagree with what the card itself displays.
export function isFreeCost(cost: string | null): boolean {
  const normalized = cost?.trim().toLowerCase() ?? "";
  return normalized === "free" || normalized === "$0" || normalized === "$0.00" || normalized === "no cost";
}
