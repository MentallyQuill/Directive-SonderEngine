# Task 3 Report: Mission, People, Ship, and Settings Workspaces

## Status

Implemented the four projection-only Directive route workspaces and replaced the temporary generic-card route renderers in `ui/app.js`.

## TDD evidence

RED was established before production changes:

```text
node --test tests/ui/directive-routes.test.mjs
ERR_MODULE_NOT_FOUND: ui/views/mission.js
tests 1, pass 0, fail 1
```

GREEN after the new route modules and shell wiring:

```text
node --test tests/ui/directive-routes.test.mjs
tests 5, pass 5, fail 0
```

The test uses one complete literal `directive.playerProjection.v1` fixture covering campaign, media, viewer, mission, journey, ship, Command Bearing, time, people, turn, location, perception, and knowledge fields. It exercises real happy-dom nodes without mocks.

## Implementation

- `ui/views/mission.js`
  - Renders the literal mission id, revision, status, objective progress, objective terminal text, outcome dimensions, latest player-safe transition, and Command Bearing.
  - Does not humanize or synthesize a mission title absent from the projection.
- `ui/views/people.js`
  - Combines recognized Directive crew and observed contacts in one People route.
  - Stably orders recognized crew first, uses native selection buttons, and maintains ephemeral selected-person state.
  - Renders only allowlisted Directive fields, `public_history`, and explicit public-record fields; an observed contact receives an explicit no-public-detail state.
- `ui/views/ship.js`
  - Renders literal vessel identity/media, readiness/cohesion, segments, system records, player-known work orders, capabilities, constraints, cohesion priorities, queued count, and resolved history.
  - Uses native `details`/`summary` controls for system, assignment, and history disclosures. Work orders with `status: "unknown"` are omitted.
- `ui/views/settings.js`
  - Restores the branded in-product Settings route with simulation mode, committed-lineage, player-authority, and host-ownership copy.
  - Adds no provider controls, credentials, persistence, or unsupported host actions.
- `ui/app.js`
  - Routes Mission, People, Ship, and Settings to their dedicated renderers.
  - Adds only ephemeral People selection state and removes the generic-card implementations.
- `ui/index.js`
  - Exposes the four route renderer interfaces.
- `tests/ui/directive-routes.test.mjs`
  - Protects route identity, projection-only rendering, roster order/selection, unsafe-fallback omission, unknown-work omission, native disclosures, Settings ownership, and the exact five-route shell.

## Verification

Required Node integration gate:

```text
node --test tests/ui/directive-routes.test.mjs tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs
tests 13, pass 13, fail 0
```

Required Python UI contract gate:

```text
py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task3
5 passed in 0.18s
```

Repository whitespace check:

```text
git diff --check
exit 0
```

## Concerns and handoff

- The current player projection exposes a mission id, revision, status, objectives, outcomes, and transition data, but no authored top-level mission title or briefing summary. The workspace therefore presents the literal mission id and does not infer a friendly title. This is not a Task 3 blocker; adding authored title/summary later would require an explicit player-safe projection contract change.
- Responsive geometry, minimum control sizing, media behavior, and final CSS parity remain Task 4 browser-proof responsibilities.

## Fix round 1: production-shape and disclosure corrections

Review identified five contract mismatches and two smaller continuity issues. The correction stayed within the Task 3-owned route files and test fixture.

### RED evidence

The literal fixture and assertions were changed before production code to use the actual camelCase crew public-record keys and the production cohesion `player_text` shape, while adding disclosure visibility, absent-Bearing, deduplication, and rerendered-selection checks.

```text
node --test tests/ui/directive-routes.test.mjs
tests 7, pass 4, fail 3
```

The three expected failures were:

1. Missing Bearing still rendered `0 of 0 available` and synthesized reserve copy instead of an unavailable state.
2. People roster buttons contained no `.people-row-copy` wrappers.
3. Cohesion priority disclosure still used the responsive-hidden `.ship-task-detail` class.

The Ship test stopped at the disclosure-class assertion; the same pre-production test also required the actual `objective`, `whyItMatters`, and `operationalEffect` fields plus literal current-phase, phase-list, and computer-help output.

### GREEN evidence

After the minimal renderer corrections:

```text
node --test tests/ui/directive-routes.test.mjs
tests 7, pass 7, fail 0
```

Focused integration gate:

```text
node --test tests/ui/directive-routes.test.mjs tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs
tests 15, pass 15, fail 0
```

Python UI contract gate:

```text
py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task3-fix1
5 passed in 0.14s
```

### Corrections and self-review

- Crew public records now read literal `serviceBackground` and `assignmentHistory` values from the nested `public_record` object.
- Roster buttons now emit the authoritative `.people-row-copy` structure; selected observed-contact state survives a renderer rerun with the same ephemeral state object.
- Equal `operational_summary` and `facts.public_history` values render once, while distinct facts remain separate.
- Cohesion assignments render production `situation`, `objective`, `whyItMatters`, and `operationalEffect` fields. `current_phase`, `phases`, and `computer_help` appear only when those projection fields are present.
- Native cohesion disclosures use `.directive-cohesion-disclosure`, remain unhidden in the DOM, and do not inherit the responsive `.ship-task-detail { display: none; }` rule.
- Missing Command Bearing now renders `Command Bearing unavailable.` with no synthetic balance, reserve claim, or pips.
- Self-review found no remaining legacy cohesion keys, snake_case public-record keys, or hidden `ship-task-detail` disclosure class in Task 3 production code. `git diff --check` was clean.
