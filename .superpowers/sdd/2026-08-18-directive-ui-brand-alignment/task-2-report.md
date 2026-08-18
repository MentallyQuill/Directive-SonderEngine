# Task 2 Report: Campaign and Character-Creation Workspaces

## Implementation

- Added `renderCampaignView(data, state, actions)` with the Directive Command, Library, and Records workspace modes, real tab semantics, roving keyboard focus, canonical campaign command/package/metadata class contracts, and ephemeral mode state.
- Rendered the active campaign from literal projection values: campaign title, player identity, exact Ashes package ship identity, current mission id/title, simulation mode, Stardate, completed count, and current location. Missing projection values remain explicit; no generic campaign title, player identity, mission, or location is invented.
- Added `renderCreatorView(state, actions)` with Identity, Service, Command Profile, and Review steps; all twelve authoritative player fields; unchanged `simulation_mode` values; field retention; a literal review summary; required-field validation; live status; and retry after rejection.
- Reworked `ui/app.js` onto the Task 1 `createDirectiveShell` interface. With no chat, Campaign owns creator state. Final submission passes through one explicit app-boundary whitelist, calls Sonder `api` for atomic `/start`, opens the returned story through `sonder.chats.open`, and calls `sonder.refresh`.
- Kept production modules dependency-free and on supported Sonder facade seams. No SillyTavern import/global/selector, storage API, direct network call, or `innerHTML` was added.

## RED Evidence

Initial command:

```text
node --test tests/ui/directive-campaign.test.mjs
```

Result: exit 1. Node reported `ERR_MODULE_NOT_FOUND` for `ui/views/campaign.js`, the expected failure because neither Task 2 view module existed.

Projection-shape self-review RED:

```text
node --test tests/ui/directive-campaign.test.mjs
```

Result: exit 1; 2 passed, 1 failed. The real native projection fixture omitted `ship.name`, `ship.class_name`, and `mission.title`; the Campaign view rendered explicit unavailable states instead of the exact package-bound ship identity and literal mission id. The production fix resolves ship identity only for exact `campaign.id === "ashes-of-peace"` and otherwise retains explicit unavailable states.

Compatibility regression RED:

```text
py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task2-ui
```

Result: exit 1; 4 passed, 1 failed. Moving presentation metadata to `creator.js` removed the established `app.js` start-boundary field declaration. The fix restored an explicit, used `/start` whitelist and simulation-mode allowlist in `app.js` rather than weakening the existing test.

## GREEN Evidence

Focused behavior gate:

```text
node --test tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs
```

Result: exit 0; 4 passed, 0 failed.

UI contract gate:

```text
py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task2-ui-final
```

Result: exit 0; 5 passed, 0 failed.

Full repository gate:

```text
py -3.13 -m pytest --basetemp .tmp/pytest-task2-full-final
```

Result: exit 0; 99 passed, 6 skipped. All six skips are the existing configured-Sonder integration cases because the external checkout is not present at this worktree's expected path.

Additional checks:

```text
node --check ui/app.js
node --check ui/views/campaign.js
node --check ui/views/creator.js
git diff --check
```

Result: all exited 0. Git emitted only the repository's line-ending conversion notice for `ui/app.js`.

## Files Changed

- `ui/views/campaign.js`
- `ui/views/creator.js`
- `tests/ui/directive-campaign.test.mjs`
- `ui/app.js`
- `.superpowers/sdd/2026-08-18-directive-ui-brand-alignment/task-2-report.md`

## Self-Review

- Verified the public exports are exactly the required `renderCampaignView` and `renderCreatorView` interfaces.
- Verified Campaign mode changes update selected/tabindex state, swap the rendered mode in place, and keep unsupported host actions absent.
- Verified the creator contains exactly four steps and thirteen required controls: the twelve existing player field names plus `simulation_mode`.
- Verified step changes and field edits make no host call. The first host mutation is the final reviewed submit.
- Verified the atomic payload contains only the twelve whitelisted player fields and the unchanged `Command` or `Exploration` mode.
- Verified a rejected `/start` call neither opens a chat nor refreshes, exposes a failure status, and re-enables the same retained form for retry; success opens the returned chat id and refreshes once.
- Mutation check: a generic Ashes title fallback, dropped field state, invented location, missing mode step, altered payload key/value, skipped `chats.open`, missing refresh, or permanently disabled rejection path each fails the focused real-DOM test.
- Inline review was used because the task explicitly prohibited subagents. Removed the obsolete generic campaign renderer and its unused helpers so Campaign has one presentation path.

## Concerns

- Task 4 owns rendered 1440x900 and 390x844 browser geometry, computed 44px control proof, screenshots, and reduced-motion verification; this task establishes the class and interaction contracts but does not claim that later visual gate.
- Mission, People, Ship, and Settings still use the pre-Task-3 placeholders in `ui/app.js`; Task 3 is explicitly responsible for replacing those routes with player-safe workspaces.
- Six full-suite integration tests remain skipped until a current Sonder checkout is configured at the fixture's expected external path; no Task 2 behavior test is skipped.
