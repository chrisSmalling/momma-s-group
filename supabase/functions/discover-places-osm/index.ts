import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Part 1 discovery: OpenStreetMap Overpass (free, keyless, real
// municipal/community-mapped data). There is no Google Places /
// business-directory API credential in this project -- see the header
// comment on 20260830140000_place_discovery_osm.sql for why this source
// was chosen and which categories it does NOT cover well.
//
// Every row this writes lands as llm_verification_status='unverified'
// with a real, honest description built only from actual OSM tags (no
// invented facts) -- it is picked up by the SAME toddler gate
// (verify-toddler-fit / apply_place_toddler_gate) as every other place
// before it can ever surface in search or Poppy. Discovery proposes
// candidates; it never decides toddler-appropriateness.

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Public Overpass endpoints are flaky from shared cloud egress IPs
// (verified live 2026-08-30: overpass-api.de returned 429, then
// overpass.kumi.systems returned a transient 500 on the next attempt).
// Configurable via env var so a bad endpoint can be swapped without a
// redeploy; defaults to the main instance.
const OVERPASS_URL = Deno.env.get("OVERPASS_URL") ?? "https://overpass-api.de/api/interpreter";

// Centroid + half-extent of the existing curated Tampa Bay / Pasco
// dataset (verified live 2026-08-30: lat 27.77-28.46, lng -82.80 to
// -81.97), used as the launch-metro search box for discovery. This
// intentionally mirrors where the curated set already lives rather than
// asserting a new "true" launch center.
const CENTER = { lat: 28.11775, lng: -82.3836 };
const BBOX = { south: 27.75775, west: -82.7936, north: 28.47775, east: -81.9736 };

// OSM tag -> our vocabulary. Deliberately conservative: category_tags
// only assert what the tag itself confirms (a playground IS a
// playground), never programming details OSM doesn't know (e.g. we do
// NOT tag a library "storytime" just because it's a library -- that's
// an unverified claim the toddler gate would rightly be unable to
// evidence).
const OSM_QUERIES: { tag: string; description: (name: string) => string; category_tags: string[]; place_type: string; is_outdoor: boolean }[] = [
  {
    tag: '"leisure"="playground"',
    description: (name) => `${name} is a public playground (OpenStreetMap leisure=playground).`,
    category_tags: ["playground", "outdoor"],
    place_type: "outdoor",
    is_outdoor: true,
  },
  {
    tag: '"leisure"="water_park"',
    description: (name) => `${name} is a public water park (OpenStreetMap leisure=water_park).`,
    category_tags: ["water_play", "outdoor"],
    place_type: "outdoor",
    is_outdoor: true,
  },
  {
    tag: '"amenity"="library"',
    description: (name) => `${name} is a public library (OpenStreetMap amenity=library).`,
    category_tags: ["indoor"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"tourism"="museum"',
    description: (name) => `${name} is a public museum (OpenStreetMap tourism=museum).`,
    category_tags: ["indoor"],
    place_type: "indoor",
    is_outdoor: false,
  },
  {
    tag: '"leisure"="nature_reserve"',
    description: (name) => `${name} is a nature reserve open to the public (OpenStreetMap leisure=nature_reserve).`,
    category_tags: ["outdoor"],
    place_type: "outdoor",
    is_outdoor: true,
  },
];

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
      // Overpass's usage policy asks automated clients to identify
      // themselves; an unrecognized/absent UA can get a 406 from the
      // fronting Apache.
      "User-Agent": "mommas-meetup-place-discovery/1.0 (+https://uiuibwufzhirpntdtqpj.supabase.co)",
    },
    body: "data=" + encodeURIComponent(buildQuery(tag)),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${tag}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return Array.isArray(json?.elements) ? json.elements : [];
}

// One request per category rather than one combined multi-tag query: a
// single 5-tag x (node+way) union over this whole bbox hit 500/504 on
// two different public Overpass endpoints (verified live 2026-08-30) --
// almost certainly a server-side complexity/time budget on the shared
// free instances, not a query-syntax problem. Splitting it into 5
// smaller, independent requests (paced 2s apart) keeps each one cheap
// enough to actually complete, and one category failing doesn't take
// the others down with it.
async function fetchOverpass(): Promise<{ elements: OverpassElement[]; failedTags: string[] }> {
  const elements: OverpassElement[] = [];
  const failedTags: string[] = [];
  for (let i = 0; i < OSM_QUERIES.length; i++) {
    try {
      elements.push(...(await fetchOverpassQuery(OSM_QUERIES[i].tag)));
    } catch (e) {
      failedTags.push(`${OSM_QUERIES[i].tag}: ${String(e instanceof Error ? e.message : e).slice(0, 150)}`);
    }
    if (i + 1 < OSM_QUERIES.length) await new Promise((r) => setTimeout(r, 2000));
  }
  return { elements, failedTags };
}

function matchQuery(tags: Record<string, string>) {
  for (const q of OSM_QUERIES) {
    const [key, value] = q.tag.split("=").map((s) => s.replace(/"/g, ""));
    if (tags[key] === value) return q;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: validSecret } = await db.rpc("validate_community_cron_secret", { provided_secret: secret });
  if (validSecret !== true) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { elements, failedTags } = await fetchOverpass();
  if (elements.length === 0 && failedTags.length > 0) {
    return Response.json({ error: "all category queries failed", failedTags }, { status: 502 });
  }

  let inserted = 0, duplicates = 0, skippedNoName = 0, alreadyKnown = 0, errors = 0;
  const errorSamples: string[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) { skippedNoName++; continue; }

    const match = matchQuery(tags);
    if (!match) continue;

    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lng = el.type === "node" ? el.lon : el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const sourceUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;

    const { data: isDup, error: dupError } = await db.rpc("place_discovery_duplicate_exists", {
      p_lat: lat,
      p_lng: lng,
    });
    if (dupError) { errors++; if (errorSamples.length < 5) errorSamples.push(dupError.message); continue; }
    if (isDup) { duplicates++; continue; }

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
      // Unique violation on source_url means a prior run already
      // inserted this exact OSM element -- expected on repeat runs, not
      // a real error.
      if (insertError.code === "23505") { alreadyKnown++; continue; }
      errors++;
      if (errorSamples.length < 5) errorSamples.push(insertError.message);
      continue;
    }
    inserted++;
  }

  const { data: coverage } = await db.rpc("place_category_coverage_report");

  return Response.json({
    ok: true,
    center: CENTER,
    elements_fetched: elements.length,
    failed_category_queries: failedTags,
    inserted,
    duplicates_by_proximity: duplicates,
    already_known_by_source_url: alreadyKnown,
    skipped_no_name: skippedNoName,
    errors,
    error_samples: errorSamples,
    coverage_below_target: (coverage ?? []).filter((c: { below_target: boolean }) => c.below_target),
  });
});
