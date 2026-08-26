const TZ = "America/New_York";

export type DateWindow = { start_at: string; end_at: string };
type Parts = { y: number; m: number; d: number; w: string };

export function localParts(now = new Date()): Parts {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  return { y: Number(p.find(x => x.type === "year")!.value), m: Number(p.find(x => x.type === "month")!.value), d: Number(p.find(x => x.type === "day")!.value), w: p.find(x => x.type === "weekday")!.value };
}

function offsetMinutesAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const raw = parts.find(x => x.type === "timeZoneName")?.value ?? "GMT-04:00";
  const m = raw.match(/GMT([+-])(\d{2}):?(\d{2})/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "+" ? mins : -mins;
}

export function zoned(y: number, m: number, d: number, h: number, min: number): string {
  const wallUtc = Date.UTC(y, m - 1, d, h, min);
  const first = new Date(wallUtc - offsetMinutesAt(new Date(wallUtc)) * 60_000);
  return new Date(wallUtc - offsetMinutesAt(first) * 60_000).toISOString();
}

export function addDays(y: number, m: number, d: number, n: number) {
  const x = new Date(Date.UTC(y, m - 1, d));
  x.setUTCDate(x.getUTCDate() + n);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

function dayWindow(p: Parts, offset: number): DateWindow {
  const s = addDays(p.y, p.m, p.d, offset);
  const e = addDays(s.y, s.m, s.d, 1);
  return { start_at: zoned(s.y, s.m, s.d, 0, 0), end_at: zoned(e.y, e.m, e.d, 0, 0) };
}

export function deterministicWindow(text: string, now = new Date()): DateWindow | null {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  const p = localParts(now);
  if (/\btoday\b/.test(t)) return dayWindow(p, 0);
  if (/\btomorrow\b/.test(t)) return dayWindow(p, 1);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = names.map(x => x.slice(0, 3));
  const currentDow = weekdays.indexOf(p.w);

  if (/\bthis weekend\b/.test(t)) {
    const satOffset = currentDow === 0 ? -1 : (6 - currentDow + 7) % 7;
    const s = addDays(p.y, p.m, p.d, satOffset);
    const e = addDays(s.y, s.m, s.d, 2);
    return { start_at: zoned(s.y, s.m, s.d, 0, 0), end_at: zoned(e.y, e.m, e.d, 0, 0) };
  }

  // Preserve semantic time-of-day constraints for Gemini; this helper only owns the calendar day.
  if (/\b(?:morning|afternoon|evening|tonight|night)\b/.test(t)) return null;

  const explicitNext = t.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/);
  if (explicitNext) {
    const target = short.findIndex(x => x.toLowerCase() === explicitNext[1].slice(0, 3).toLowerCase());
    const n = (target - currentDow + 7) % 7 || 7;
    return dayWindow(p, n + (n < 7 ? 7 : 0));
  }

  const explicitDay = t.match(/\b(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/);
  if (explicitDay) {
    const target = short.findIndex(x => x.toLowerCase() === explicitDay[1].slice(0, 3).toLowerCase());
    return dayWindow(p, (target - currentDow + 7) % 7);
  }
  return null;
}
