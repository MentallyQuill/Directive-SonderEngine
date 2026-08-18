# Directive to Sonder Engine Migration Design

## Goal

Deliver the complete Directive product as a native Sonder Engine extension, retaining Directive campaign semantics and LCARS experience while assigning hosting, persistence, orchestration, identity, perception, player-authority floors, branching and UI mounting to current Sonder systems.

## Approved constraints

- Reference repositories are read-only.
- Only `F:\git\Directive-SonderEngine` may change.
- Exact references are Directive `06b7e3160a6c1fefe2134e5cac926843b5a0c1ee` and Sonder `a79443b10a0872c1a3ffb3e9840232b1fd622209`.
- Current implementation, maintained guides and tests are authoritative; historical Sonder gap reports are not requirements.
- No parallel persistence, identity, timeline, provider or orchestration authority.
- Player dialogue, action, thought, emotion, reaction, intention and choice may never be invented.
- Ashes of Peace is the supported playable campaign; other campaigns are disabled previews.
- No push, publication, deployment or pull request is authorized.

## Architecture

The installable unit is a Sonder extension API 1 repository with a Python domain package and ES-module UI. The detailed component and authority design is in [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md). The complete source disposition is in [`../../MIGRATION_RESPONSIBILITY_MATRIX.md`](../../MIGRATION_RESPONSIBILITY_MATRIX.md).

Directive state is split by meaning:

- chat-global `api.state`: package/configuration identity;
- era-scoped `api.frame_state`: mission, settlement, ship, time mapping and Command Bearing events;
- `api.char_state`: rank, role, department, assignment, duty and Directive operational data joined to Sonder person ids;
- story documents: authored/derived JSON that must branch and rewind with the story;
- install documents/settings: campaign library and user preferences that must not rewind.

## Data flow

Sonder interprets and resolves a turn. Directive validates the merged Director result after host floors. A closed-candidate settlement stage may propose authored semantic matches. Sonder then runs its normal perception and narration. At commit, a fail-closed Directive domain validates source ids, package revision, predicates and proposal shape and atomically reduces Directive frame state. Player routes combine `player_view` with Directive projections; canonical rules use `story_view`.

## Error behavior

- Invalid provisioning input creates no story.
- A repairable campaign invariant receives the one host-owned correction attempt.
- A still-invalid essential invariant aborts before commit.
- Malformed/failed semantic interpretation commits no proposal.
- A Directive commit-domain error rolls back the beat.
- Missing player-safe fields are omitted.
- UI/notice failures do not become state authority.

## Test strategy

Each behavior uses red-green-refactor. Pure domain reducers receive focused pytest tests. Host guarantees receive integration tests against the current Sonder checkout, including atomic provisioning, correction, fail-closed commit boundaries, extension-state carriage and stable identity projection. UI behavior receives Playwright tests at desktop and mobile widths with keyboard, focus, reduced-motion and standing-notice assertions. A final forbidden-dependency audit proves no SillyTavern runtime import or network dependency remains.

## Decomposition

The migration is too broad for one implementation plan. It is executed through these ordered plans, each producing independently reviewable working software:

1. Foundation, state contracts, package compilation and atomic provisioning.
2. Settlement, player authority, mission, consequence and time services.
3. Ship, cohesion, Command Bearing, People and aggregate projections.
4. LCARS application, campaign lifecycle, settings and notifications.
5. Replay/branch/checkpoint/export verification, dependency removal and full regression.

The first plan is [`../plans/2026-08-18-foundation-and-provisioning.md`](../plans/2026-08-18-foundation-and-provisioning.md). Later plan documents must be written from the implemented interfaces and current status rather than guessing their signatures now.

## Self-review

The design has no placeholders. It does not require an upstream Sonder change, does not preserve a SillyTavern compatibility runtime, and assigns every durable concept one owner. Optional one-way legacy import remains outside the native runtime and does not block any phase.
