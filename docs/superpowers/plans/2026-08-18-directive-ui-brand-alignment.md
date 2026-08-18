# Directive UI Brand Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified Sonder UI with Directive's five-route LCARS product shell and page language while retaining supported Sonder host boundaries.

**Architecture:** A thin `app.js` controller reads the player-safe Sonder projection and delegates presentation to focused shell, route, primitive, and view modules. Portable Directive CSS and route glyph assets provide the brand contract; the UI holds only ephemeral interaction state.

**Tech Stack:** JavaScript ES modules, DOM APIs, CSS, Node test runner, Python pytest, Playwright Chromium, Sonder extension API 1.

**Spec:** `docs/superpowers/specs/2026-08-18-directive-ui-brand-alignment-design.md`

## Global Constraints

- The current `F:\git\Directive` UI source is the visual and interaction authority.
- Routes are exactly Campaign, Mission, People, Ship, Settings in that order.
- Use only supported Sonder extension facade seams; no SillyTavern import, global, selector, storage, or network dependency.
- Never invent player or people facts; render only projection fields and explicit empty states.
- Desktop target is 1440x900; mobile target is 390x844; interactive controls are at least 44 CSS pixels tall.
- Preserve focus entry/restoration, Escape close, roving route focus, visible focus rings, and reduced motion.
- Production behavior follows red-green-refactor: each task's new behavior test must fail for the expected missing behavior before implementation.

---

### Task 1: Product Shell, Routes, and Exact Brand Assets

**Files:**
- Create: `ui/primitives.js`
- Create: `ui/routes.js`
- Create: `ui/shell.js`
- Create: `tests/ui/directive-shell.test.mjs`
- Modify: `tests/ui/test_ui_contract.py`
- Copy: `assets/icons/directive-vector-glyphs-v1/icons/route-{campaign,mission,crew,ship,settings}.svg`
- Copy/adapt: `ui/directive.css` from `F:\git\Directive\styles\directive.css`

**Interfaces:**
- Produces: `DIRECTIVE_ROUTES`, `createDirectiveShell({activeRouteId,onSelectRoute,onClose,time})`, `setShellRoute(shell, routeId)`, and reusable safe DOM helpers.
- Consumes: no later-task interfaces.

- [ ] **Step 1: Write the failing shell behavior test**

Create a real-DOM test fixture that imports the shell module and asserts the ordered tab labels `Campaign, Mission, People, Ship, Settings`, segmented rail, route path, route body, vector glyph identifiers, roving ArrowLeft/ArrowRight focus, activation with Enter/Space, and close callback. The production mutation this catches is returning to generic sidebar navigation or wrong route order.

- [ ] **Step 2: Run the shell test and verify RED**

Run: `node --test tests/ui/directive-shell.test.mjs`

Expected: FAIL because `ui/shell.js` and the Directive shell contract do not exist.

- [ ] **Step 3: Implement the shell and copy exact route glyphs/CSS**

Implement the five-route expanded shell using the authoritative class names: `directive-expanded-shell`, `directive-lcars-rail`, `directive-workspace`, `directive-topbar`, `directive-route-heading`, `directive-route-body`, and `directive-route-bar`. Route controls expose `role=tab`, `aria-selected`, `aria-current`, `data-route-id`, `data-route-tone`, and the correct glyph id.

Copy the five exact vector route assets. Use the authoritative Directive stylesheet as the base, then append a narrow `.directive-app`/Sonder-host bridge that supplies dimensions, scroll ownership, and standalone token defaults without depending on SillyTavern variables.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/ui/directive-shell.test.mjs`

Run: `py -3.13 -m pytest tests/ui/test_ui_contract.py --basetemp .tmp/pytest-task1`

Expected: PASS with no warnings or console errors.

- [ ] **Step 5: Commit**

```text
feat(ui): restore Directive LCARS shell
```

### Task 2: Campaign and Character-Creation Workspaces

**Files:**
- Create: `ui/views/campaign.js`
- Create: `ui/views/creator.js`
- Create: `tests/ui/directive-campaign.test.mjs`
- Modify: `ui/app.js`

**Interfaces:**
- Consumes: `createDirectiveShell`, DOM helpers, Sonder `api`, `chats.open`, `refresh`, and the projection shape.
- Produces: `renderCampaignView(data, state, actions)` and `renderCreatorView(state, actions)`.

- [ ] **Step 1: Write failing campaign/creator behavior tests**

Test the real rendered UI for Command/Library/Records mode switching, active campaign facts, explicit missing-location state, four creator steps, required field retention across steps, review summary, atomic `/start` payload, `chats.open`, progress status, and retry after rejection. The production mutations caught are generic hero fallback, field loss, invented location, and bypassing the supported host lifecycle.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/ui/directive-campaign.test.mjs`

Expected: FAIL because the campaign and creator view modules do not exist.

- [ ] **Step 3: Implement campaign and creator views**

Use Directive campaign command-bar, package-card, metadata-cell, and creator-workspace classes. Preserve every existing `PLAYER_FIELDS` field name and submit `simulation_mode` unchanged. Keep creator state ephemeral until the final submit.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat(ui): port campaign command workspace
```

### Task 3: Mission, People, Ship, and Settings Workspaces

**Files:**
- Create: `ui/views/mission.js`
- Create: `ui/views/people.js`
- Create: `ui/views/ship.js`
- Create: `ui/views/settings.js`
- Create: `tests/ui/directive-routes.test.mjs`
- Modify: `ui/app.js`
- Modify: `ui/index.js`

**Interfaces:**
- Consumes: player-safe projection, shell route body, DOM helpers.
- Produces: `renderMissionView`, `renderPeopleView`, `renderShipView`, and `renderSettingsView`.

- [ ] **Step 1: Write failing route behavior tests**

Use one complete literal projection fixture. Assert mission briefing/objectives/Bearing, People roster ordering and selectable detail, omission of absent private facts, ship identity/readiness/systems/work orders/cohesion disclosures, and branded in-product Settings authority copy. The production mutations caught are generic-card rendering, separate Crew route, unsafe fact fallback, and missing Settings route.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/ui/directive-routes.test.mjs`

Expected: FAIL because the route view modules do not exist.

- [ ] **Step 3: Implement the four workspaces**

Render only literal projection fields. Use native buttons/details for selection and disclosure. Do not add persistence or action routes that the host does not support. Keep Sonder-owned provider controls out of Directive while restoring the Settings route identity.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/ui/directive-routes.test.mjs tests/ui/directive-campaign.test.mjs tests/ui/directive-shell.test.mjs`

Run: `py -3.13 -m pytest tests/ui --basetemp .tmp/pytest-task3`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat(ui): port Directive route workspaces
```

### Task 4: Responsive Browser Parity and Migration Truthfulness

**Files:**
- Create: `tests/ui/playwright-review.mjs`
- Create: `tests/ui/fixtures/directive-harness.html`
- Modify: `ui/directive.css`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MIGRATION_RESPONSIBILITY_MATRIX.md`
- Modify: `docs/MIGRATION_STATUS.md`
- Create: `artifacts/playwright-ui-alignment/REPORT.md` and screenshots (ignored evidence)

**Interfaces:**
- Consumes: completed UI module graph and a configured Playwright runtime.
- Produces: deterministic desktop/mobile browser evidence and accurate migration status.

- [ ] **Step 1: Write the browser assertions before CSS fixes**

The Playwright script renders onboarding and each route at 1440x900 and 390x844. Assert route order, active route identity, `#05070b` canvas, command-orange token, segmented rail on desktop, bottom shelf on mobile, 44px controls, zero Directive-owned horizontal overflow, focus-visible operation, Escape close, reduced motion, successful media, and no console/page/request failures.

- [ ] **Step 2: Run and verify RED**

Run the Playwright script with the workspace Playwright dependency path.

Expected: at least one geometry/token/interaction assertion fails before the final Sonder bridge CSS is complete.

- [ ] **Step 3: Complete responsive CSS and screenshot evidence**

Adjust only the Sonder bridge and portable route selectors needed to satisfy the authoritative layout. Capture onboarding plus all five routes at both viewports. Review them beside the original Directive renders and record host-boundary differences in the report.

- [ ] **Step 4: Correct migration documents**

Record the implemented modules individually. Mark the visual shell/workspaces verified only when live evidence exists; keep notices, campaign management, and any unavailable backend-powered interactions in progress instead of using `Assessed; no gap`.

- [ ] **Step 5: Run the full verification gate**

Run: `node --check ui/index.js` and every UI module.

Run: `node --test tests/ui/*.test.mjs`

Run: `py -3.13 -m pytest --basetemp .tmp/pytest-final`

Run: the complete Playwright review at both viewports.

Expected: 0 failures; only the known external-Sonder skips are allowed when the checkout is not configured.

- [ ] **Step 6: Commit**

```text
test(ui): prove Directive visual alignment
```

