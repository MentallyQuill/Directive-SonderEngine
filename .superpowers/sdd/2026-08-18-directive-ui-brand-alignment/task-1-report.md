# Task 1 Report: Product Shell, Routes, and Exact Brand Assets

## Implementation

- Added the standalone Directive LCARS product shell with the authoritative shell, rail, workspace, topbar, route heading/body, and route bar class contracts.
- Added the ordered primary route model: Campaign, Mission, People, Ship, Settings. The route model includes authoritative shelf labels, LCARS rail codes, tone identifiers, and vector glyph identifiers.
- Added safe DOM primitives that create elements, append text with text nodes, manage class state, and create vector glyph nodes without `innerHTML`.
- Added standard roving route focus for ArrowLeft/ArrowRight/Home/End, Enter/Space/click activation, active tab state synchronization, Escape close, the explicit close control, and dialog semantics.
- Copied the five route SVGs byte-for-byte from `F:\git\Directive` and pinned their authoritative SHA-256 values in the contract test.
- Replaced the simplified Sonder stylesheet with the full authoritative `F:\git\Directive\styles\directive.css` base. Appended only a narrow `.directive-app` bridge for standalone viewport sizing, scroll ownership, 44 CSS pixel controls, the supplied time display, and mobile time hiding.
- Kept the implementation on the Sonder facade boundary: no SillyTavern import, selector, global, storage, or network dependency was added.

## RED Evidence

Command:

```text
node --test tests/ui/directive-shell.test.mjs
```

Result: exit 1. Node reported `ERR_MODULE_NOT_FOUND` for `ui/routes.js`, the expected failure because the shell contract did not exist.

Command:

```text
py -3.13 -m pytest tests/ui/test_ui_contract.py --basetemp .tmp/pytest-task1-red
```

Result: exit 1; 4 passed, 1 failed. The new asset/CSS contract failed because `.directive-expanded-shell` was absent from the simplified stylesheet.

Self-review correction RED command:

```text
node --test tests/ui/directive-shell.test.mjs
```

Result: exit 1. The test expected authoritative dialog semantics and shelf-label route paths; the provisional shell returned no dialog role and stopped at the first assertion.

## GREEN Evidence

Focused shell command:

```text
node --test tests/ui/directive-shell.test.mjs
```

Result: exit 0; 1 passed, 0 failed.

Focused Python contract command:

```text
py -3.13 -m pytest tests/ui/test_ui_contract.py --basetemp .tmp/pytest-task1
```

Result: exit 0; 5 passed, 0 failed.

Full repository command:

```text
py -3.13 -m pytest --basetemp .tmp/pytest-task1-full
```

Result: exit 0; 99 passed, 6 skipped. All six skips are the existing configured-Sonder integration tests because the expected external checkout is not present in this worktree environment.

Additional checks:

```text
node --check ui/primitives.js
node --check ui/routes.js
node --check ui/shell.js
git diff --check
```

Result: all exit 0. The copied stylesheet matches the authoritative source after line-ending normalization through the end of the source, followed only by the Sonder bridge. All five copied SVG SHA-256 hashes match their authoritative sources exactly.

## Files Changed

- `ui/primitives.js`
- `ui/routes.js`
- `ui/shell.js`
- `ui/directive.css`
- `tests/ui/directive-shell.test.mjs`
- `tests/ui/test_ui_contract.py`
- `assets/icons/directive-vector-glyphs-v1/icons/route-campaign.svg`
- `assets/icons/directive-vector-glyphs-v1/icons/route-mission.svg`
- `assets/icons/directive-vector-glyphs-v1/icons/route-crew.svg`
- `assets/icons/directive-vector-glyphs-v1/icons/route-ship.svg`
- `assets/icons/directive-vector-glyphs-v1/icons/route-settings.svg`
- `.superpowers/sdd/2026-08-18-directive-ui-brand-alignment/task-1-report.md`

## Self-Review

- Verified the public interfaces are exactly `DIRECTIVE_ROUTES`, `createDirectiveShell({ activeRouteId, onSelectRoute, onClose, time })`, `setShellRoute(shell, routeId)`, plus safe reusable DOM helpers.
- Verified ordered route labels, rail segmentation, glyph mapping, selected/current/tabindex state, route paths, route body identity, click/keyboard activation, roving focus, Escape close, and explicit close callback through the real shell module.
- Verified no player or people facts are rendered or invented by this shell layer.
- Verified no unrelated dirty files were modified.
- Mutation check: wrong route ordering/glyphs, missing shell chrome, missing selected/current state, broken arrow focus, broken Enter/Space activation, or missing close paths each fail the focused behavior test.

## Concerns

- Browser geometry at 1440x900 and 390x844 is not part of Task 1's commanded gate; this task establishes the shell/CSS contract for the later visual conformance task.
- Six full-suite integration cases remain skipped because the external configured Sonder checkout is unavailable at the test fixture's expected path; no Task 1 test is skipped.
