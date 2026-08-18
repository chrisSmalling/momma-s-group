import { parseIcalEvents, icalDateToUtcIso } from "./ical";
import { parseRssItems } from "./rss";
import { normalizeDedupKey } from "./dedup";
import type {
  SourceAdapter,
  RawSourceItem,
  NormalizedActivity,
  ValidationResult,
  MappedActivity,
} from "./types";

export type CommunicoFeedFormat = "ical" | "rss";

// Ingests a Communico ("Attend") library events feed. Communico's platform
// is confirmed — via their own documentation, not guessed — to support
// both RSS and iCal export; this adapter can consume either, configured
// per activity_sources row via feed_format (v8).
//
// iCal is preferred whenever available: DTSTART/DTEND/LOCATION are
// guaranteed by the RFC 5545 spec. RSS has no dedicated event-time field
// at all, so when only RSS is available, startsAt/endsAt/venueName come
// back null rather than guessed from pubDate (which means "when this feed
// item was published," not "when the event happens").
//
// NOT YET RUN against a real Communico feed for either target library.
// Two things Communico's own documentation flags that aren't confirmed
// for Pasco/Hillsborough specifically:
//   1. RSS/iCal export may need to be explicitly enabled per-library by
//      Communico support — it isn't necessarily on by default.
//   2. Whether either feed embeds structured age/cost data in its
//      DESCRIPTION text, and in what format. That enrichment is
//      deliberately not implemented here until a real sample confirms
//      the format — see this PR's description for exactly what's needed
//      to close that loop.
export class CommunicoSourceAdapter implements SourceAdapter {
  constructor(
    private feedUrl: string,
    private feedFormat: CommunicoFeedFormat,
  ) {}

  async fetch(): Promise<RawSourceItem[]> {
    const response = await fetch(this.feedUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`Communico feed fetch failed: HTTP ${response.status} for ${this.feedUrl}`);
    }
    const body = await response.text();
    return this.feedFormat === "ical" ? parseIcalEvents(body) : parseRssItems(body);
  }

  normalize(raw: RawSourceItem): NormalizedActivity {
    return this.feedFormat === "ical" ? this.normalizeIcal(raw) : this.normalizeRss(raw);
  }

  private normalizeIcal(raw: RawSourceItem): NormalizedActivity {
    const get = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : null);
    const title = get("SUMMARY") ?? "";
    const uid = get("UID");
    const url = get("URL");
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");

    return {
      externalId: uid ?? url ?? title,
      externalUrl: url,
      title,
      description: get("DESCRIPTION"),
      startsAt: dtstart ? icalDateToUtcIso(dtstart, get("DTSTART_TZID") ?? undefined) : null,
      endsAt: dtend ? icalDateToUtcIso(dtend, get("DTEND_TZID") ?? undefined) : null,
      venueName: get("LOCATION"),
      raw,
    };
  }

  private normalizeRss(raw: RawSourceItem): NormalizedActivity {
    const get = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : null);
    const guidRaw = raw.guid;
    const guid =
      typeof guidRaw === "string"
        ? guidRaw
        : typeof guidRaw === "object" && guidRaw !== null && "#text" in guidRaw
          ? String((guidRaw as Record<string, unknown>)["#text"])
          : null;
    const link = get("link");
    const title = get("title") ?? "";

    return {
      externalId: guid ?? link ?? title,
      externalUrl: link,
      title,
      description: get("description"),
      // Deliberately null, not derived from pubDate — see class comment.
      startsAt: null,
      endsAt: null,
      venueName: null,
      raw,
    };
  }

  validate(item: NormalizedActivity): ValidationResult {
    const errors: string[] = [];
    if (!item.externalId) errors.push("missing external id (no uid/guid/link)");
    if (!item.title) errors.push("missing title");
    if (this.feedFormat === "ical" && !item.startsAt) errors.push("missing/unparseable DTSTART");
    return { valid: errors.length === 0, errors };
  }

  mapToActivity(item: NormalizedActivity): MappedActivity {
    // Communico's Attend module is specifically for scheduled events/
    // programs, never evergreen places — always "event" for this adapter.
    return {
      dedupKey: normalizeDedupKey(item.title, item.venueName ?? "", item.startsAt?.slice(0, 10) ?? ""),
      kind: "event",
    };
  }
}
