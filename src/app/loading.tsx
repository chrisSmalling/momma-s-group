export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-16 rounded-2xl bg-white ring-1 ring-zinc-200" />
        <div className="h-32 rounded-3xl bg-zinc-900" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-52 rounded-2xl bg-white ring-1 ring-zinc-200" />
          ))}
        </div>
      </div>
    </main>
  );
}
