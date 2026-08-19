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
// Run for real against both target libraries (not just fixtures): the
// first live attempt used RSS for both and confirmed the fetch/parse/
// normalize/dedupe/upsert pipeline end to end, but produced zero events
// (RSS has no start time — see below). Both sources have since been
// switched to iCal, which does carry DTSTART/DTEND.
//
// Still open, confirmed via real Communico feed content but not yet
// resolved in this codebase:
//   1. Whether DESCRIPTION embeds structured age/cost data, and in what
//      format — not implemented here until a real sample confirms the
//      format (still true; iCal DESCRIPTION hasn't been inspected for
//      this yet).
//   2. Both feeds return ALL library programming (mahjong, chair yoga,
//      chess club, adult events — not just kid-relevant ones). Neither
//      this adapter nor /today's query currently filters by
//      age-appropriateness at all; every ingested event is eligible to
//      show up for every user regardless of relevance. That's a real gap
//      to close before this reaches real users — not solved here.
export class CommunicoSourceAdapter implements SourceAdapter {
  // Set by fetch() from the actual response, and what normalize()/
  // validate() key off — NOT the constructor's feedFormat, which is only
  // a hint from activity_sources.feed_format and can drift out of sync
  // with what a source's URL actually serves (confirmed for real: the
  // first live run against an iCal-configured Pasco URL still parsed 0
  // items because the adapter trusted feed_format="rss" from the DB
  // instead of the actual response, which was iCal all along).
  private detectedFormat: CommunicoFeedFormat | null = null;

  constructor(
    private feedUrl: string,
    private feedFormat: CommunicoFeedFormat,
  ) {}

  async fetch(): Promise<RawSourceItem[]> {
    // 10s cap on the HTTP call itself so one slow Communico response can't
    // consume the whole function duration budget on its own — separate
    // from and much smaller than the overall route-level maxDuration
    // (route.ts), which also has to cover the per-item DB writes.
    const httpStart = Date.now();
    const response = await fetch(this.feedUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`Communico feed fetch failed: HTTP ${response.status} for ${this.feedUrl}`);
    }
    const body = await response.text();
    const httpMs = Date.now() - httpStart;

    const contentType = response.headers.get("content-type");
    const detected = this.detectFormat(body, contentType);
    if (detected !== this.feedFormat) {
      console.warn(
        `[ingest] ${this.feedUrl} activity_sources.feed_format="${this.feedFormat}" but response is actually ` +
          `"${detected}" (content-type="${contentType ?? "none"}") — using the detected format, not the configured one`,
      );
    }
    this.detectedFormat = detected;

    const parseStart = Date.now();
    const items = detected === "ical" ? parseIcalEvents(body) : parseRssItems(body);
    const parseMs = Date.now() - parseStart;
    console.log(`[ingest] ${this.feedUrl} http=${httpMs}ms parse=${parseMs}ms items=${items.length} format=${detected}`);
    return items;
  }

  // Sniffs the actual format from the response rather than trusting
  // config. Body content is the primary signal (a real BEGIN:VCALENDAR or
  // <rss> tag is unambiguous); Content-Type is a secondary fallback since
  // some servers set it loosely or generically (e.g. text/plain,
  // application/xml for both formats). Throws rather than guessing when
  // neither signal is conclusive — a 0-item parse must never look like a
  // successful ingest of an empty feed.
  private detectFormat(body: string, contentType: string | null): CommunicoFeedFormat {
    const head = body.slice(0, 1000);
    if (/^\s*BEGIN:VCALENDAR/.test(head)) return "ical";
    if (/<rss[\s>]/i.test(head) || /<\?xml[^>]*\?>\s*<rss/i.test(head)) return "rss";
    if (contentType?.includes("calendar")) return "ical";
    if (contentType?.includes("rss")) return "rss";
    throw new Error(
      `Cannot determine feed format for ${this.feedUrl}: content-type="${contentType ?? "none"}", ` +
        `body starts with "${head.slice(0, 80).replace(/\s+/g, " ")}" — no BEGIN:VCALENDAR or <rss> found`,
    );
  }

  normalize(raw: RawSourceItem): NormalizedActivity {
    const format = this.detectedFormat ?? this.feedFormat;
    return format === "ical" ? this.normalizeIcal(raw) : this.normalizeRss(raw);
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
    const format = this.detectedFormat ?? this.feedFormat;
    const errors: string[] = [];
    if (!item.externalId) errors.push("missing external id (no uid/guid/link)");
    if (!item.title) errors.push("missing title");
    if (format === "ical" && !item.startsAt) errors.push("missing/unparseable DTSTART");
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
