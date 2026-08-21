import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">404</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">That page wandered off.</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Let&apos;s get you back to the outings that matter.</p>
        <Link href="/today" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          See Today&apos;s outings
        </Link>
      </section>
    </main>
  );
}
