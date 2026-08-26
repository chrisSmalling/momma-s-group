# Production release checklist

Every production change follows this sequence:

1. Open/modify a PR from a feature branch.
2. Keep database DDL in `supabase/migrations/` and update `db/schema-snapshot.sql` in the same PR.
3. Require unit tests, build, typecheck, lint, and schema-migration verification to pass.
4. Verify the Vercel preview deployment is `READY` and inspect build/runtime errors.
5. Run the authenticated mobile smoke path: login → onboarding (when applicable) → Today → Poppy → recommendation → detail → RSVP/group coordination.
6. For location features, verify home location remains persistent while current device location is temporary and optional.
7. Merge only after the preview and required checks are green.
8. Verify the production deployment resolves to the merge commit.
9. Check production runtime errors after rollout.
10. If a release changes recommendation behavior, run the recommendation regression suite and inspect at least one realistic mom request for geography, time, price, age, and weather constraints.

## Poppy release gates

- Hard constraints are applied before ranking.
- Explicit proximity requests do not surface candidates without measurable distance.
- Explicit price ceilings reject known costs above the ceiling.
- Freshness is visible and influences ranking.
- Recommendation explanations describe grounded reasons rather than invented facts.
- Current location is never stored as the user's home location.
- Feedback endpoints require authentication and validate ownership before writes.
