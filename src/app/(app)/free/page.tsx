import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { monthParam } from "@/lib/date";
import Nav from "@/components/Nav";
import MarkFreeForm from "@/components/MarkFreeForm";
import FreeWindowsLive from "@/components/FreeWindowsLive";
import { removeFreeWindow } from "./actions";

const DAYS_AHEAD = 14;

type MyWindow = {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

type MatchingEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  cost: string | null;
};

// Confirmed against the live database: who_is_free(target_group, days_ahead)
// returns one row per one of the caller's own upcoming free windows, each
// paired with the display names of other group members whose windows
// overlap it and the events that fall inside it.
type WhoIsFreeRow = {
  window_start: string;
  window_end: string;
  also_free: string[];
  matching_events: MatchingEvent[] | null;
};

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return sameDay
    ? `${dateStr}, ${startTime}–${endTime}`
    : `${dateStr} ${startTime} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${endTime}`;
}

export default async function FreePage(props: PageProps<"/free">) {
  const searchParams = await props.searchParams;
  const requestedGroup =
    typeof searchParams.group === "string" ? searchParams.group : undefined;
  const paramError =
    typeof searchParams.error === "string" ? searchParams.error : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .order("created_at", { ascending: true });
  const groupList = groups ?? [];

  const activeGroupId =
    (requestedGroup && groupList.some((g) => g.id === requestedGroup)
      ? requestedGroup
      : groupList[0]?.id) ?? null;
  const activeGroupName =
    groupList.find((g) => g.id === activeGroupId)?.name ?? null;

  // "Your upcoming free windows" needs id/note for the Remove form, which
  // who_is_free() doesn't return — read those straight from the table.
  const { data: myWindowsData } = activeGroupId
    ? await supabase
        .from("availability")
        .select("id, starts_at, ends_at, note")
        .eq("group_id", activeGroupId)
        .eq("user_id", user.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
    : { data: null };
  const myWindows = (myWindowsData ?? []) as MyWindow[];

  let whoIsFreeRows: WhoIsFreeRow[] = [];
  let rpcError: string | null = null;
  if (activeGroupId) {
    const { data, error } = await supabase.rpc("who_is_free", {
      target_group: activeGroupId,
      days_ahead: DAYS_AHEAD,
    });
    if (error) {
      rpcError = error.message;
    } else {
      whoIsFreeRows = (data ?? []) as WhoIsFreeRow[];
    }
  }

  const overlapRows = whoIsFreeRows.filter((row) => row.also_free.length > 0);

  const eventsById = new Map<string, MatchingEvent>();
  for (const row of whoIsFreeRows) {
    for (const event of row.matching_events ?? []) {
      eventsById.set(event.id, event);
    }
  }
  const fittingEvents = Array.from(eventsById.values()).sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">We&apos;re free</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Mark a window when you&apos;re free to meet up, and see who else in
          your group overlaps.
        </p>

        {paramError && <p className="mb-4 text-sm text-red-600">{paramError}</p>}
        {rpcError && (
          <p className="mb-4 text-sm text-red-600">
            Couldn&apos;t load free windows: {rpcError}
          </p>
        )}

        {groupList.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You need to be in a group to use this —{" "}
            <Link href="/groups" className="underline">
              create or join one
            </Link>
            .
          </p>
        ) : (
          <>
            {groupList.length > 1 && (
              <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">Group:</span>
                {groupList.map((g) => (
                  <Link
                    key={g.id}
                    href={`/free?group=${g.id}`}
                    className={
                      g.id === activeGroupId
                        ? "rounded-full bg-zinc-900 px-3 py-1 font-medium text-white"
                        : "rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:border-zinc-500"
                    }
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}

            <FreeWindowsLive groupId={activeGroupId} />

            <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700">
                Mark a free window
              </h2>
              <MarkFreeForm groups={groupList} />
            </div>

            <section className="mb-8">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                Your upcoming free windows
              </h2>
              {myWindows.length === 0 ? (
                <p className="text-sm text-zinc-600">Nothing marked yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {myWindows.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="text-zinc-700">
                          {formatRange(w.starts_at, w.ends_at)}
                        </p>
                        {w.note && (
                          <p className="text-xs text-zinc-500">{w.note}</p>
                        )}
                      </div>
                      <form action={removeFreeWindow}>
                        <input type="hidden" name="id" value={w.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-rose-700 underline hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-8">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                Who else in {activeGroupName ?? "your group"} overlaps
              </h2>
              {overlapRows.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  No overlapping free time yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overlapRows.map((row) => (
                    <li
                      key={`${row.window_start}-${row.window_end}`}
                      className="rounded-lg bg-rose-50 px-3 py-2 text-sm"
                    >
                      <p className="text-zinc-600">
                        {formatRange(row.window_start, row.window_end)}
                      </p>
                      <p className="font-medium text-rose-700">
                        {row.also_free.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                Events that fit
              </h2>
              {fittingEvents.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  No upcoming events fall inside a free window yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {fittingEvents.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-lg bg-emerald-50 px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/calendar?month=${monthParam(new Date(e.starts_at))}&group=${activeGroupId}#event-${e.id}`}
                        className="font-medium text-emerald-700 underline"
                      >
                        {e.title}
                      </Link>
                      <p className="text-zinc-600">
                        {new Date(e.starts_at).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {e.venue ? ` · ${e.venue}` : ""}
                        {e.cost ? ` · ${e.cost}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
