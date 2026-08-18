import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { monthParam } from "@/lib/date";
import Nav from "@/components/Nav";
import MarkFreeForm from "@/components/MarkFreeForm";
import FreeWindowsLive from "@/components/FreeWindowsLive";
import { removeFreeWindow } from "./actions";

const DAYS_AHEAD = 14;

type WhoIsFreeWindow = {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

type WhoIsFreeOverlap = {
  user_id: string;
  display_name: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

type WhoIsFreeEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
};

// IMPORTANT — best-effort guess, not verified against the live schema.
// The Supabase MCP connection was unavailable for this entire session, so
// this shape (a single jsonb object with my_windows/overlaps/events keys)
// could not be confirmed against who_is_free()'s actual return type. If the
// real function returns something else — a row set with a different
// structure, differently-named keys, etc. — this page will need updating
// once that's verified. Confirm before relying on this in production.
type WhoIsFreeResult = {
  my_windows: WhoIsFreeWindow[];
  overlaps: WhoIsFreeOverlap[];
  events: WhoIsFreeEvent[];
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

  let result: WhoIsFreeResult | null = null;
  let rpcError: string | null = null;
  if (activeGroupId) {
    const { data, error } = await supabase.rpc("who_is_free", {
      target_group: activeGroupId,
      days_ahead: DAYS_AHEAD,
    });
    if (error) {
      rpcError = error.message;
    } else {
      result = data as WhoIsFreeResult;
    }
  }

  const myWindows = result?.my_windows ?? [];
  const overlaps = result?.overlaps ?? [];
  const fittingEvents = result?.events ?? [];

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="mb-1 text-xl font-bold text-zinc-900">We&apos;re Free</h1>
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
                <p className="text-sm text-zinc-400">Nothing marked yet.</p>
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
                          className="text-xs text-zinc-400 underline hover:text-zinc-600"
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
              {overlaps.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No overlapping free time yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overlaps.map((o, i) => (
                    <li
                      key={`${o.user_id}-${i}`}
                      className="rounded-lg bg-rose-50 px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-rose-700">
                        {o.user_id === user.id ? "You" : o.display_name}
                      </p>
                      <p className="text-zinc-600">
                        {formatRange(o.starts_at, o.ends_at)}
                      </p>
                      {o.note && (
                        <p className="text-xs text-zinc-500">{o.note}</p>
                      )}
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
                <p className="text-sm text-zinc-400">
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
                        {e.venue_name ? ` · ${e.venue_name}` : ""}
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
