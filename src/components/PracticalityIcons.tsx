import type { VenuePracticalities } from "@/types";

const ICONS: {
  key: keyof VenuePracticalities;
  emoji: string;
  label: string;
}[] = [
  { key: "is_enclosed", emoji: "🛡️", label: "Enclosed" },
  { key: "has_changing_table", emoji: "🚼", label: "Changing table" },
  { key: "nursing_friendly", emoji: "🤱", label: "Nursing friendly" },
  { key: "stroller_accessible", emoji: "♿", label: "Stroller accessible" },
  { key: "food_onsite", emoji: "🍽️", label: "Food onsite" },
  {
    key: "quiet_or_sensory_friendly",
    emoji: "🔕",
    label: "Quiet / sensory-friendly",
  },
];

// Only affirmative flags render — there's no "no" icon, just a highlight
// reel of what's confirmed available. null/false are both treated as
// "don't show."
export default function PracticalityIcons({
  practicalities,
}: {
  practicalities: VenuePracticalities;
}) {
  const active = ICONS.filter((i) => practicalities[i.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((i) => (
        <span
          key={i.key}
          title={i.label}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
        >
          <span aria-hidden="true">{i.emoji}</span>
          {i.label}
        </span>
      ))}
    </div>
  );
}
