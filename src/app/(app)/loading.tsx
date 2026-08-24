export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-1" aria-label="Loading" role="status">
      <div className="mb-6 h-16 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="mb-4 h-11 w-28 animate-pulse rounded-full bg-zinc-100" />
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="h-7 w-4/5 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 h-4 w-2/5 animate-pulse rounded bg-zinc-100" />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-50" />
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-50" />
        </div>
        <div className="mt-3 h-20 animate-pulse rounded-2xl bg-zinc-50" />
      </div>
    </div>
  );
}
