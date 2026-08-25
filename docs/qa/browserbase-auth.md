# Browserbase production QA authentication

The Phase 1 Browserbase audit tests the real protected application routes without weakening route protection or requiring a developer to create/delete a test user for every run.

## Required GitHub Actions secrets

- `BROWSERBASE_API_KEY` — existing Browserbase credential.
- `QA_EMAIL` — dedicated Supabase QA account email.
- `QA_PASSWORD` — dedicated Supabase QA account password.
- `QA_AUTH_SECRET` — long random secret used only by the QA authentication bootstrap endpoint.

## Required Vercel environment variable

Add `QA_AUTH_SECRET` to the **Production** environment for the Momma's Meetup Vercel project. Its value must exactly match the GitHub Actions `QA_AUTH_SECRET` secret.

Do not commit any of these values to the repository.

## QA account

A dedicated QA account already exists in the production Supabase project:

`phase1-qa@mommasmeetup.test`

It is a non-real test identity associated with the dedicated `QA Test Group`. Put its password in the GitHub Actions `QA_PASSWORD` secret; never commit or paste the password into source control.

The workflow does not create or delete the account during normal runs. This makes the audit repeatable and removes the manual account-provisioning step.

## Authentication flow

The Browserbase job:

1. Waits for the production URL to become reachable after a deployment.
2. Opens `/login`.
3. Calls the secret-gated `/api/qa/auth` route with the QA credentials.
4. Establishes a normal Supabase session through `signInWithPassword`.
5. Verifies `/today` is accessible without redirecting back to `/login`.
6. Runs the read-only UI assertions against the real protected routes.

The `/api/qa/auth` route does not bypass application authorization; it only establishes a normal Supabase session. The existing protected routes remain protected.

## Current production routes under test

- `/today`
- `/places` — Explorer
- `/calendar`
- `/groups`

The audit intentionally tests `/places`, not `/explore`; `/explore` is not an application route.

## Failure behavior

A production availability, authentication, or page HTTP failure is treated as an infrastructure failure. The harness stops downstream UI assertions instead of reporting a cascade of meaningless selector failures.

The harness exits non-zero when any assertion fails, and the workflow retains screenshots as a GitHub Actions artifact for seven days.
