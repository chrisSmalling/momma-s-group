import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import PlaceSearchCard from "@/components/PlaceSearchCard";
import { createClient } from "@/lib/supabase/server";
import { searchPlaces } from "@/lib/places/search";
import { PLACE_CATEGORY_TAGS } from "@/lib/places/tags";

function chipClass(active: boolean) {
  return active
    ? "rounded-full bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
    : "rounded-full border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-500";
}

export default async function BrowsePlacesPage(props: PageProps<"/places/browse">) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const activeTag = typeof searchParams.tag === "string" ? searchParams.tag : null;
  const hasQuery = Boolean(q || activeTag);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("child_age_months, home_lat, home_lng")
    .eq("id", user.id)
    .maybeSingle();

  const origin = profile?.home_lat != null && profile?.home_lng != null
    ? { lat: profile.home_lat, lng: profile.home_lng }
    : null;

  let results: Awaited<ReturnType<typeof searchPlaces>>["results"] = [];
  let routingUnavailable = false;
  let searchFailed = false;

  if (hasQuery) {
    try {
      const outcome = await searchPlaces(supabase, {
        term: q || null,
        tags: activeTag ? [activeTag] : null,
        origin,
        childAgeMonths: profile?.child_age_months ?? null,
        limit: 30,
      });
      results = outcome.results;
      routingUnavailable = origin != null && !outcome.routingAvailable;
    } catch (err) {
      console.error("[places/browse] search failed", err);
      searchFailed = true;
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-zinc-950">Browse places</h1>
              <p className="mt-1 text-sm text-zinc-500">Search by what you want to do, or tap a category to browse.</p>
            </div>
            <Link href="/places" className="shrink-0 text-sm font-semibold text-rose-700 hover:underline">🌼 Ask Poppy</Link>
          </div>

          <form action="/places/browse" method="get" className="flex gap-2">
            <label htmlFor="place-search-q" className="sr-only">Search places</label>
            <input
              id="place-search-q"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="e.g. gymnastics, splash pad, storytime…"
              className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
            <button type="submit" className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">Search</button>
          </form>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
            <Link href="/places/browse" className={chipClass(!activeTag)}>All</Link>
            {PLACE_CATEGORY_TAGS.map((tag) => (
              <Link key={tag.value} href={`/places/browse?tag=${tag.value}`} className={chipClass(activeTag === tag.value)}>
                {tag.label}
              </Link>
            ))}
          </div>

          {!hasQuery && (
            <p className="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
              Type what you&apos;re looking for, or tap a category above to browse.
            </p>
          )}

          {hasQuery && searchFailed && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Something went wrong while searching. Try again in a moment.
            </p>
          )}

          {hasQuery && !searchFailed && routingUnavailable && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              I can&apos;t verify drive times right now, so I&apos;m not showing results I can&apos;t confirm are within 45 minutes.
            </p>
          )}

          {hasQuery && !searchFailed && !routingUnavailable && results.length === 0 && (
            <p className="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
              {q
                ? `I don't have any ${q} places on file yet.`
                : "No places on file in this category yet."}
            </p>
          )}

          {results.length > 0 && (
            <div className="flex flex-col gap-4">
              {results.map((result) => <PlaceSearchCard key={result.place.id} result={result} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
