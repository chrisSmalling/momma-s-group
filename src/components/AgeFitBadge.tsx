// Only ever rendered when the caller has already confirmed a genuine
// positive match (see src/lib/ageFit.ts) — no "doesn't fit" counterpart,
// same affirmative-only rule as PracticalityIcons.
export default function AgeFitBadge() {
  return (
    <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      👶 Great for their age
    </span>
  );
}
