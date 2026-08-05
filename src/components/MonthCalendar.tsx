const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthCalendar({ date = new Date() }: { date?: Date }) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">{monthLabel}</h2>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 text-sm">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-zinc-50 px-2 py-1.5 text-center font-medium text-zinc-500"
          >
            {day}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-16 bg-white px-2 py-1.5 ${
              day === null ? "bg-zinc-50" : ""
            }`}
          >
            {day !== null && (
              <span
                className={
                  isCurrentMonth && day === today.getDate()
                    ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white"
                    : "text-zinc-700"
                }
              >
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-zinc-500">No outings yet.</p>
    </div>
  );
}
