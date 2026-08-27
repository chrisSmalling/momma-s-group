export function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Calendar month/day placement must be derived from the event's Eastern
// calendar date, never a Date object's getFullYear()/getMonth()/getDate() —
// those read the *runtime's* local zone, which is UTC on the Vercel server
// but the viewer's own zone in the browser. A Date built server-side and
// handed to a client component therefore renders a different calendar day
// depending on where it's read, producing exactly the "grid labeled July,
// filled with August events" bug this fixes. Every calendar-identity read
// (which month a grid represents, which day cell an event belongs in) must
// go through this Eastern-anchored parsing instead.
const ET_TIME_ZONE = "America/New_York";
const ET_YMD_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type EtYMD = { y: number; m: number; d: number }; // m is 1-based

export function etYMD(iso: string): EtYMD {
  const parts = ET_YMD_FORMAT.formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function isInEtMonth(iso: string, year: number, month0: number): boolean {
  const { y, m } = etYMD(iso);
  return y === year && m === month0 + 1;
}

export function isOnEtDay(iso: string, year: number, month0: number, day: number): boolean {
  const { y, m, d } = etYMD(iso);
  return y === year && m === month0 + 1 && d === day;
}
