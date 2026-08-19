# Sonder-Native Character Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sonder character ids the only runtime/UI identity while preserving portable Directive package actor bindings and Starfleet crew metadata.

**Architecture:** Replace `directive.crewDomain.v1.crew_id` with a versioned `directive.crewProfile.v2` whose private `binding.actor_ref` connects authored package documents to the Sonder character carrying the state. Normalize old state losslessly, resolve package actors through `api.characters` handles, and omit all package bindings from player-safe projections.

**Tech Stack:** Python 3.11+, dataclasses, pytest, Sonder extension API 1, JavaScript ES modules, Node test runner, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-08-18-sonder-native-character-identity-design.md`

## Global Constraints

- Sonder `char_id` is the sole runtime and UI person identity.
- Directive package actor references remain portable source bindings and never enter player-safe DTOs.
- Existing `directive.crewDomain.v1` state migrates losslessly and never changes its associated Sonder character.
- Do not join characters by display name.
- Keep rank, billet, department, assignment, duty, public record, and operational summary Directive-owned.
- Missing and private values remain omitted rather than inferred.

---

### Task 1: Versioned crew profile and migration

**Files:**
- Modify: `directive/state/contracts.py`
- Modify: `tests/state/test_contracts.py`

**Interfaces:**
- Produces: `PackageActorBinding.from_dict(raw) -> PackageActorBinding`
- Produces: `CrewProfile.from_dict(raw) -> CrewProfile`
- Produces: `migrate_crew_profile(raw) -> dict[str, Any]`
- Produces: `CrewProfile.to_public_dict() -> dict[str, Any]`

- [ ] **Step 1: Write failing v2 and migration tests**

Add tests that require the exact v2 shape, prove `crew_id` is rejected by v2,
prove every optional v1 field survives migration, and prove unknown roots and
schemas fail. The core assertion is:

```python
migrated = migrate_crew_profile(V1_CREW)
assert migrated["binding"]["actor_ref"] == "mara-whitaker"
assert "crew_id" not in migrated
assert CrewProfile.from_dict(migrated).to_public_dict() == {
    "rank": "Captain",
    "role": "Commanding Officer",
    "department": "command",
}
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `py -3.13 -m pytest tests/state/test_contracts.py -q`

Expected: failures because `PackageActorBinding`, `CrewProfile`, and
`migrate_crew_profile` do not exist.

- [ ] **Step 3: Implement strict v2 contracts and v1 normalization**

Implement immutable dataclasses with exact-root validation. Migration accepts
only the exact existing v1 kind/schema and converts:

```python
"crew_id" -> {
    "kind": "directive.packageActorBinding.v1",
    "package_id": PACKAGE_ID,
    "package_version": PACKAGE_VERSION,
    "actor_ref": value["crew_id"],
}
```

`to_public_dict()` emits only player-safe service fields and never emits
`binding`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `py -3.13 -m pytest tests/state/test_contracts.py -q`

Expected: all state-contract tests pass.

- [ ] **Step 5: Commit the state contract**

```text
feat(state): adopt Sonder character identity
```

### Task 2: Provision profiles and migrate registered stories

**Files:**
- Create: `directive/people/__init__.py`
- Create: `directive/people/bindings.py`
- Modify: `directive/campaign/compiler.py`
- Modify: `directive/routes.py`
- Modify: `tests/campaign/test_compiler.py`
- Create: `tests/people/test_bindings.py`
- Modify: `tests/test_extension_package.py`

**Interfaces:**
- Consumes: `migrate_crew_profile(raw)` and `CrewProfile`
- Produces: `resolve_package_actors(api, chat_id) -> dict[str, int]`
- Produces: `migrate_registered_crew_profiles(api) -> dict[str, int]`

- [ ] **Step 1: Write failing compiler, resolver, and activation-migration tests**

Require newly compiled participant state to contain `directive.crewProfile.v2`,
no `crew_id`, and a private binding. Use fake Sonder handles to prove:

```python
assert resolve_package_actors(api, 7) == {"mara-whitaker": 41}
```

Add a duplicate-binding case that raises a stable error and an activation case
where one valid v1 record is rewritten while one corrupt record is logged and
left unchanged.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
`py -3.13 -m pytest tests/campaign/test_compiler.py tests/people/test_bindings.py tests/test_extension_package.py -q`

Expected: failures on the old v1 compiled state and missing binding functions.

- [ ] **Step 3: Compile v2 profiles and implement handle-based resolution**

Change `_crew_domain` into `_crew_profile`, seed the v2 binding, and keep
`resource_uid` as a Sonder archive/import input. In `bindings.py`, enumerate
`api.characters.in_chat(chat_id)`, read `handle.binding()`, validate it through
`PackageActorBinding`, and map each actor reference to `handle.char_id`.

`migrate_registered_crew_profiles` enumerates `api.chats.mine()` and current
character handles, persists only exact v1 conversions using
`handle.state.set_now`, catches errors per record, and reports migrated/skipped/
failed counts. `routes.register` invokes it after registering supported seams.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:
`py -3.13 -m pytest tests/campaign/test_compiler.py tests/people/test_bindings.py tests/test_extension_package.py -q`

Expected: all selected tests pass.

- [ ] **Step 5: Commit provisioning and binding resolution**

```text
feat(people): bind package actors to Sonder ids
```

### Task 3: Remove package identity from player projection and UI

**Files:**
- Modify: `directive/projection/player.py`
- Modify: `ui/views/people.js`
- Modify: `tests/projection/test_player.py`
- Modify: `tests/ui/directive-routes.test.mjs`
- Modify: `tests/ui/fixtures/directive-harness.html`

**Interfaces:**
- Consumes: `migrate_crew_profile(raw)` and `CrewProfile.to_public_dict()`
- Produces: player `directive` objects containing only service fields and media

- [ ] **Step 1: Write failing projection and UI tests**

Require recognized crew to remain keyed by Sonder id while the serialized
projection contains none of these strings:

```python
for forbidden in ("crew_id", "actor_ref", PACKAGE_ID,
                  "directive-crew-mara-whitaker"):
    assert forbidden not in json.dumps(projection)
```

Update the DOM fixture to omit `crew_id` and assert the detail label still reads
`Personnel record` because `person.directive` exists.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
`py -3.13 -m pytest tests/projection/test_player.py -q; node --test tests/ui/directive-routes.test.mjs`

Expected: projection fails because it emits `crew_id`; UI fails because the
personnel label still depends on `domain.crew_id`.

- [ ] **Step 3: Project normalized public profile data only**

Normalize v1/v2 state, call `to_public_dict()`, select media internally through
`profile.binding.actor_ref`, and never copy `binding` into the DTO. Change the
People detail label condition to `Boolean(person.directive)`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:
`py -3.13 -m pytest tests/projection/test_player.py -q; node --test tests/ui/directive-routes.test.mjs`

Expected: both focused suites pass.

- [ ] **Step 5: Commit the projection/UI boundary**

```text
refactor(ui): use Sonder person ids exclusively
```

### Task 4: Current-Sonder integration and migration documentation

**Files:**
- Modify: `tests/integration/test_atomic_provisioning.py`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MIGRATION_STATUS.md`
- Modify: `docs/MIGRATION_RESPONSIBILITY_MATRIX.md`

**Interfaces:**
- Consumes: v2 compiled profiles, host character handles, player-safe projection
- Produces: executable proof that current Sonder owns identity end to end

- [ ] **Step 1: Add failing current-host assertions**

Assert current Sonder provisions v2 profiles, `api.characters` resolves the
package bindings to the remapped numeric ids, archive round-trip preserves the
binding/profile association, and player projection omits package identity.

- [ ] **Step 2: Run current-host integration and confirm RED**

Run:
`$env:SONDER_ENGINE_ROOT='F:\git\Sonder_Engine'; py -3.13 -m pytest tests/integration/test_atomic_provisioning.py -q`

Expected: failure against old v1 assertions until the integration contract is
updated to the new identity boundary.

- [ ] **Step 3: Update architecture and migration records**

Document Sonder `char_id` as sole runtime identity, Directive package actor
bindings as private portable source references, the v1-to-v2 migration, and the
fact that Starfleet service metadata remains Directive-owned.

- [ ] **Step 4: Run focused integration and documentation checks**

Run:
`$env:SONDER_ENGINE_ROOT='F:\git\Sonder_Engine'; py -3.13 -m pytest tests/integration/test_atomic_provisioning.py -q; git diff --check`

Expected: integration passes and the diff check reports no errors.

- [ ] **Step 5: Commit integration and documentation**

```text
docs: record Sonder-native identity boundary
```

### Task 5: Full verification and integration

**Files:**
- Modify only files required by failures proven during this task

**Interfaces:**
- Consumes: the complete refactor
- Produces: release-ready evidence on current Sonder alpha 9.5

- [ ] **Step 1: Run the complete Python suite against current Sonder**

Run:
`$env:SONDER_ENGINE_ROOT='F:\git\Sonder_Engine'; py -3.13 -m pytest -q --disable-warnings --basetemp .tmp/pytest-sonder-native-identity`

Expected: zero failures and all host-dependent tests execute.

- [ ] **Step 2: Run all UI tests and syntax checks**

Run:
`node --check ui/index.js; node --check ui/app.js; node --test tests/ui/*.test.mjs`

Expected: zero syntax or test failures.

- [ ] **Step 3: Run live Playwright against current Sonder**

Run:
`$env:SONDER_ENGINE_ROOT='F:\git\Sonder_Engine'; $env:DIRECTIVE_SOURCE_ROOT='F:\git\Directive'; node tests/ui/playwright-review.mjs`

Expected: 12 screenshots and no browser/runtime failures.

- [ ] **Step 4: Review the complete diff and verify repository state**

Run: `git diff --check; git status -sb; git log --oneline --decorate -8`

Expected: only scoped commits on the feature branch and no uncommitted tracked
changes.

- [ ] **Step 5: Fast-forward main and push**

Verify the feature tip descends from current local/remote main, fast-forward
main, rerun the complete gate on merged main, push `origin main`, and confirm
local and GitHub main SHAs match.

