# Momma’s Meetup — Product Quality Gates

These gates apply to Poppy and the mom-facing discovery experience.

## Recommendation contract

Every natural-language request is resolved in this order:

1. Interpret explicit constraints.
2. Select search center: home by default, current device location only when explicitly requested/authorized.
3. Apply hard constraints before ranking.
4. Rank only candidates that survive hard constraints.
5. Generate explanations only from returned candidate facts.
6. Clearly label alternatives that relax a requested constraint.

### Hard constraints

- Distance/radius
- Date/day
- Time window
- Child age
- Price/budget
- Indoor/outdoor
- Registration requirement when explicitly requested
- Search center/location context

Words such as `close`, `near`, `this morning`, `cheap`, and `for my toddler` become hard constraints when their meaning is unambiguous from the request.

## Recommendation quality

Default to 3–5 strong choices. A recommendation card should expose, when known:

- what it is
- when it happens
- where it is
- distance and drive time
- cost
- age fit
- weather fit
- accessibility/family details
- registration requirements
- freshness/verification state
- why Poppy selected it
- who in the group is interested

Missing facts remain unknown; they are never invented.

## Trust model

Facts from event/place sources must remain distinguishable from community observations. Community information should capture practical details such as parking, stroller access, changing tables, nursing, food, sensory environment, what to bring, best times, and crowd patterns.

Stale or conflicting information must be downgraded, flagged, or suppressed rather than presented as confidently current.

## Location privacy

- Home location is persistent only when the mom chooses to provide it.
- Current device location is an explicit, temporary search context.
- Current location never overwrites home location.
- No background or continuous tracking.
- Denied location permission must never block discovery.

## Three-question product loop

**What can we do?** → discovery

**Who wants to go?** → coordination

**How did it go?** → learning

Post-activity feedback should feed future recommendations without adding friction to the primary decision flow.

## Release gates

A product change is ready only when:

- automated critical-path tests pass;
- mobile regression checks pass;
- production build passes;
- deployment commit is verified;
- runtime errors are checked;
- primary mom journey is smoke-tested;
- no known critical regression remains.
