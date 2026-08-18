// Generic contract every external activity source implements. Deliberately
// small and format-agnostic: an adapter's job is "get raw items out of
// wherever they live, and turn each one into a shape our pipeline can
// dedupe/store" — no source-specific branching lives outside an adapter
// implementation (src/lib/ingestion/ingest.ts never checks
// `if (sourceType === "communico")`).

export type RawSourceItem = Record<string, unknown>;

// What every adapter produces per item, regardless of format. Only fields
// a well-formed source item can genuinely guarantee are non-optional;
// everything else is left null rather than guessed. In particular:
// startsAt is null unless the source format has a real, spec-guaranteed
// event-start field (iCal's DTSTART does; RSS's pubDate does NOT — it
// means "when this feed item was published," not "when the event
// happens" — see communico.ts for why that distinction matters here).
export interface NormalizedActivity {
  externalId: string;
  externalUrl: string | null;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  // Raw fields not yet mapped to a known column — carried through to
  // activity_source_records.raw_payload for debugging/future enrichment.
  // RLS already blocks this from ever reaching a normal user (PR #16).
  raw: RawSourceItem;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ActivityKind = "event" | "program" | "place";

export interface MappedActivity {
  dedupKey: string;
  kind: ActivityKind;
}

export interface SourceAdapter {
  // Fetches raw items from the source. Throws on network/parse failure —
  // the ingest runner is responsible for catching this and recording
  // last_fetch_status/last_fetch_error on the activity_sources row.
  fetch(): Promise<RawSourceItem[]>;
  // Turns one raw item into the normalized shape. Pure — no I/O.
  normalize(raw: RawSourceItem): NormalizedActivity;
  // Sanity-checks a normalized item before it's written anywhere.
  validate(item: NormalizedActivity): ValidationResult;
  // Computes the dedup_key and which entity type this item is a candidate
  // for. Pure.
  mapToActivity(item: NormalizedActivity): MappedActivity;
}
