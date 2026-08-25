# Browserbase production QA authentication

The Phase 1 Browserbase audit tests the real protected application routes without weakening route protection.

## Required GitHub Actions secrets

- `BROWSERBASE_API_KEY` — existing Browserbase credential.
- `QA_EMAIL` — email for a dedicated Supabase QA account.
- `QA_PASSWORD` — password for that QA account.
- `QA_AUTH_SECRET` — long random secret used only by the QA authentication bootstrap endpoint.

## Required Vercel environment variable

Add `QA_AUTH_SECRET` to the **Production** environment for the Momma's Meetup Vercel project. Its value must exactly match the GitHub Actions `QA_AUTH_SECRET` secret.

Do not commit any of these values to the repository.

## QA account

Create a dedicated Supabase Auth user for QA. Give that account only the normal application access needed to render the protected pages. Do not use a real member's credentials.

The Browserbase job first opens `/login`, calls the secret-gated `/api/qa/auth` route with the QA credentials, verifies that `/today` is accessible without redirecting back to `/login`, and only then starts the UI assertions.

The `/api/qa/auth` route does not bypass application authorization; it only establishes a normal Supabase session. The existing protected routes remain protected.

## Failure behavior

A base URL, authentication, or page HTTP failure is treated as an infrastructure failure. The harness stops downstream UI assertions instead of reporting a cascade of meaningless selector failures.
