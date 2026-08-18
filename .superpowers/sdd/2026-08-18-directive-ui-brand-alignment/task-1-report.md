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

## Review Fix Round 1

### Findings Addressed

1. Replaced the handwritten `DocumentFixture`/`ElementFixture` and custom dispatch implementation with a standards-compliant `happy-dom` `Window` and `Document`. The test now exercises actual `HTMLElement`, `NodeList`, `KeyboardEvent`, event bubbling, cancelability/default prevention, focus tracking, and native `.click()` behavior.
2. Matched the authoritative `expanded-interface-focus.js` behavior: ArrowLeft/ArrowRight (and the existing Home/End branches) focus and automatically activate the destination route by invoking its real click path.
3. Added minimal Node package metadata and pinned `happy-dom` `20.11.2` as a development-only dependency. Production modules remain dependency-free.

### Finding 1 RED and GREEN

RED command:

```text
node --test tests/ui/directive-shell.test.mjs
```

RED result: exit 1. After changing the behavior test to call the standards `dispatchEvent()` boundary, the handwritten fixture failed with `TypeError: controls[1].dispatchEvent is not a function` at the first ArrowRight event. This directly reproduced the review finding that the fake element was not a DOM event target.

GREEN command after installing the pinned test dependency and replacing the fixture:

```text
node --test tests/ui/directive-shell.test.mjs
```

GREEN result: exit 0; 1 passed, 0 failed. The shell was mounted in the library document so platform focus tracking and bubbling were observable.

### Finding 2 RED and GREEN

RED command after changing only the arrow-route expectation:

```text
node --test tests/ui/directive-shell.test.mjs
```

RED result: exit 1. The assertion expected `['people']` after ArrowRight from Mission but received `[]`, proving the current production branch moved focus without activating the route.

GREEN command after invoking the destination control's click path from the arrow branch:

```text
node --test tests/ui/directive-shell.test.mjs
```

GREEN result: exit 0; 1 passed, 0 failed. ArrowRight selected People and ArrowLeft selected Mission while preserving focus; Enter and Space independently reactivated the focused control.

### Covering Verification

```text
node --test tests/ui/directive-shell.test.mjs
py -3.13 -m pytest tests/ui/test_ui_contract.py --basetemp .tmp/pytest-task1-review1
node --check ui/shell.js
git diff --check
```

Results: focused shell 1 passed; Python UI contract 5 passed; syntax and diff checks exited 0. The real-DOM test explicitly asserts `defaultPrevented` for ArrowRight, Enter, and Escape, and proves ArrowRight and Escape bubble through the shell event path.

### Review Fix Files

- `tests/ui/directive-shell.test.mjs`
- `ui/shell.js`
- `package.json`
- `package-lock.json`
- `.superpowers/sdd/2026-08-18-directive-ui-brand-alignment/task-1-report.md`

### Review Fix Self-Review

- Compared the production branch against the complete authoritative helper: destination focus occurs before activation, and activation uses the control click path.
- Confirmed the handwritten DOM classes and custom dispatch helper are fully removed.
- Confirmed `happy-dom` is pinned under `devDependencies`, `npm ls --depth=0` resolves exactly `happy-dom@20.11.2`, and no production module imports it.
- Confirmed arrow activation updates callback history, `data-active-route`, `aria-selected`, `aria-current`, route heading/path, and roving `tabIndex` through the same click path as pointer activation.
- Mutation check: removing destination `.click()` returns the exact `actual [] / expected ['people']` RED; returning to fake elements returns the exact missing `dispatchEvent()` RED.

### Review Fix Concerns

- Consumers running the Node shell test must run `npm install`/`npm ci` first; package metadata and the lockfile now make that requirement deterministic.
