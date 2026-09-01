import type { PlaceHours } from "@/types";

const DAY_ORDER: (keyof PlaceHours)[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function formatClock(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h24 = parseInt(hStr, 10);
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 || 12;
  return mStr && mStr !== "00" ? `${h12}:${mStr}${period}` : `${h12}${period}`;
}

function formatRange(range: string): string {
  const [start, end] = range.split("-");
  if (!start || !end) return range;
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function formatHours(hours: PlaceHours | null): { day: string; range: string }[] {
  if (!hours) return [];
  return DAY_ORDER.filter((day) => hours[day]).map((day) => ({
    day: DAY_LABELS[day],
    range: formatRange(hours[day] as string),
  }));
}

// Collapses the full weekly grid down to a single line for today, for
// results-list contexts where a full grid per card is too much vertical
// density (see PlaceSearchCard). The detail page keeps the full grid via
// formatHours above.
export function formatTodayHours(hours: PlaceHours | null): string | null {
  if (!hours) return null;
  const todayKey = DAY_ORDER[(new Date().getDay() + 6) % 7];
  const range = hours[todayKey];
  return range ? `Today ${formatRange(range)}` : "Closed today";
}
