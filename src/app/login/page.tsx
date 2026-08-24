"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteFooter from "@/components/SiteFooter";

const benefits = [
  ["Today-first", "A short list of genuinely good options instead of a giant calendar."],
  ["Kid-aware", "Age fit, nap timing, weather, distance, and practical details are built in."],
  ["Together", "See what your group is doing and make plans without another group chat."],
] as const;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") ?? "/today" : "/today";

  async function handleGoogleSignIn() {
    setGoogleStatus("sending");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setGoogleStatus("error");
      setErrorMessage(error.message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <>
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 md:grid-cols-[1.1fr_.9fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-rose-900 via-rose-800 to-zinc-900 p-10 text-white md:flex">
          <div>
            <div className="mb-12 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-rose-200">MOMMA&apos;S MEETUP</div>
            <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Make today easier to figure out.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-zinc-300">A private place for moms to find good local outings, see what friends are doing, and make a plan without scrolling forever.</p>
          </div>
          <div className="space-y-5">
            {benefits.map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold">✓</span>
                <div><div className="text-sm font-bold">{title}</div><div className="mt-1 text-xs leading-5 text-zinc-400">{body}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-7 sm:p-10">
          <div className="mb-8 md:hidden">
            <div className="text-lg font-extrabold tracking-tight text-zinc-950">Momma&apos;s Meetup</div>
            <p className="mt-1 text-sm text-zinc-500">Find something worth doing.</p>
          </div>
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Sign in to see what&apos;s happening around your family today.</p>
          </div>

          {status === "sent" ? (
            <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
              <div className="font-bold">Check your email</div>
              <p className="mt-1 leading-6">We sent a secure sign-in link to <span className="font-semibold">{email}</span>.</p>
              <button type="button" onClick={() => setStatus("idle")} className="mt-4 text-xs font-semibold underline underline-offset-2">Use a different email</button>
            </div>
          ) : (
            <>
              <button type="button" onClick={handleGoogleSignIn} disabled={googleStatus === "sending"} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                {googleStatus === "sending" ? "Connecting…" : "Continue with Google"}
              </button>
              <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400"><div className="h-px flex-1 bg-zinc-200" /><span>or email</span><div className="h-px flex-1 bg-zinc-200" /></div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-zinc-700" htmlFor="email">Email address</label>
                <input id="email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 rounded-xl border border-zinc-300 px-3.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10" />
                <button type="submit" disabled={status === "sending"} className="mt-1 min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">{status === "sending" ? "Sending secure link…" : "Send me a sign-in link"}</button>
              </form>
            </>
          )}
          {(status === "error" || googleStatus === "error") && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
          <p className="mt-7 text-center text-[11px] leading-5 text-zinc-400">Private by design. Your groups and plans are only visible to the people who belong in them.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
