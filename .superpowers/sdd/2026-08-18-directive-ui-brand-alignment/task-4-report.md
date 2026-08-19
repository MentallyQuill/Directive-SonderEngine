# Task 4 report — Responsive Browser Parity and Migration Truthfulness

## Outcome

Task 4 adds a real Playwright Chromium gate and records live Sonder evidence for onboarding and the exact five Directive routes at desktop and mobile sizes. A visual rejection of the first green run then drove a source-faithful correction: Directive now opens in its centered LCARS overlay, uses the current production route hierarchies, and preserves the same responsive composition as the authoritative SillyTavern UI while retaining Sonder-only data and lifecycle adapters.

Final browser evidence is under `artifacts/playwright-ui-alignment/`. It is intentionally ignored; its `REPORT.md` records provenance, assertions, screenshot inventory, host-boundary differences and the comparison with current Directive.

## Changes

- Pinned Playwright `1.61.1` in development package metadata.
- Added `tests/ui/playwright-review.mjs`, which starts a scratch live Sonder instance when `SONDER_ENGINE_ROOT` is set, provisions the staged Directive extension, executes browser assertions and captures 12 screenshots.
- Added a deterministic harness only as a fallback for focused browser development; it is not the final evidence source.
- Corrected the close-control focus target to `.directive-close-action` and kept its unit fixture aligned.
- Ensured all visible Directive form and button controls have a 44 px minimum target.
- Bound LCARS route glyph masks to Sonder's supported extension-asset facade so live browser requests succeed.
- Updated the current-host responsive CSS assertion from the retired 720 px breakpoint to current Directive's authoritative 640 px breakpoint.
- Restored the source overlay/backdrop/panel-host hierarchy and removed the bridge rules that had expanded Directive into a host-native full-screen page.
- Ported the source Campaign dashboard, Mission master/detail, People roster/detail, Ship cohesion orbit, and Settings section structures instead of generic `directive-v1-*` cards.
- Projected the authored public mission title/summary and the existing transparent cohesion ship asset; no UI facts are synthesized.
- Added measured browser assertions for the 940 px desktop console, 40/24 px rails, internal scrolling, route-native structures, and Campaign identity/action visibility.
- Added normalized reference-image comparisons for all ten route/viewport captures, with the authoritative source path, score and threshold recorded in `results.json`.
- Restored the authored layered Campaign hero scene, source-safe required/optional Mission grouping and public fact/support lists, and Ship mobile orbit badges plus visible disclosure panels.
- Corrected onboarding evidence labels so its two measurements cannot be mistaken for Campaign route measurements.
- Mounted the modal shell before awaiting an active-story projection and added focus containment, including live Tab/Shift+Tab wraparound assertions.
- Corrected `ARCHITECTURE.md`, `MIGRATION_RESPONSIBILITY_MATRIX.md` and `MIGRATION_STATUS.md` so route-shell proof is separate from still-missing campaign management, notices, creator assist, unavailable-backend states and richer route interactions.

## RED/GREEN evidence

The live browser test first failed because opening did not focus the actual close control. After the selector correction, the focused unit and browser checks passed.

The live browser then identified onboarding controls at 40–42 px. The 44 px bridge rule made the measured target-size contract pass.

The next live run recorded repeated 404 responses for route glyphs because relative CSS mask URLs were resolved against Sonder's aggregated stylesheet endpoint. Explicit supported extension asset URLs eliminated the request and console failures.

The full current-host suite then exposed one stale test expectation for `@media (max-width: 720px)`. Current Directive uses 640 px throughout, so the integration assertion was corrected and the suite passed.

One final screenshot run initially observed focus before the controller's scheduled animation-frame restoration completed. The runner now waits for the observable focus state rather than sampling the asynchronous transition; the production behavior was unchanged and the final live run passed.

## Visual review truthfulness

The final images were reviewed beside `F:\git\Directive\artifacts\expanded-interface-conformance` at the same 1440x900 and 390x844 viewports. The centered frame, rail, route header, shelf, typography, color roles, density, Campaign hero composition, Mission master/detail hierarchy, People roster/detail split, Ship cohesion orbit, and Settings panel vocabulary now match the current product language. The dimmed Sonder Stories surface remains visible only behind the modal overlay and is the intentional host-boundary difference.

Backend ownership differences remain explicit: save/load/delete are visibly unavailable because Sonder exposes no corresponding extension facade; Settings does not duplicate Sonder provider/model controls; People reorder/player-commander actions and Command Bearing spending remain noninteractive until supported mutation routes exist. Notices and creator-assist are still separate migration work. These are functionality gaps, not substitutions with a different visual brand.

Independent senior review rejected earlier candidates because Ship mobile selection targeted a hidden desktop detail pane, Mission flattened optional objectives into primary ones, the browser gate only saved rather than compared references, evidence mislabeled onboarding metrics, and the modal could race a delayed projection or release keyboard focus into Sonder. The corrections exercise the mobile disclosure, compare every route capture to the current authoritative render, mount the modal synchronously, and prove focus containment.

## Verification

- Live browser: `SONDER_ENGINE_ROOT=F:\git\Sonder_Engine node tests/ui/playwright-review.mjs` — **PASS**, `live-sonder`, 12 screenshots, no browser/runtime failures.
- Full Python: `SONDER_ENGINE_ROOT=F:\git\Sonder_Engine py -3.13 -m pytest -q --disable-warnings --basetemp .tmp/pytest-root-review-fixes` — **106 passed**, 150 host Pydantic deprecation warnings, with all host-dependent cases executed.
- UI unit tests: `node --test tests/ui/*.test.mjs` — **19 passed**.
- UI syntax: `node --check` for the index, app, primitives, routes, shell and all five view modules — passed.

## Concerns

- Backend-powered interactions without supported Sonder facade routes remain incomplete and documented as in progress.
- The live proof uses an isolated scratch Sonder database and extension root, not a user's persistent host data.
- The Pydantic warnings originate from the current Sonder checkout and do not fail this migration gate.
