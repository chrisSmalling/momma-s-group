function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

// Nap windows are stored as plain wall-clock times (profiles.nap_start/
// nap_end), same convention the rest of the app uses for displaying event
// times (no explicit timezone conversion — an accepted simplification).
// Returns true if the event's time range overlaps the daily nap window at
// all. Never used to hide an event, only to dim it.
export function overlapsNapWindow(
  startsAt: string,
  endsAt: string | null,
  napStart: string | null,
  napEnd: string | null,
): boolean {
  if (!napStart || !napEnd) return false;
  const napStartMin = timeToMinutes(napStart);
  const napEndMin = timeToMinutes(napEnd);
  if (napStartMin === napEndMin) return false;

  const start = new Date(startsAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = endsAt
    ? (() => {
        const end = new Date(endsAt);
        return end.getHours() * 60 + end.getMinutes();
      })()
    : startMin;

  const pointInWindow = (min: number) =>
    napStartMin <= napEndMin
      ? min >= napStartMin && min < napEndMin
      : min >= napStartMin || min < napEndMin;

  if (!endsAt) {
    return pointInWindow(startMin);
  }

  if (napStartMin <= napEndMin) {
    return startMin < napEndMin && endMin > napStartMin;
  }
  // Nap window crosses midnight — rare; fall back to endpoint checks.
  return pointInWindow(startMin) || pointInWindow(endMin);
}
