# Migration Status

## Status vocabulary

- **Not assessed**: current source and host ownership have not been inspected.
- **Assessed**: responsibility and target boundary are recorded from current code/tests.
- **In progress**: target implementation exists but its required proof is incomplete.
- **Implemented**: target behavior exists; full required verification has not run.
- **Verified**: executable focused and applicable integration proof passed.
- **Blocked**: a proven external Sonder capability or product decision prevents progress.
- **Retired**: intentionally absent because Sonder owns it or it was SillyTavern-specific.

## Baseline

| Item | Value |
|---|---|
| Directive revision | `06b7e3160a6c1fefe2134e5cac926843b5a0c1ee` |
| Sonder revision | `a79443b10a0872c1a3ffb3e9840232b1fd622209` |
| Target starting state | Empty Git repository, no commits |
| Playable Directive scope | Ashes of Peace; other campaigns remain disabled previews |
| Legacy runtime | Hard cutover; no SillyTavern compatibility runtime |

## Phase status

| Phase | Status | Exit evidence |
|---|---|---|
| Repository, test harness and extension package | Verified | Package tests plus current Sonder discovery/activation in the live provisioning fixture |
| Complete responsibility inventory | Assessed | `MIGRATION_RESPONSIBILITY_MATRIX.md` covers all production directories and support areas |
| Atomic Ashes provisioning | Verified | Current Sonder provisions persona, seven crew, scene, state, authority, contexts, documents and provenance; invalid documents leave the database byte-identical |
| Directive state schemas/domain services | In progress | Strict immutable chat/frame/crew contracts verified; domain reducers remain |
| Settlement on Sonder committed lineage | Assessed | Reroll/branch/rollback/source-binding integration |
| Player authority and campaign validators | Assessed | Successful single correction and still-invalid fail-closed no-commit proof |
| Missions, objectives, evidence, consequences | Assessed | Ported behavioral scenarios and transition tests |
| Ship mechanics, cohesion and assignments | Assessed | Deterministic state/projection tests |
| Time and Stardate | Assessed | Host-clock derivation and narration non-authority tests |
| People and crew joins | Assessed | Stable-id/alias/duplicate-name/private-fact tests |
| Aggregate player-safe projections | Assessed | Allowlist and missing-value contract tests |
| LCARS UI and interactions | Assessed | Browser desktop/mobile/keyboard/focus/reduced-motion tests |
| Campaign lifecycle/settings/notices | Assessed | Browser and route tests |
| Branch/replay/checkpoint/export | Assessed | Sonder integration round trips |
| Optional one-way legacy importer | Not assessed | Separate product decision; not a native-runtime dependency |
| SillyTavern removal audit | In progress | Foundation runtime audit is clean; later runtime/UI phases remain |
| Full clean regression | Not assessed | Complete target suite and browser gate from clean checkout |

## Verified current Sonder facilities

Current Sonder source and tests provide the migration's required host seams:

- extension discovery, package imports, isolation and ES-module UI;
- `provision_story` with state, frame state, contexts, documents, authority and provenance in one transaction;
- `story_view` schema 2 and player-safe `player_view.people` with stable ids and explicit public-fact allowlists;
- chat-global, frame-scoped, per-character and document extension state carried through checkpoints, archives and branches;
- transactional extension commit domains with fail policy;
- `actor_only` player-authority enforcement;
- post-floor `on_director_result`, exactly one correction attempt, and fail-closed abort before commit;
- native reroll as rollback/replay, narration variants, branches and export/import.

No upstream Sonder blocker is currently proven. Historical gap reports under `docs/design` were not used as requirements.

## Executable evidence at the provisioning milestone

- `C:\Python313\python.exe -m pytest -q --basetemp=.tmp/pytest-full --disable-warnings`: **40 passed**.
- Current-host focused integration: **4 passed**, including real extension discovery, route dispatch, archive import/readback, and pre-import refusal with an unchanged database hash.
- `C:\Python313\python.exe -m compileall -q directive extension.py`: passed.
- Foundation forbidden-dependency scan across `directive`, `extension.py`, `manifest.json`, and `ui`: no runtime matches.

## Decisions and non-blockers

- A one-way SillyTavern save importer is optional and deliberately separate. Native Sonder migration continues without it.
- Sonder has no supported assistant-prose injection API by design. Directive does not need one: state commits through Director/commit seams and narration renders host-owned results.
- Directive's old draft-until-next-message accepted pair does not survive as a second lifecycle. Its guarantees map to Sonder's committed turn plus rollback/replay lineage.
