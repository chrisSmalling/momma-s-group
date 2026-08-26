# Mom Intelligence Implementation

## Objective
Make activity recommendations decision-ready for moms without requiring multiple external sites.

## Acceptance criteria
- Show verified/freshness state when verification data exists.
- Clearly distinguish source facts from community-reported tips.
- Surface practical family details when available: stroller access, changing table, nursing, parking, crowd notes, best time, what to bring.
- Never invent missing information.
- Keep missing data explicitly unknown rather than presenting empty placeholders.
- Preserve existing Poppy hard constraints for time, price, geography, age, and indoor/outdoor intent.
- Keep current-location searches temporary and privacy-preserving.

## Release gate
Unit tests, typecheck, lint, build, schema checks, and production smoke verification must pass before merge.

## Follow-on
After this layer is stable, implement group coordination, post-outing feedback, and intelligent weekly planning.
