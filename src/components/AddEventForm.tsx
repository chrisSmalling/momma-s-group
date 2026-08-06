"use client";

import { useRef } from "react";
import { addEvent } from "@/app/calendar/actions";

// datetime-local inputs give a naive "wall clock" string with no timezone.
// Converting it to an ISO instant here (in the browser) uses the browser's
// timezone; doing that conversion in the server action instead would use
// the server's timezone and could shift the event onto the wrong day.
function toIsoInstant(localValue: string) {
  return localValue ? new Date(localValue).toISOString() : "";
}

export default function AddEventForm() {
  const startsIso = useRef<HTMLInputElement>(null);
  const endsIso = useRef<HTMLInputElement>(null);

  return (
    <form
      action={addEvent}
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-700">Add an outing</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder="Title"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:col-span-2"
        />
        <input
          name="venue_name"
          placeholder="Venue"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <input
          name="cost"
          placeholder="Cost (blank = free)"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Starts
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
          <input type="hidden" name="starts_at" ref={startsIso} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Ends (optional)
          <input
            type="datetime-local"
            onChange={(e) => {
              if (endsIso.current) {
                endsIso.current.value = toIsoInstant(e.target.value);
              }
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
          <input type="hidden" name="ends_at" ref={endsIso} />
        </label>
        <input
          name="age_tags"
          placeholder="Age tags, comma separated (e.g. 0-2, toddler)"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:col-span-2"
        />
      </div>
      <button
        type="submit"
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Add outing
      </button>
    </form>
  );
}
