import { addTip } from "@/app/(app)/places/actions";
import type { PlaceTip, TipCategory } from "@/types";

const CATEGORY_LABELS: Record<TipCategory, string> = {
  general: "General",
  parking: "Parking",
  timing: "Timing",
  facilities: "Facilities",
  cost: "Cost",
  accessibility: "Accessibility",
};

type TipDisplay = PlaceTip & { display_name: string };

export default function TipsSection({
  placeId,
  eventId,
  groupId,
  groupName,
  currentUserId,
  tips,
}: {
  placeId?: string;
  eventId?: string;
  groupId: string | null;
  groupName: string | null;
  currentUserId: string;
  tips: TipDisplay[];
}) {
  if (!groupId) {
    return (
      <p className="text-sm text-zinc-600">Join a group to see and add tips.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-500">
          Tips from {groupName ?? "your group"}
        </p>
        {tips.length === 0 ? (
          <p className="text-sm text-zinc-600">No tips yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tips.map((tip) => (
              <li
                key={tip.id}
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm"
              >
                <div className="mb-0.5 flex items-center gap-2 text-[11px] font-medium text-amber-700">
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5">
                    {CATEGORY_LABELS[tip.category]}
                  </span>
                  <span className="text-zinc-500">
                    {tip.user_id === currentUserId ? "You" : tip.display_name}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-zinc-700">{tip.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={addTip} className="flex flex-col gap-2">
        {placeId && <input type="hidden" name="place_id" value={placeId} />}
        {eventId && <input type="hidden" name="event_id" value={eventId} />}
        <input type="hidden" name="group_id" value={groupId} />
        <textarea
          name="body"
          maxLength={500}
          rows={2}
          required
          placeholder="Add a tip for the group…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <div className="flex items-center gap-2">
          <select
            name="category"
            defaultValue="general"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs text-zinc-600 outline-none focus:border-zinc-500"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-amber-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            Add tip
          </button>
        </div>
      </form>
    </div>
  );
}
