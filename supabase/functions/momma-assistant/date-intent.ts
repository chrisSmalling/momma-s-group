const TZ = "America/New_York";

export type DateWindow = { start_at: string; end_at: string };

type Parts = { y: number; m: number; d: number; w: string };

export function localParts(now = new Date()): Parts {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);
  return {
    y: Number(p.find(x => x.type === "year")!.value),
    m: Number(p.find(x => x.type === "month")!.value),
    d: Number(p.find(x => x.type === "day")!.value),
    w: p.find(x => x.type === "weekday")!.value,
  };
}

function offsetMinutesAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, timeZoneName: "longOffset", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const raw = parts.find(x => x.type === "timeZoneName")?.value ?? "GMT-04:00";
  const m = raw.match(/GMT([+-])(\d{2}):?(\d{2})/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "+" ? mins : -mins;
}

// Convert a local wall-clock value in America/New_York to an ISO instant.
// Two offset-resolution passes handle the normal DST transition cases without
// relying on the host machine's local timezone.
export function zoned(y: number, m: number, d: number, h: number, min: number): string {
  const wallUtc = Date.UTC(y, m - 1, d, h, min);
  let instant = new Date(wallUtc - offsetMinutesAt(new Date(wallUtc)) * 60_000);
  const corrected = wallUtc - offsetMinutesAt(instant) * 60_000;
  instant = new Date(corrected);
  return instant.toISOString();
}

export function addDays(y: number, m: number, d: number, n: number) {
  const x = new Date(Date.UTC(y, m - 1, d));
  x.setUTCDate(x.getUTCDate() + n);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

export function deterministicWindow(text: string, now = new Date()): DateWindow | null {
  const t = text.toLowerCase();
  const p = localParts(now);
  const make = (n: number) => {
    const s = addDays(p.y, p.m, p.d, n);
    const e = addDays(s.y, s.m, s.d, 1);
    return { start_at: zoned(s.y, s.m, s.d, 0, 0), end_at: zoned(e.y, e.m, e.d, 0, 0) };
  };

  if (/\btoday\b/.test(t)) return make(0);
  if (/\btomorrow\b/.test(t)) return make(1);

  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = names.map(x => x.slice(0, 3));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDow = weekdays.indexOf(p.w);

  if (/\bthis weekend\b/.test(t)) {
    const sat = (6 - currentDow + 7) % 7;
    const s = addDays(p.y, p.m, p.d, sat);
    const e = addDays(s.y, s.m, s.d, 2);
    return { start_at: zoned(s.y, s.m, s.d, 0, 0), end_at: zoned(e.y, e.m, e.d, 0, 0) };
  }

  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(?:${names[i]}|${short[i]})\\b`, "i").test(t)) {
      let n = (i - currentDow + 7) % 7;
      if (/\bnext\s+(?:sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(t)) n = n === 0 ? 7 : n + 7;
      return make(n);
    }
  }
  return null;
}
