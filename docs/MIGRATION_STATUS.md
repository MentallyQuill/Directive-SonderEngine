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
| Sonder design baseline | `a79443b10a0872c1a3ffb3e9840232b1fd622209` |
| Sonder final verification | `418ab5b469ebd8682157646229ae7e5bc7aa078b` (`alpha9.5`, descendant that arrived concurrently during the run) |
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
| Player authority and campaign validators | In progress | Sonder `actor_only` plus a current-host fatal correction for surviving player dialogue with unchanged frame state; full one-repair/still-invalid pipeline and secret adversarial matrix remain |
| Missions, objectives, evidence, consequences | In progress | All 13 definitions validate; deterministic reducer and journey/capability transitions pass; complete authored scenario matrix remains |
| Ship mechanics, cohesion and assignments | In progress | Authored work ladders, constraints, capabilities, 20-segment cohesion, projection, and replay pass; generated issue scheduler remains |
| Time and Stardate | Verified | Host-clock derivation, rollover, projection, and narration non-authority tests |
| People and crew joins | In progress | Seven stable-id joins and public allowlist pass; runtime-observed people events/dossier authoring remain |
| Aggregate player-safe projections | Verified | Mission, journey, ship, time, Bearing, crew and media allowlists; hidden/private omission tests |
| LCARS shell and responsive host integration | Verified | Live Sonder serves the ES-module graph and the exact Campaign, Mission, People, Ship, Settings route shell; desktop/mobile geometry, media, 44 px controls, keyboard focus transfer/restoration, roving navigation, Escape, focus rings and reduced motion pass in Chromium |
| Route workspace visual parity | Verified | Live current-Sonder captures use the source Campaign dashboard and layered hero, Mission master/detail with required/optional grouping, People roster/detail, Ship cohesion orbit/callouts and mobile disclosures, Settings sections, and exact responsive shell composition at 1440×900 and 390×844. The gate compares all 10 route captures to the authoritative Directive renders; unsupported mutations remain tracked separately. |
| Campaign lifecycle/settings/notices | In progress | Atomic start, host open, simulation mode selection and settings ownership copy are implemented; save/load/delete campaign management, notices, creator assist and unavailable-backend interaction states remain |
| Branch/replay/checkpoint/export | In progress | Current-Sonder checkpoint rewind, branch, and portable export/import preserve Directive state, frame state, documents and provenance; completed-turn reroll proof remains |
| Optional one-way legacy importer | Not assessed | Separate product decision; not a native-runtime dependency |
| SillyTavern removal audit | In progress | Foundation runtime audit is clean; later runtime/UI phases remain |
| Full clean regression | In progress | 105 Python tests run against the current Sonder checkout, plus JS syntax, unit and live browser gates; clean-checkout proof remains |

## Verified current Sonder facilities

Current Sonder source and tests provide the migration's required host seams:

- extension discovery, package imports, isolation and ES-module UI;
- `provision_story` with state, frame state, contexts, documents, authority and provenance in one transaction;
- `story_view` schema 3 and player-safe `player_view.people` with immutable recognized ids, viewer-scoped opaque observed ids, and explicit public-fact allowlists;
- chat-global, frame-scoped, per-character and document extension state carried through checkpoints, archives and branches;
- transactional extension commit domains with fail policy;
- `actor_only` player-authority enforcement;
- post-floor `on_director_result`, exactly one correction attempt, and fail-closed abort before commit;
- native reroll as rollback/replay, narration variants, branches and export/import.

No upstream Sonder blocker is currently proven. Historical gap reports under `docs/design` were not used as requirements.

## Latest executable evidence

- `$env:SONDER_ENGINE_ROOT='F:\git\Sonder_Engine'; py -3.13 -m pytest -q --disable-warnings --basetemp .tmp/pytest-latest-sonder-audit`: **106 passed** (150 warnings from the current Sonder host's Pydantic deprecations). The six host-dependent cases that skip without `SONDER_ENGINE_ROOT` executed.
- Current-host integration covers discovery/activation, route dispatch, archive import/readback, an unchanged database hash on invalid input, player projection, fatal player-dialogue correction without state mutation, exact-turn settlement commit, checkpoint rewind, branch carriage, portable export/import, and ES-module/CSS serving.
- `C:\Python313\python.exe -m compileall -q directive tests`: passed.
- `node --check` for every UI module and `node --test tests/ui/*.test.mjs`: passed (**19 tests**).
- Runtime forbidden-dependency scan has no SillyTavern/provider/parallel-timeline imports; only the authored-source rejection list names retired countdown keys.
- All 37 assets referenced by the Ashes package were copied with zero SHA-256 mismatches from the pinned Directive checkout.
- Actual Playwright Chromium 1.61.1 against live Sonder captured onboarding plus Campaign, Mission, People, Ship and Settings at 1440×900 and 390×844. The gate found no Directive overflow, broken media, console errors, page errors, failed requests or HTTP failures. Keyboard launch moves focus into the view, route keys rove, Escape closes and restores the current launcher, and reduced-motion styles resolve to effectively zero duration.
- The live Playwright review loads current Directive conformance renders, computes a normalized downsampled-pixel difference for every route and viewport, and records the source path, score, and threshold in `artifacts/playwright-ui-alignment/results.json`. It also activates and collapses a mobile Ship assignment to prove the visible disclosure behavior. The LCARS tokens, centered overlay, responsive shell, route hierarchy, layered Campaign hero, Mission journal, People roster/detail, and Ship cohesion workspace align. On desktop, Sonder's host-owned Stories surface remains dimly visible behind the Directive overlay; on mobile Directive occupies the viewport. Unsupported backend mutations remain explicitly separate from visual parity.

## Decisions and non-blockers

- A one-way SillyTavern save importer is optional and deliberately separate. Native Sonder migration continues without it.
- Sonder has no supported assistant-prose injection API by design. Directive does not need one: state commits through Director/commit seams and narration renders host-owned results.
- Directive's old draft-until-next-message accepted pair does not survive as a second lifecycle. Its guarantees map to Sonder's committed turn plus rollback/replay lineage.
