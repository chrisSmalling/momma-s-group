export default function IndoorOutdoorTag({ isOutdoor }: { isOutdoor: boolean }) {
  return (
    <span
      className={
        isOutdoor
          ? "inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
          : "inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
      }
    >
      {isOutdoor ? "Outdoor" : "Indoor"}
    </span>
  );
}
