# Deployment note

Vercel production deploys from `main`. Supabase Edge Functions under `supabase/functions/` are deployed separately and are excluded from the Next.js TypeScript build.
