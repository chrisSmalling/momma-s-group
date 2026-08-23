"use client";

import { useRef } from "react";
import { proposeMeetup } from "@/app/(app)/places/actions";

// datetime-local inputs give a naive "wall clock" string with no timezone.
// Converting it to an ISO instant here (in the browser) uses the browser's
// timezone; doing that conversion in the server action instead would use
// the server's timezone and could shift the meetup onto the wrong day.
function toIsoInstant(localValue: string) {
  return localValue ? new Date(localValue).toISOString() : "";
}

export default function ProposeMeetupForm({
  placeId,
  groups,
}: {
  placeId: string;
  groups: { id: string; name: string }[];
}) {
  const startsIso = useRef<HTMLInputElement>(null);

  return (
    <form action={proposeMeetup} className="flex flex-col gap-3">
      <input type="hidden" name="place_id" value={placeId} />
      <input type="hidden" name="starts_at" ref={startsIso} />

      {groups.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Group
          <select
            name="group_id"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          >
            <option value="" disabled>
              Choose a group
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="group_id" value={groups[0]?.id ?? ""} />
      )}

      <label className="flex flex-col gap-1 text-sm text-zinc-600">
        Date &amp; time
        <input
          type="datetime-local"
          required
          onChange={(e) => {
            if (startsIso.current) {
              startsIso.current.value = toIsoInstant(e.target.value);
            }
          }}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </label>

      <button
        type="submit"
        className="self-start rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
      >
        Propose meetup
      </button>
    </form>
  );
}
