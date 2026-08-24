  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roster = Object.fromEntries(activeGroupMemberIds.map((id) => [id, { display_name: profileById.get(id)?.display_name ?? "Someone", avatar_color: profileById.get(id)?.avatar_color ?? "#C0356E" }]));
  const rsvpsByEvent: Record<string, AttendeeDisplay[]> = {};
  for (const r of scopedRsvpRows) { const profile = profileById.get(r.user_id); const list = rsvpsByEvent[r.event_id] ?? []; list.push({ user_id: r.user_id, status: r.status as RsvpStatus, display_name: profile?.display_name ?? "Unknown", avatar_color: profile?.avatar_color ?? "#C0356E" }); rsvpsByEvent[r.event_id] = list; }
  const commentsByEvent: Record<string, (EventComment & { display_name: string })[]> = {};
  for (const c of commentRows) { const list = commentsByEvent[c.event_id] ?? []; list.push({ ...c, display_name: profileById.get(c.user_id)?.display_name ?? "Someone" }); commentsByEvent[c.event_id] = list; }
  const eventTipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {}; const eventTipsByEventId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of eventTipRows) { const display = { ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" }; if (t.place_id) { const list = eventTipsByPlaceId[t.place_id] ?? []; list.push(display); eventTipsByPlaceId[t.place_id] = list; } else if (t.event_id) { const list = eventTipsByEventId[t.event_id] ?? []; list.push(display); eventTipsByEventId[t.event_id] = list; } }

  const eventDistanceById = new Map<string, { km: number; driveMinutes?: number }>();
  if (home) {
    const routingProvider = getRoutingProvider();
    const geolocatedEvents = eventList.map((e) => ({ event: e, lat: e.lat ?? (e.place_id ? eventPlaceById.get(e.place_id)?.lat : null), lng: e.lng ?? (e.place_id ? eventPlaceById.get(e.place_id)?.lng : null) })).filter((e): e is { event: TodayEvent; lat: number; lng: number } => e.lat != null && e.lng != null);
    let driveResults: (DriveTimeResult | null)[] | null = null;
    if (routingProvider && geolocatedEvents.length) driveResults = await routingProvider.getDriveTimes(home, geolocatedEvents.map((e) => ({ lat: e.lat, lng: e.lng })));
    geolocatedEvents.forEach((e, i) => eventDistanceById.set(e.event.id, { km: distanceKm(home.lat, home.lng, e.lat, e.lng), driveMinutes: driveResults?.[i]?.durationMinutes }));
  }

  const eventBundles: EventBundle[] = eventList.map((event) => {
    const proposedBy = event.proposed_by_group && event.added_by ? { user_id: event.added_by, display_name: profileById.get(event.added_by)?.display_name ?? "Someone" } : null;
    const place = event.place_id ? (eventPlaceById.get(event.place_id) ?? null) : null;
    const duringNap = overlapsNapWindow(event.starts_at, event.ends_at, myProfile?.nap_start ?? null, myProfile?.nap_end ?? null);
    const tips = event.place_id ? (eventTipsByPlaceId[event.place_id] ?? []) : (eventTipsByEventId[event.id] ?? []);
    const eventWeather = weatherByEventId.get(event.id) ?? null;
    return { event, currentStatus: myRsvpByEvent[event.id] ?? null, currentNote: myNoteByEvent[event.id] ?? null, proposedBy, place: place as EventBundle["place"], duringNap, tips, comments: commentsByEvent[event.id] ?? [], attendees: rsvpsByEvent[event.id] ?? [], weatherSummary: eventWeather ? weatherSummary(eventWeather) : null, distance: eventDistanceById.get(event.id) };
  });

  const { data: places } = await supabase.from("places").select("*").eq("active", true).order("name", { ascending: true });
  let placeList = (places ?? []) as Place[];

  // Today is intentionally curated: rank the inventory first, then do the
  // expensive routing/weather work only for a small candidate set. The full
  // inventory belongs in Explorer/Discover, not in an endless Today scroll.
  const todayCandidateLimit = 24;
  const todayDisplayLimit = 5;
  const straightLineByPlaceId = new Map<string, number>();
  if (home) for (const p of placeList) if (p.lat != null && p.lng != null) straightLineByPlaceId.set(p.id, distanceKm(home.lat, home.lng, p.lat, p.lng));
  if (home) placeList = [...placeList].sort((a, b) => {
    const aKey = straightLineByPlaceId.get(a.id); const bKey = straightLineByPlaceId.get(b.id);
    if (aKey == null) return 1; if (bKey == null) return -1; return aKey - bKey;
  });
  const todayPlaceCandidates = placeList.slice(0, todayCandidateLimit);
  const driveTimeByPlaceId = new Map<string, DriveTimeResult>();
  if (home) {
    const routingProvider = getRoutingProvider();
    const geolocated = todayPlaceCandidates.filter((p) => p.lat != null && p.lng != null);
    if (routingProvider && geolocated.length) {
      const results = await routingProvider.getDriveTimes(home, geolocated.map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
      if (results) geolocated.forEach((p, i) => { const result = results[i]; if (result) driveTimeByPlaceId.set(p.id, result); });
    }
  }
  const rankedTodayPlaces = [...todayPlaceCandidates].sort((a, b) => {
    const aKey = driveTimeByPlaceId.get(a.id)?.durationMinutes ?? straightLineByPlaceId.get(a.id) ?? Number.POSITIVE_INFINITY;
    const bKey = driveTimeByPlaceId.get(b.id)?.durationMinutes ?? straightLineByPlaceId.get(b.id) ?? Number.POSITIVE_INFINITY;
    return aKey - bKey;
  });
  placeList = rankedTodayPlaces.slice(0, todayDisplayLimit);

  const placeIds = placeList.map((p) => p.id);
  const { data: placeTips } = activeGroupId && placeIds.length ? await supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("place_id", placeIds) : { data: [] };
  const placeTipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of (placeTips ?? []) as PlaceTip[]) { if (!t.place_id) continue; const list = placeTipsByPlaceId[t.place_id] ?? []; list.push({ ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" }); placeTipsByPlaceId[t.place_id] = list; }

  const weatherByPlaceId = new Map<string, Weather | null>();
  await Promise.all(placeList.map(async (place) => {
    if (place.lat == null || place.lng == null) { weatherByPlaceId.set(place.id, null); return; }
    weatherByPlaceId.set(place.id, await getWeatherAtLocation({ lat: place.lat, lng: place.lng }, now.toISOString()));
  }));

  const todayLabel = todayStart.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const { text: greetingText, emoji: greetingEmoji } = greeting(now);
  const name = firstName(myProfile?.display_name);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">{greetingText}{name ? `, ${name}` : ""} {greetingEmoji}</h1>
        <p className="mb-6 text-sm text-zinc-500">{todayLabel}{homeWeather && <> · {weatherSummary(homeWeather)}</>}</p>
        {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}
        {groupList.length > 1 && <div className="mb-6 flex flex-wrap items-center gap-2 text-sm"><span className="text-zinc-500">Group:</span>{groupList.map((g) => <a key={g.id} href={`/today?group=${g.id}`} className={g.id === activeGroupId ? "rounded-full bg-zinc-900 px-3 py-1 font-medium text-white" : "rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:border-zinc-500"}>{g.name}</a>)}</div>}
        {!home && <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Set your home location in <a href="/settings" className="underline">Settings</a> to see how far places are from you.</p>}

        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-zinc-900">Happening today</h2><p className="mt-1 text-xs text-zinc-500">A few picks, not a calendar.</p></div><a href="/calendar" className="text-xs font-medium text-zinc-600 underline underline-offset-2">See all</a></div>
          <TodayFeed bundles={eventBundles} currentUserId={user.id} currentUserName={currentUserName} hasActiveGroup={Boolean(activeGroupId)} activeGroupId={activeGroupId} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} childAgeMonths={myProfile?.child_age_months ?? null} />
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-zinc-900">Good options for your family</h2><p className="mt-1 text-xs text-zinc-500">A few good ideas — Explorer has the full directory.</p></div><a href="/explore" className="text-xs font-medium text-zinc-600 underline underline-offset-2">See all</a></div>
          {placeList.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">No curated places yet in your market — check back soon, or ask your group for their favorites.</p> : <div className="flex flex-col gap-4">{placeList.map((place) => <PlaceCard key={place.id} place={place} groupId={activeGroupId} groupName={activeGroupName} currentUserId={user.id} tips={placeTipsByPlaceId[place.id] ?? []} distance={straightLineByPlaceId.has(place.id) ? { km: straightLineByPlaceId.get(place.id)!, driveMinutes: driveTimeByPlaceId.get(place.id)?.durationMinutes } : undefined} childAgeMonths={myProfile?.child_age_months ?? null} weather={weatherByPlaceId.get(place.id) ?? null} />)}</div>}
        </section>
      </div>
    </div>
  );
}