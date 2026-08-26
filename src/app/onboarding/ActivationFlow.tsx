"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "./actions";

const INTERESTS = [
  ["animals", "Animals"],
  ["water", "Water"],
  ["playgrounds", "Playgrounds"],
  ["arts_and_crafts", "Arts & crafts"],
  ["books", "Books"],
  ["music", "Music"],
  ["sports", "Sports"],
  ["adventure", "Adventure"],
  ["science", "Science"],
  ["trains", "Trains"],
  ["flying", "Things that fly"],
  ["food", "Food"],
] as const;

const CATEGORIES = [
  ["active_play", "Active play"],
  ["animals", "Animals"],
  ["arts_learning", "Learn & create"],
  ["playground", "Playgrounds"],
  ["storytime", "Storytime"],
  ["water_play", "Water play"],
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-12 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60">{pending ? "Getting Poppy ready…" : "Finish & show me today"}</button>;
}

export default function ActivationFlow({ error }: { error?: string }) {
  const [step, setStep] = useState(1);
  const [age, setAge] = useState("");

  function nextFromAge() {
    const value = Number(age);
    if (age.trim() && Number.isFinite(value) && value >= 0 && value <= 144) setStep(2);
  }

  return (
    <form action={completeOnboarding} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/50 sm:p-7">
      <input type="hidden" name="child_age_months" value={age} />
      <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-rose-600" : "bg-zinc-200"}`} />)}
      </div>

      {error && <p role="alert" className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {step === 1 && (
        <section>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Step 1 · Your little one</div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-950">Let’s make Poppy actually know what works for your family.</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Age is the most useful first signal. Everything else can stay flexible.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-zinc-700">Child age <span className="text-rose-600">*</span><div className="mt-1 flex items-center gap-2"><input autoFocus required min={0} max={144} type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="24" className="min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /><span className="text-sm font-medium text-zinc-500">months</span></div></label>
            <label className="text-sm font-semibold text-zinc-700">Child’s name <span className="font-normal text-zinc-400">optional</span><input name="child_name" type="text" maxLength={60} placeholder="Emma" className="mt-1 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /></label>
          </div>
          <button type="button" onClick={nextFromAge} className="mt-6 min-h-12 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white">Next</button>
        </section>
      )}

      {step === 2 && (
        <section>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Step 2 · What sounds good?</div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-950">Give Poppy a few clues.</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Pick anything that sounds like your family. You can change this later.</p>

          <fieldset className="mt-5"><legend className="text-sm font-bold text-zinc-800">Interests</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{INTERESTS.map(([value, label]) => <label key={value} className="cursor-pointer"><input type="checkbox" name="child_interests" value={value} className="peer sr-only" /><span className="flex min-h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700">{label}</span></label>)}</div></fieldset>

          <fieldset className="mt-5"><legend className="text-sm font-bold text-zinc-800">Usually prefer</legend><div className="mt-3 grid grid-cols-3 gap-2">{([["either", "Either"], ["outdoor", "Outside"], ["indoor", "Inside"]] as const).map(([value, label]) => <label key={value} className="cursor-pointer"><input type="radio" name="indoor_preference" value={value} defaultChecked={value === "either"} className="peer sr-only" /><span className="flex min-h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700">{label}</span></label>)}</div></fieldset>

          <fieldset className="mt-5"><legend className="text-sm font-bold text-zinc-800">Good to know</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-zinc-600">Budget<input name="family_budget_note" type="text" maxLength={200} placeholder="Free or low-cost is great" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-rose-500" /></label><label className="text-xs font-semibold text-zinc-600">How far are you usually willing to drive?<select name="max_distance_miles" defaultValue="20" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-rose-500"><option value="5">5 miles</option><option value="10">10 miles</option><option value="20">20 miles</option><option value="30">30 miles</option><option value="45">45 miles</option></select></label></div></fieldset>

          <fieldset className="mt-5"><legend className="text-sm font-bold text-zinc-800">Poppy can prioritize</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{CATEGORIES.map(([value, label]) => <label key={value} className="cursor-pointer"><input type="checkbox" name="preferred_categories" value={value} className="peer sr-only" /><span className="flex min-h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700">{label}</span></label>)}</div></fieldset>

          <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => setStep(1)} className="min-h-12 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-700">Back</button><button type="button" onClick={() => setStep(3)} className="min-h-12 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white">Next</button></div>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Step 3 · Around you</div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-950">One last thing: where should Poppy look?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">A home location makes distance-based picks better. It’s optional, and you can use your current location later instead.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-600 sm:col-span-2">Street address<input name="home_street" type="text" autoComplete="street-address" placeholder="123 Main St" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-rose-500" /></label>
            <label className="text-xs font-semibold text-zinc-600">City<input name="home_city" type="text" autoComplete="address-level2" placeholder="Wesley Chapel" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-rose-500" /></label>
            <label className="text-xs font-semibold text-zinc-600">State<input name="home_state" type="text" maxLength={2} autoComplete="address-level1" placeholder="FL" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm uppercase outline-none focus:border-rose-500" /></label>
            <label className="text-xs font-semibold text-zinc-600">ZIP code<input name="home_zip" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="33544" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-rose-500" /></label>
          </div>
          <p className="mt-4 text-xs text-zinc-500">Prefer not to save a home address? Leave it blank. Poppy can still use “Find near me” when you’re out.</p>
          <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => setStep(2)} className="min-h-12 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-700">Back</button><SubmitButton /></div>
        </section>
      )}
    </form>
  );
}
