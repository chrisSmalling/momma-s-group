import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sibling of discover-places-osm, split out 2026-08-31: business/activity
// OSM tags (dance, gymnastics, gyms, music, martial arts, farms, indoor
// play) that OSM's infrastructure tags (playgrounds/libraries/museums/
// nature) don't cover. Same free, keyless OSM Overpass source, same
// dedup (place_discovery_duplicate_exists), same toddler gate
// (apply_place_toddler_gate via verify-toddler-fit) -- discovery only
// proposes candidates with honest provenance, it never decides
// toddler-appropriateness. Kept in its own function/cron schedule rather
// than merged into discover-places-osm because running all 14 tag
// categories in one invocation hit Supabase's edge function compute
// limit (WORKER_RESOURCE_LIMIT) partway through (verified live
// 2026-08-31) -- splitting keeps each invocation's footprint small
// enough to reliably finish all of its own categories.
//
// None of these descriptions claim toddler-specific programming OSM
// doesn't actually state; a fitness centre or dance studio is exactly
// that and nothing more until the toddler gate finds real evidence
// otherwise -- these are meant to land in needs_review/rejected as often
// as verified, that's the gate working as intended, not a discovery bug.

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const OVERPASS_URL = Deno.env.get("OVERPASS_URL") ?? "https://overpass-api.de/api/interpreter";

// Same launch-metro box as discover-places-osm.
const CENTER = { lat: 28.11775, lng: -82.3836 };
const BBOX = { south: 27.75775, west: -82.7936, north: 28.47775, east: -81.9736 };

const OSM_QUERIES: { tag: string; description: (name: string) => string; category_tags: string[]; place_type: string; is_outdoor: boolean }[] = [
  {
    tag: '"leisure"="dance"',
    description: (name) => `${name} is a dance venue (OpenStreetMap leisure=dance).`,
    category_tags: ["dance"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"amenity"="dancing_school"',
    description: (name) => `${name} is a dance school (OpenStreetMap amenity=dancing_school).`,
    category_tags: ["dance"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"sport"="gymnastics"',
    description: (name) => `${name} is a gymnastics facility (OpenStreetMap sport=gymnastics).`,
    category_tags: ["gymnastics"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"leisure"="fitness_centre"',
    description: (name) => `${name} is a fitness centre (OpenStreetMap leisure=fitness_centre).`,
    category_tags: ["toddler_gym"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"leisure"="sports_centre"',
    description: (name) => `${name} is a sports centre (OpenStreetMap leisure=sports_centre).`,
    category_tags: ["toddler_gym"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"amenity"="music_school"',
    description: (name) => `${name} is a music school (OpenStreetMap amenity=music_school).`,
    category_tags: ["music"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"sport"="martial_arts"',
    description: (name) => `${name} is a martial arts facility (OpenStreetMap sport=martial_arts).`,
    category_tags: ["kids_class"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"tourism"="farm"',
    description: (name) => `${name} is a working/visitable farm (OpenStreetMap tourism=farm).`,
    category_tags: ["farm", "outdoor"],
    place_type: "outdoor",
    is_outdoor: true,
  },
  {
    tag: '"leisure"="indoor_play"',
    description: (name) => `${name} is an indoor play facility (OpenStreetMap leisure=indoor_play).`,
    category_tags: ["playground", "indoor"],
    place_type: "indoor",
    is_outdoor: false,
  },
];
// Deliberately NOT queried: shop=games (retail, not an activity venue --
// out of scope for a "places to take your toddler" directory) and
// leisure=amusement_arcade (OSM doesn't distinguish family arcades from
// adult/bar-attached ones, and the tag alone gives the gate too little
// to work with either way -- flagged here rather than silently included
// or silently dropped).

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildQuery(tag: string): string {
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  return `[out:json][timeout:25];\n(\n  node[${tag}](${bbox});\n  way[${tag}](${bbox});\n);\nout center tags;`;
}

async function fetchOverpassQuery(tag: string): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "mommas-meetup-place-discovery/1.0 (+https://uiuibwufzhirpntdtqpj.supabase.co)",
    },
    body: "data=" + encodeURIComponent(buildQuery(tag)),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${tag}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return Array.isArray(json?.elements) ? json.elements : [];
}

interface RunStats {
  inserted: number;
  duplicates: number;
  skippedNoName: number;
  alreadyKnown: number;
  errors: number;
  errorSamples: string[];
}

type OsmQuery = (typeof OSM_QUERIES)[number];

async function insertElement(el: OverpassElement, match: OsmQuery, stats: RunStats) {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) { stats.skippedNoName++; return; }

  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lng = el.type === "node" ? el.lon : el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return;

  const sourceUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;

  const { data: isDup, error: dupError } = await db.rpc("place_discovery_duplicate_exists", {
    p_lat: lat,
    p_lng: lng,
  });
  if (dupError) { stats.errors++; if (stats.errorSamples.length < 5) stats.errorSamples.push(dupError.message); return; }
  if (isDup) { stats.duplicates++; return; }

  const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);
  const { error: insertError } = await db.from("places").insert({
    name,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    city: tags["addr:city"] ?? null,
    state: tags["addr:state"] ?? null,
    zip_code: tags["addr:postcode"] ?? null,
    address: addressParts.length > 0 ? addressParts.join(" ") : null,
    website: tags.website ?? tags["contact:website"] ?? null,
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    description: match.description(name),
    place_type: match.place_type,
    category_tags: match.category_tags,
    is_outdoor: match.is_outdoor,
    metro_area: "tampa_bay",
    facility_data_source: "osm_overpass",
    source_url: sourceUrl,
    discovery_priority: 40,
  });

  if (insertError) {
    if (insertError.code === "23505") { stats.alreadyKnown++; return; }
    stats.errors++;
    if (stats.errorSamples.length < 5) stats.errorSamples.push(insertError.message);
    return;
  }
  stats.inserted++;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: validSecret } = await db.rpc("validate_community_cron_secret", { provided_secret: secret });
  if (validSecret !== true) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const stats: RunStats = { inserted: 0, duplicates: 0, skippedNoName: 0, alreadyKnown: 0, errors: 0, errorSamples: [] };
  const failedTags: string[] = [];
  let elementsFetched = 0;

  for (let i = 0; i < OSM_QUERIES.length; i++) {
    const q = OSM_QUERIES[i];
    try {
      const elements = await fetchOverpassQuery(q.tag);
      elementsFetched += elements.length;
      for (const el of elements) await insertElement(el, q, stats);
    } catch (e) {
      failedTags.push(`${q.tag}: ${String(e instanceof Error ? e.message : e).slice(0, 150)}`);
    }
    if (i + 1 < OSM_QUERIES.length) await new Promise((r) => setTimeout(r, 1500));
  }

  if (elementsFetched === 0 && failedTags.length === OSM_QUERIES.length) {
    return Response.json({ error: "all category queries failed", failedTags }, { status: 502 });
  }

  const { data: coverage } = await db.rpc("place_category_coverage_report");

  return Response.json({
    ok: true,
    center: CENTER,
    elements_fetched: elementsFetched,
    failed_category_queries: failedTags,
    inserted: stats.inserted,
    duplicates_by_proximity: stats.duplicates,
    already_known_by_source_url: stats.alreadyKnown,
    skipped_no_name: stats.skippedNoName,
    errors: stats.errors,
    error_samples: stats.errorSamples,
    coverage_below_target: (coverage ?? []).filter((c: { below_target: boolean }) => c.below_target),
  });
});
