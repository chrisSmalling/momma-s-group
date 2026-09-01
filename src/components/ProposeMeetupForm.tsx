"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { proposeMeetup } from "@/app/(app)/places/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Proposing…" : "Propose meetup"}
    </button>
  );
}

// Keep the browser's local wall-clock value in state, then convert it in the
// browser at submit time. This avoids a hidden input becoming stale/empty when
// a browser restores or autofills the datetime control without firing change.
function toIsoInstant(localValue: string) {
  if (!localValue) return "";
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export default function ProposeMeetupForm({
  placeId,
  groups,
  defaultGroupId,
}: {
  placeId: string;
  groups: { id: string; name: string }[];
  defaultGroupId?: string;
}) {
  const [localDateTime, setLocalDateTime] = useState("");
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  return (
    <form
      action={proposeMeetup}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        if (!localDateTime) {
          event.preventDefault();
          setDateTimeError("Pick a date and time for the meetup.");
          return;
        }

        const form = event.currentTarget;
        const existing = form.querySelector<HTMLInputElement>("input[name='starts_at']");
        if (existing) existing.value = toIsoInstant(localDateTime);
      }}
    >
      <input type="hidden" name="place_id" value={placeId} />
      <input type="hidden" name="starts_at" value={toIsoInstant(localDateTime)} readOnly />

      {groups.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Group
          <select
            name="group_id"
            required
            defaultValue={defaultGroupId ?? ""}
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
          value={localDateTime}
          onChange={(e) => { setLocalDateTime(e.target.value); if (dateTimeError) setDateTimeError(null); }}
          aria-invalid={dateTimeError ? true : undefined}
          aria-describedby={dateTimeError ? "datetime-error" : undefined}
          className={`rounded-md border px-3 py-2 text-sm text-zinc-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 ${dateTimeError ? "border-rose-500" : "border-zinc-300"}`}
        />
        {dateTimeError && <p id="datetime-error" role="alert" className="text-xs font-medium text-rose-600">{dateTimeError}</p>}
      </label>

      <SubmitButton />
    </form>
  );
}
