# Exact Directive UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Direct-port the current Directive for SillyTavern UI and interaction contract into Directive on Sonder Engine and prove parity with full-resolution Playwright evidence.

**Architecture:** Keep the existing Sonder extension controller and player-safe API boundary, but make its rendered DOM, assets, CSS, and ephemeral interaction state follow the current Directive source modules. A two-page Playwright oracle compares equivalent source and live-Sonder states while separately testing target host integration.

**Tech Stack:** JavaScript ES modules, DOM APIs, CSS, Node test runner, happy-dom, Python 3.13/pytest, Playwright Chromium, Sonder extension API 1.

**Spec:** `docs/superpowers/specs/2026-08-18-exact-directive-ui-parity-design.md`

## Global Constraints

- Keep `F:\git\Directive` and `F:\git\Sonder_Engine` read-only.
- Current Directive source and supplied screenshots are the presentation authority; current target parity claims are not.
- Routes are exactly Campaign, Mission, People, Ship, Settings and every open begins on Campaign.
- Copy Directive-owned CSS, markup hierarchy, text, icons, and media instead of approximating them.
- Use supported Sonder extension seams and player-safe projection data only.
- Settings content may be Sonder-specific; Settings presentation may not diverge.
- Write a failing behavior or browser assertion before each production correction.
- Preserve unrelated work and never weaken a test or visual threshold to make a mismatch pass.

---

### Task 1: Exact Opening And Launcher Contract

**Files:**
- Modify: `tests/ui/directive-campaign.test.mjs`
- Modify: `tests/ui/focus-management.test.mjs`
- Modify: `tests/ui/test_ui_contract.py`
- Modify: `ui/app.js`
- Modify: `ui/index.js`
- Modify: `ui/directive.css`

**Interfaces:**
- Consumes: Sonder `registerTopBarButton`, `openView`, `closeView`, `state`, and Directive `route-ship.svg`.
- Produces: launcher-scoped ship mask and a view whose initial route is Campaign on every open.

- [ ] Add a failing real-DOM test proving a fresh view with no active story renders the Campaign browser, not the creator, and a reopened view resets to Campaign.
- [ ] Run the focused test and confirm it fails because the current no-story path renders `renderCreatorView` directly.
- [ ] Add a failing contract/browser assertion that the launcher exposes the exact ship-mask asset and no visible text glyph.
- [ ] Implement the minimal controller and launcher CSS changes.
- [ ] Run the focused Node and Python UI tests to green.

### Task 2: Complete Campaign Library And Source Assets

**Files:**
- Modify: `tests/ui/directive-campaign.test.mjs`
- Create: `ui/campaign-library.js`
- Modify: `ui/views/campaign.js`
- Modify: `ui/views/creator.js`
- Copy: future campaign media under `assets/packages/`
- Modify: `tests/ui/test_ui_contract.py`

**Interfaces:**
- Consumes: official teaser records and media from `F:\git\Directive\src\packages\bundled-package-registry.mjs`.
- Produces: `DIRECTIVE_CAMPAIGN_LIBRARY` and official desktop/mobile campaign-browser rendering.

- [ ] Add failing tests for exact package order, literal copy/facts, selectable future details, disabled mutation-free `New campaign`, current-story rows, and Ashes creator entry.
- [ ] Run the tests and confirm failures name the missing browser and teaser records.
- [ ] Port the official teaser data, campaign journal hierarchy, mobile disclosure behavior, and byte-identical media.
- [ ] Run campaign tests and asset-hash contract tests to green.

### Task 3: Source Campaign Dashboard And Hero Motion

**Files:**
- Modify: `tests/ui/directive-campaign.test.mjs`
- Modify: `ui/views/campaign.js`
- Create or modify: focused hero modules under `ui/`
- Modify: `ui/directive.css`

**Interfaces:**
- Consumes: projected campaign/viewer/ship/mission/time data and authored layered scene assets.
- Produces: source dashboard hierarchy, Campaigns and lifecycle actions, deterministic hero layer bindings, and reactive motion cleanup.

- [ ] Add failing DOM tests for the source dashboard hierarchy, exact action labels, Campaigns transition, and layered hero contract.
- [ ] Add a failing Playwright motion assertion that samples official and target hero transforms at fixed input/times.
- [ ] Port the current Directive dashboard, hero scene, reactive orbit, chronometer, and action composition.
- [ ] Run focused DOM and Playwright assertions to green.

### Task 4: Exact Mission, People, And Ship Workspaces

**Files:**
- Modify: `tests/ui/directive-routes.test.mjs`
- Modify: `ui/views/mission.js`
- Modify: `ui/views/people.js`
- Modify: `ui/views/ship.js`
- Modify: `ui/directive.css`

**Interfaces:**
- Consumes: literal player-safe projection fields and existing route shell.
- Produces: source-compatible Mission journal, People collection/detail and Command Bearing surfaces, and Ship cohesion workspace/disclosures.

- [ ] Add failing route tests for source control labels, hierarchy, selection/disclosure state, exact literal copy, and omission of absent facts.
- [ ] Run the route tests and confirm the mismatches fail.
- [ ] Port the current source DOM composition and interaction state without adding parallel authority.
- [ ] Run route, shell, and campaign tests to green.

### Task 5: Settings Presentation And Lifecycle Dialogs

**Files:**
- Modify: `tests/ui/directive-routes.test.mjs`
- Modify: `tests/ui/directive-campaign.test.mjs`
- Modify: `ui/views/settings.js`
- Create or modify: target campaign lifecycle dialog modules under `ui/`
- Modify: `ui/directive.css`
- Modify: Python routes and tests only where a source action requires a missing supported target operation.

**Interfaces:**
- Consumes: Sonder-specific settings/state and host-supported story lifecycle operations.
- Produces: Directive-styled Settings and source-compatible Save, Load, Delete, loading, failure, focus-trap, and retry behavior.

- [ ] Add failing tests for exact dialog actions, focus handling, busy/error states, and Settings presentation structure.
- [ ] Run focused tests and confirm failure on missing behavior.
- [ ] Implement the minimal host-native lifecycle and Settings presentation changes.
- [ ] Run focused Node/Python tests to green.

### Task 6: Full-Resolution Playwright Oracle

**Files:**
- Modify: `tests/ui/playwright-review.mjs`
- Modify: `tests/ui/fixtures/directive-harness.html`
- Create: focused source-oracle helpers under `tests/ui/`
- Generate ignored evidence: `artifacts/playwright-ui-alignment/`

**Interfaces:**
- Consumes: current Directive preview/harness, live Sonder, equivalent deterministic fixtures, fonts, images, and all completed UI states.
- Produces: full-resolution actual/reference/diff images plus JSON geometry/style/font/interaction evidence.

- [ ] Replace the 96x96 averaged comparison with full-resolution shell clipping and a per-pixel diff image.
- [ ] Add assertions for exact normalized text, accessibility names, platform fonts, computed styles, geometry, decoded media, focus, responsive breakpoints, normal motion, and reduced motion.
- [ ] Confirm the strengthened review fails against any remaining mismatch without changing its acceptance criteria.
- [ ] Correct target markup/CSS/assets until every meaningful mismatch is removed.
- [ ] Run the review at 1440x900, 1024x768, 390x844, 360x800, 360x500 and CSS breakpoint boundaries.

### Task 7: Full Verification And Truthful Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MIGRATION_STATUS.md`
- Modify: `docs/MIGRATION_RESPONSIBILITY_MATRIX.md` if ownership evidence changes.

**Interfaces:**
- Consumes: complete focused and full verification evidence.
- Produces: accurate migration status and a reviewable final diff.

- [ ] Run `node --test tests/ui/*.test.mjs` and confirm zero failures.
- [ ] Run `py -3.13 -m pytest --basetemp .tmp/pytest-final` against current Sonder and confirm zero applicable failures.
- [ ] Run live-Sonder Playwright and inspect every actual/reference/difference artifact.
- [ ] Update documentation only with evidence that passed in this run.
- [ ] Review `git diff`, verify reference repositories remain unchanged, and report any residual mismatch instead of claiming parity.
