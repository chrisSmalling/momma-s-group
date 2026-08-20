import type { RawSourceItem } from "./types";

// Minimal RFC 5545 (iCalendar) VEVENT parser — deliberately not a full
// iCal library (no RRULE expansion, no VALARM, no attachments): we only
// need the fields a library events feed would realistically populate
// (UID, SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, URL). Handles line
// folding/unfolding per spec — a content line broken across multiple
// physical lines via CRLF + a leading space/tab — since real .ics files
// do this for long DESCRIPTION values.

function unfold(raw: string): string[] {
  const rawLines = raw.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.trim() !== "") {
      lines.push(line);
    }
  }
  return lines;
}

function parseContentLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

// Each VEVENT becomes a flat object: property name -> unescaped value,
// plus `${NAME}_TZID` when that property carried a TZID parameter (e.g.
// DTSTART;TZID=America/New_York:... produces both DTSTART and
// DTSTART_TZID keys).
export function parseIcalEvents(ics: string): RawSourceItem[] {
  const lines = unfold(ics);
  const events: RawSourceItem[] = [];
  let current: RawSourceItem | null = null;

  for (const line of lines) {
    const parsed = parseContentLine(line);
    if (!parsed) continue;

    if (parsed.name === "BEGIN" && parsed.value === "VEVENT") {
      current = {};
      continue;
    }
    if (parsed.name === "END" && parsed.value === "VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const value = parsed.value
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");

    current[parsed.name] = value;
    if (parsed.params.TZID) current[`${parsed.name}_TZID`] = parsed.params.TZID;
  }

  return events;
}

// Converts an iCal DATE-TIME value (e.g. "20261012T103000Z",
// "20261012T103000" + a TZID, or "20261012" for an all-day DATE) to a UTC
// ISO instant. UTC-suffixed and no-timezone ("floating," ambiguous by
// spec) values are taken at face value; a TZID is resolved via the
// browser/Node's real IANA tzdata (Intl), which correctly accounts for
// DST — the same problem materialize_programs() solves in SQL via
// `at time zone`, just done in TS here since this runs at ingest time,
// not inside Postgres.
export function icalDateToUtcIso(value: string, tzid?: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  const naiveUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);

  if (z || !tzid) {
    return new Date(naiveUtc).toISOString();
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(naiveUtc));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    const offsetMs = asIfUtc - naiveUtc;
    return new Date(naiveUtc - offsetMs).toISOString();
  } catch {
    // Unrecognized TZID — fall back to treating it as UTC rather than
    // throwing; this is rare (a malformed feed) and better surfaced as an
    // approximate time than a hard failure for the whole item.
    return new Date(naiveUtc).toISOString();
  }
}
