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
| Directive state schemas/domain services | In progress | Strict chat/frame/crew, mission, Command Bearing, ship/cohesion, time, journey, and simulation-policy tests pass; generated cohesion and people-event domains remain |
| Settlement on Sonder committed lineage | Verified | Closed candidates, exact turn/hash binding, idempotence, fail-closed commit domain, and current-host transactional advancement |
| Player authority and campaign validators | In progress | Sonder `actor_only` plus Directive surviving-dialogue correction unit proof; still-invalid live no-commit and secret adversarial matrix remain |
| Missions, objectives, evidence, consequences | In progress | All 13 definitions validate; deterministic reducer and journey/capability transitions pass; complete authored scenario matrix remains |
| Ship mechanics, cohesion and assignments | In progress | Authored work ladders, constraints, capabilities, 20-segment cohesion, projection, and replay pass; generated issue scheduler remains |
| Time and Stardate | Verified | Host-clock derivation, rollover, projection, and narration non-authority tests |
| People and crew joins | In progress | Seven stable-id joins and public allowlist pass; runtime-observed people events/dossier authoring remain |
| Aggregate player-safe projections | Verified | Mission, journey, ship, time, Bearing, crew and media allowlists; hidden/private omission tests |
| LCARS UI and interactions | Implemented | ES-module host asset serving, syntax, mount, route, mobile CSS, focus-ring and reduced-motion contracts pass; live browser binding failed before visual geometry proof |
| Campaign lifecycle/settings/notices | In progress | Atomic start, host open, simulation mode selection and settings copy implemented; notices and campaign management polish remain |
| Branch/replay/checkpoint/export | In progress | Current-Sonder checkpoint rewind and portable export/import preserve Directive state, frame state, documents and provenance; branch/reroll round trips remain |
| Optional one-way legacy importer | Not assessed | Separate product decision; not a native-runtime dependency |
| SillyTavern removal audit | In progress | Foundation runtime audit is clean; later runtime/UI phases remain |
| Full clean regression | In progress | 101 Python tests, compileall and JS syntax pass; clean-checkout and browser gates remain |

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

## Latest executable evidence

- `C:\Python313\python.exe -m pytest -q --basetemp=.tmp/pytest-ui-full --disable-warnings`: **101 passed** (150 warnings from the pinned Sonder host's current Pydantic deprecations).
- Current-host integration covers discovery/activation, route dispatch, archive import/readback, an unchanged database hash on invalid input, player projection, exact-turn settlement commit, checkpoint rewind, portable export/import, and ES-module/CSS serving.
- `C:\Python313\python.exe -m compileall -q directive tests`: passed.
- `node --check ui/app.js` and `node --check ui/index.js`: passed.
- Runtime forbidden-dependency scan has no SillyTavern/provider/parallel-timeline imports; only the authored-source rejection list names retired countdown keys.
- All 37 assets referenced by the Ashes package were copied with zero SHA-256 mismatches from the pinned Directive checkout.
- Live browser verification is not claimed: browser control failed during setup with `Trusted RPC dependency must resolve within a configured trusted code path` before any browser was selected.

## Decisions and non-blockers

- A one-way SillyTavern save importer is optional and deliberately separate. Native Sonder migration continues without it.
- Sonder has no supported assistant-prose injection API by design. Directive does not need one: state commits through Director/commit seams and narration renders host-owned results.
- Directive's old draft-until-next-message accepted pair does not survive as a second lifecycle. Its guarantees map to Sonder's committed turn plus rollback/replay lineage.
