"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);
  // "Go back" returns to wherever the user came from (e.g. the calendar
  // month they were on before a Prev/Next navigation errored out), instead
  // of always bouncing them to /today. Falls back to /today only when
  // there's no in-app history to go back to (e.g. a fresh tab / deep link).
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/today");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-zinc-200 sm:p-9">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-xl">!</div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-zinc-950">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Momma&apos;s Meetup hit a temporary snag. Your plans are still safe. Try again, and if it keeps happening, come back in a minute.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={() => reset()} className="min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            Try again
          </button>
          <button onClick={goBack} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}
