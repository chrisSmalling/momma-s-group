# Browserbase production QA authentication

The Phase 1 Browserbase audit tests the real protected application routes without requiring a developer to create/delete a test user for every run.

## Required GitHub Actions secrets

- `BROWSERBASE_API_KEY`
- `QA_EMAIL`
- `QA_PASSWORD`
- `QA_AUTH_SECRET`

Add `QA_AUTH_SECRET` to the Vercel **Production** environment with the exact same value as the GitHub secret. Never commit these values.

## Dedicated QA account

A dedicated non-real Supabase account already exists:

`phase1-qa@mommasmeetup.test`

It belongs to the dedicated `QA Test Group`. Put its password in `QA_PASSWORD` and do not use a real member's credentials.

The workflow reuses this account. No manual account creation/deletion is required for normal audits.

## Flow

1. Wait for production `/login` to become reachable after deployment.
2. Call the secret-gated `/api/qa/auth` route.
3. Establish a normal Supabase session with `signInWithPassword`.
4. Verify `/today` is accessible without redirecting to `/login`.
5. Test `/today`, `/places`, `/calendar`, and `/groups` on a 390×844 mobile viewport.
6. Upload screenshots for seven days.

The QA endpoint does not bypass application authorization. It only establishes a normal Supabase session; existing protected routes remain protected.

## Important route correction

The app's Explorer route is `/places`, not `/explore`. The old audit was testing `/explore`, which guaranteed a 404 and then cascaded into false Explorer failures.

## Failure behavior

Production availability, authentication, and page HTTP failures stop downstream UI assertions. The audit exits non-zero when any assertion fails, so a red audit is actually actionable CI rather than a table of failures that still exits successfully.
