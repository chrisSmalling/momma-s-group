import { XMLParser } from "fast-xml-parser";
import type { RawSourceItem } from "./types";

// Parses a standard RSS 2.0 feed (https://www.rssboard.org/rss-specification)
// into raw <item> objects. Deliberately only reads what the RSS spec
// guarantees exists (title, link, guid, pubDate, description) — RSS has
// no dedicated "event start time" field (pubDate means "when this feed
// item was published," not "when the event happens"), so this is the
// fallback path when a source has no iCal export, not the preferred one.
export function parseRssItems(xml: string): RawSourceItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}
