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

## Review Fix Round 1

### Findings Addressed

1. Split the creator lifecycle into persisted provisioning, open, and refresh phases. Once `/start` returns a `chat_id`, retry never provisions again. An open failure retries only `chats.open` and then refresh; a refresh failure retries only refresh.
2. Expanded ownership only to `directive/projection/player.py` and its projection test so the player projection carries the bundled campaign source's exact ship name and class. Removed all campaign-id-to-ship inference from the UI.
3. Wired Campaign Continue through the supported `sonder.chats.open(data.chat_id)` action and closes the Directive view only after the story opens successfully.
4. Rejected form submission outside Review, transferred state and focus to the Review tab, and opted out of native hidden-control validation so the custom complete validation path always runs.
5. Added `data-creator-active-step`, complete tab/tabpanel relationships, real keyboard-roving coverage, null-safe metrics, and an always-present framed campaign media region with an explicit load-error placeholder.

### RED Evidence

Combined Node RED command:

```text
node --test tests/ui/directive-campaign.test.mjs
```

Result: exit 1; 2 passed, 5 failed. Failures proved:

- null Stardate/completed values rendered as `0.0`/`0`;
- creator active-step/ARIA semantics were absent;
- open and refresh failures both reported “No partial story was kept”;
- Continue was not rendered because the live app passed no Campaign actions;
- the media placeholder contract was absent behind the first null-metric assertion.

Projection RED command:

```text
py -3.13 -m pytest tests/projection/test_player.py --basetemp .tmp/pytest-task2-review1-projection-red
```

Result: exit 1; 2 passed, 1 failed with `KeyError: 'name'`, proving the authoritative ship identity was absent from the player projection.

UI-inference removal RED command:

```text
node --test --test-name-pattern="Campaign switches" tests/ui/directive-campaign.test.mjs
```

Result: exit 1. A projection containing only `campaign.id = ashes-of-peace` still produced `U.S.S. Breckenridge` and `Intrepid-class`, proving the view synthesized ship facts.

Native-validation RED command:

```text
node --test --test-name-pattern="Creator keeps" tests/ui/directive-campaign.test.mjs
```

Result: exit 1 with `false !== true` for `form.noValidate`, proving hidden required controls could prevent the submit handler from transferring focus to Review.

### GREEN Evidence

Focused Node gate:

```text
node --test tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs
```

Result: exit 0; 8 passed, 0 failed. The gate includes exact one-POST counts across open and refresh failure/retry, early submit focus transfer, keyboard roving, Continue, null metrics, and media error fallback.

Projection gate:

```text
py -3.13 -m pytest tests/projection/test_player.py --basetemp .tmp/pytest-task2-review1-projection-final
```

Result: exit 0; 3 passed, 0 failed.

Full UI contract gate:

```text
py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task2-review1-ui
```

Result: exit 0; 5 passed, 0 failed.

Full repository gate:

```text
py -3.13 -m pytest --basetemp .tmp/pytest-task2-review1-full
```

Result: exit 0; 99 passed, 6 skipped. The same six configured-Sonder integration cases remain skipped because the external checkout is absent.

Additional checks:

```text
node --check ui/app.js
node --check ui/views/campaign.js
node --check ui/views/creator.js
py -3.13 -m py_compile directive/projection/player.py
git diff --check
```

Result: all exited 0; Git emitted only line-ending conversion notices.

### Review Fix Self-Review

- Verified the created `chat_id` is stored before any downstream action; open success is recorded before refresh. Retry branches cannot reach `/start` once provisioning succeeded and cannot reopen a story once open succeeded.
- Verified `/start` rejection still uses the accurate no-partial-story status and retains the complete form for a fresh provisioning retry.
- Verified ship name/class flow from `load_ashes_source().campaign.ship` into the player projection and are read literally by Campaign; an id-only projection renders explicit unavailable states.
- Verified Continue closes only after `chats.open` resolves.
- Verified all four tabs own stable ids, `aria-controls`, and matching labeled tabpanels; active state synchronizes selected state, tabindex, panel visibility, form dataset, and focus.
- Verified both Command and Library always contain a framed media region and convert image failure into visible placeholder copy without inventing art.
- Inline review was retained because this task explicitly forbids subagents.

### Review Fix Concerns

- Browser-computed geometry and the visual styling of the new media placeholder remain part of Task 4's 1440x900/390x844 rendered parity gate.
