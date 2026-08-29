# momma-s-group

# Momma's Meetup — Build Plan

A private, group-based calendar for finding local toddler outings and seeing who
from your circle is going. First real milestone: **two accounts, one shared group,
RSVPs that sync between devices.**

---

## Stack

| Layer      | Choice                        | Why                                                        |
|------------|-------------------------------|------------------------------------------------------------|
| Frontend   | Next.js (App Router) + React + TypeScript | Reuses the prototype UI; one language end-to-end |
| Backend    | Next.js server actions / route handlers   | No separate server to run or host        |
| Database   | Supabase (managed Postgres)   | Postgres + Auth + row-level security in one free product   |
| Auth       | Supabase Auth (email)         | Email magic-link or password — perfect for two test accounts |
| Hosting    | Vercel (app) + Supabase (data)| Both free tier; push-to-deploy                             |
| Later      | Vercel Cron / Supabase Edge Fn| Weekly pull of library feeds (Communico / LibCal)          |

**The privacy rule is enforced in the database, not the UI.** A Postgres policy
says: you can read an RSVP row only if you share at least one group with the
person who made it. That's why "both my groups see my RSVP" is the *simpler*
design — the RSVP is stored per person per event, and visibility falls out of
shared membership automatically. See `db/schema-snapshot.sql`.

---

## Repo structure

```
mommas-meetup/
  README.md
  .env.example
  package.json
  db/
    schema-snapshot.sql     # generated; paste into the Supabase SQL editor to bootstrap
  supabase/
    migrations/              # canonical schema history (supabase db push/diff)
  src/
    lib/supabase/
      client.ts             # browser client
      server.ts             # server client (respects the logged-in user + RLS)
    app/
      layout.tsx
      page.tsx              # -> /calendar if signed in, else /login
      login/page.tsx        # email sign-in / sign-up
      calendar/page.tsx     # month view (port of the prototype)
      groups/page.tsx       # create / join / switch groups
    components/
      MonthCalendar.tsx
      EventCard.tsx
      GroupSwitcher.tsx
      RsvpButton.tsx
      AddEventForm.tsx
      Toast.tsx
    types.ts
```

---

## Phases (each ends with something you can actually test)

**Phase 0 — Foundations**
Create the Next.js app, create a Supabase project, run `db/schema-snapshot.sql`,
wire the Supabase client. Done when: one account can sign in and land on an
empty calendar.

**Phase 1 — Groups & invites**
Create a group (auto-generates an invite code), join a group by code.
Done when: **account A creates "The Mommas," account B joins with the code, and
both see the group.** This is the two-user handshake.

**Phase 2 — Events & RSVP**  ← *your target*
Add an outing manually, list the month, RSVP going/maybe, see group-scoped
attendees. Done when: **B RSVPs on B's login and A sees it on A's login**, and
someone outside the group never appears.

**Phase 3 — Calendar export & polish**
"Add to my calendar" generates a real `.ics`. Loading/empty states, mobile pass.
Done when: it's pleasant enough to hand to Vivian for daily use.

**Phase 4 — Feed ingestion (later)**
A weekly job pulls Pasco (Communico) + Hillsborough/Pinellas library events into
the `events` table so the recurring toddler programming fills in automatically.
This is the "definitive list without data entry" piece — but it's optional until
the core loop is proven.

You reach a genuinely usable two-person app at the end of **Phase 2**.

---

## Setup steps

1. **Supabase**: create a project → SQL Editor → paste and run
   `db/schema-snapshot.sql` (a generated snapshot of the full live schema —
   see `db/README.md`). Under Authentication, enable Email (magic link is
   simplest for two accounts). Alternatively, use the Supabase CLI
   (`supabase link` then `supabase db push`) to apply
   `supabase/migrations/` directly.
2. **Env**: copy `.env.example` to `.env.local` and fill in the project URL and
   anon key from Supabase → Project Settings → API.
3. **Run**: `npm install` then `npm run dev`.
4. **Deploy**: push to GitHub, import the repo in Vercel, add the same env vars.
   Test accounts can then sign in from any phone.

---

## The two queries that matter

**Writing an RSVP** — one row per person per event, so every group you're in sees it:

```ts
await supabase.from("rsvps").upsert({
  event_id: eventId,
  user_id: user.id,
  status: "going",           // or "maybe"
});
```

**Reading who's going** — RLS has already stripped out anyone you don't share a
group with, so you just fetch, then filter to whichever group is active in the UI:

```ts
const { data } = await supabase
  .from("rsvps")
  .select("status, user_id, profiles(display_name, avatar_color)")
  .eq("event_id", eventId);
// `data` only contains RSVPs you're allowed to see. Filter to active group members client-side.
```

---

## Next step

This is a repo you grow over several sessions, not a one-shot generate. Open it in
**Claude Code**, run `db/schema-snapshot.sql`, and build phase by phase — I can generate the
Next.js scaffolding, the auth pages, and the ported calendar component on request.
Start with Phase 0 and don't wire real event feeds until the two-user RSVP loop works.
