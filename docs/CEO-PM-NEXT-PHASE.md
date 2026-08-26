# Momma’s Meetup — CEO/PM Next-Phase Working Plan

**Date:** August 26, 2026  
**Owner:** CEO + Program Manager  
**Engineering:** Software Engineering + QA

## Product objective

Make Momma’s Meetup the most useful and trustworthy local activity information and coordination experience for moms.

The product should help a mom answer three questions with minimal effort:

1. **What can we do?**
2. **Who wants to go?**
3. **How did it go?**

Poppy is the decision layer connecting those three questions.

## Operating principles

- Prefer useful decisions over information volume.
- Apply explicit user constraints before ranking.
- Never fabricate missing facts.
- Separate persistent home context from temporary current-location context.
- Show why a recommendation fits.
- Surface practical family information, not generic venue metadata.
- Treat freshness and verification as product features.
- Keep the primary UI simple; use progressive disclosure for detail.
- Preserve backward compatibility with working production functionality.
- Every material change gets automated regression coverage and production verification.

## Phase 1 — Poppy recommendation engine

**Priority: P0**

### Deliverables

- Deterministic intent parsing for distance, time, day, age, price, weather, indoor/outdoor, registration, and location center.
- Hard filtering before LLM ranking/explanation.
- Explicit handling for natural language such as “close,” “this morning,” “cheap,” and “for my toddler.”
- Home location as the default persistent search center.
- Explicit one-time current location as a temporary search center.
- 3–5 high-confidence recommendations by default.
- Grounded recommendation explanations.
- Clear distinction between qualifying recommendations and labeled alternatives.

### Acceptance

- A request for “close” cannot silently return a materially distant result when valid closer candidates exist.
- Time/date constraints are respected.
- Age constraints are respected.
- Price constraints are respected when price data exists.
- Poppy explanations only cite facts actually available for the candidate.

**Tracking:** GitHub issue #49.

## Phase 2 — Information trust layer

**Priority: P0/P1**

### Deliverables

- Freshness/verification indicators.
- Source-derived facts separated from community knowledge.
- Practical family context: stroller access, changing table, nursing, parking, food, sensory environment, what to bring, best time, crowd patterns.
- Stale-event detection and suppression/flagging.
- Lightweight post-activity feedback.
- Feed community feedback into future recommendation quality.

### Acceptance

- No invented details.
- Stale information is not presented as confidently current.
- Community tips remain useful without overwhelming the decision flow.
- Feedback becomes usable recommendation data.

**Tracking:** GitHub issue #50.

## Phase 3 — Mom-first experience

**Priority: P1**

### Today

Turn Today into a decision center rather than a generic feed.

It should answer: **“What should we do today?”** using child age, weather, nap window, distance, cost, interests, prior activity, and group participation.

### Poppy

Support these core contexts:

- Today
- Near home
- Near me now
- With friends
- Weekend/forward planning

### Group

Make “Who’s going?” first-class in recommendation cards and planning.

### Event cards

A mom should be able to decide without opening multiple sites. Show, when known:

- What
- When
- Where
- Distance/drive time
- Cost
- Age fit
- Weather fit
- Family/accessibility details
- Registration requirements
- Freshness/verification
- Why Poppy picked it
- Who is interested/going

### Weekly planning

Use calendar context, nap windows, prior activities, variety, and preferences to help build a realistic week.

**Tracking:** GitHub issue #51.

## Phase 4 — Engineering quality system

**Priority: P1**

### Regression coverage

Maintain automated coverage for:

- onboarding/auth gate
- Poppy intent and authorization
- distance/time/age/weather/price/location constraints
- empty and degraded candidate sets
- grounded explanations
- mobile navigation
- event-card overflow/clickability
- PWA behavior

### Observability

Create actionable monitoring for:

- Poppy failures
- recommendation failures
- RPC authorization failures
- ingestion failures
- geolocation/search-center failures

### Database

Classify unused indexes as **retain / remove / monitor**. Destructive changes require evidence and controlled migrations.

### Release discipline

Use the sequence:

**merge → deploy → verify commit → smoke test → sign-off**

Production schema/configuration must remain reproducible from source control.

**Tracking:** GitHub issue #52.

## Phase 5 — Personalization flywheel

**Priority: P2**

Capture lightweight signals from actual outcomes:

**Mom asks → Poppy recommends → Mom goes → Mom reacts → community learns → Poppy improves.**

Long-term signals should include:

- activities liked/rejected
- repeat visits
- age-stage relevance
- preferred distance
- preferred times
- indoor/outdoor preference
- group behavior
- practical community feedback

Poppy should eventually be able to say why something is recommended based on both current context and prior successful experiences.

## Success metrics

Measure mom outcomes rather than feature count:

- Time from opening the app to a useful decision.
- Recommendation-to-detail rate.
- Recommendation-to-RSVP rate.
- Group coordination rate.
- Repeat usage.
- Recommendation rejection rate.
- Poppy grounded-answer rate.
- Freshness/verification coverage.
- Post-activity feedback rate.

## Execution order

1. **P0:** Poppy deterministic constraints and recommendation quality.
2. **P0:** Information trust/freshness foundation.
3. **P1:** Today/Poppy/Group decision-flow improvements.
4. **P1:** Regression + observability + release discipline.
5. **P2:** Personalization and proactive weekly planning.

## Definition of done

A release is not considered complete merely because the code builds.

It is done when:

- the user-facing behavior meets acceptance criteria;
- automated regression coverage exists for the critical path;
- production deployment is verified;
- no known critical runtime regression exists;
- recommendation facts are grounded and trustworthy;
- privacy behavior is explicit and appropriate;
- QA has validated the primary mom journey.

## First engineering assignment

Start with **Phase 1 / Issue #49**. Do not redesign the whole application first. Establish the deterministic recommendation contract, test it against representative mom requests, then improve the UI around the stronger recommendation output.
