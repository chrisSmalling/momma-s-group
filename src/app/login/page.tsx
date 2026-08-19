"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [googleStatus, setGoogleStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGoogleSignIn() {
    setGoogleStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
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
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-1">
          Momma&apos;s Meetup
        </h1>
        <p className="text-center text-zinc-500 mb-8">
          A simple way for moms to figure out what to do today.
        </p>

        {status === "sent" ? (
          <p className="text-center text-zinc-700">
            Check <span className="font-medium">{email}</span> for a sign-in
            link.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleStatus === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              {googleStatus === "sending" ? "Connecting..." : "Continue with Google"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200" />
              <span>or</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {status === "sending" ? "Sending..." : "Send magic link"}
              </button>
            </form>
          </>
        )}

        {(status === "error" || googleStatus === "error") && (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
