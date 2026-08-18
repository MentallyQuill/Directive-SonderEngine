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
