"use client";

import { useRef } from "react";
import { markFree } from "@/app/(app)/free/actions";

// Same timezone fix as everywhere else datetime-local is used: convert to a
// UTC instant in the browser, not the server, so the server's own timezone
// doesn't shift the window.
function toIsoInstant(localValue: string) {
  return localValue ? new Date(localValue).toISOString() : "";
}

export default function MarkFreeForm({
  groups,
}: {
  groups: { id: string; name: string }[];
}) {
  const startsIso = useRef<HTMLInputElement>(null);
  const endsIso = useRef<HTMLInputElement>(null);

  return (
    <form action={markFree} className="flex flex-col gap-3">
      <input type="hidden" name="starts_at" ref={startsIso} />
      <input type="hidden" name="ends_at" ref={endsIso} />

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

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Free from
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
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Until
          <input
            type="datetime-local"
            required
            onChange={(e) => {
              if (endsIso.current) {
                endsIso.current.value = toIsoInstant(e.target.value);
              }
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      <input
        type="text"
        name="note"
        maxLength={200}
        placeholder="Note (optional) — e.g. flexible, park or indoor"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />

      <button
        type="submit"
        className="self-start rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
      >
        We&apos;re free
      </button>
    </form>
  );
}
