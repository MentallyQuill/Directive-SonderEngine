# Foundation and Atomic Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable Directive Sonder extension that strictly validates its state and compiles Ashes of Peace into one atomically provisioned, immediately playable Sonder story.

**Architecture:** A minimal `extension.py` registers only supported Sonder seams and delegates to a focused `directive` Python package. Authored Directive JSON is validated and compiled into Sonder's existing chat-archive format; `api.provision_story` seeds all Directive state, contexts, authority, documents and participant extension state in one transaction.

**Tech Stack:** Python 3.11+, pytest 8+, Pydantic 1.10/2.x-compatible public APIs, Sonder extension API 1, JSON, JavaScript ES modules for the later UI entry.

**Spec:** `docs/superpowers/specs/2026-08-18-directive-sonder-migration-design.md`

## Global Constraints

- Reference repositories are read-only.
- Runtime code may not import SillyTavern modules or contact SillyTavern endpoints.
- No production code is written before its focused test fails for the expected missing behavior.
- Missing player-safe values are omitted, never defaulted.
- Ashes provisioning uses `player_authority="actor_only"`.
- No post-provision bootstrap call may be required.
- No push, publication, deployment or pull request.

---

### Task 1: Extension package and test harness

**Files:**
- Create: `manifest.json`
- Create: `extension.py`
- Create: `directive/__init__.py`
- Create: `pyproject.toml`
- Create: `tests/conftest.py`
- Create: `tests/test_extension_package.py`

**Interfaces:**
- Produces: `extension.register(api) -> None`
- Produces: importable `directive` package with `__version__`

- [ ] **Step 1: Write the failing manifest/registration test**

```python
def test_manifest_declares_a_native_sonder_extension(repo_root):
    manifest = json.loads((repo_root / "manifest.json").read_text())
    assert manifest["id"] == "directive"
    assert manifest["ext_api"] == 1
    assert manifest["capabilities"]["python"] == "extension.py"

def test_register_delegates_to_routes(fake_api):
    import extension
    extension.register(fake_api)
    assert ("POST", "/start") in fake_api.routes
```

- [ ] **Step 2: Run it and confirm RED**

Run: `python -m pytest tests/test_extension_package.py -q`

Expected: failure because `manifest.json` and `extension.py` do not exist.

- [ ] **Step 3: Add the minimal package**

`manifest.json` declares id `directive`, version `0.1.0`, ext API 1, Python `extension.py`, an ES-module UI entry, CSS, chat state, commit domains and `/start`/projection routes. `extension.register` imports and calls `directive.routes.register(api)`; no engine internals are imported.

- [ ] **Step 4: Run GREEN**

Run: `python -m pytest tests/test_extension_package.py -q`

Expected: all package tests pass.

- [ ] **Step 5: Commit**

```powershell
git add manifest.json extension.py directive pyproject.toml tests
git commit -m "feat: establish Sonder extension package"
```

### Task 2: Strict Directive state contracts

**Files:**
- Create: `directive/state/__init__.py`
- Create: `directive/state/contracts.py`
- Create: `tests/state/test_contracts.py`

**Interfaces:**
- Produces: `CampaignConfig.from_dict(value) -> CampaignConfig`
- Produces: `FrameState.from_dict(value) -> FrameState`
- Produces: `CrewDomain.from_dict(value) -> CrewDomain`
- Produces: `.to_dict() -> dict[str, object]` on each contract

- [ ] **Step 1: Write failing strict-shape tests**

Tests require exact `kind`/`schema` values, Ashes package identity, explicit state roots, rejection of unknown roots, distinct chat/frame scopes, and omission-preserving optional crew fields.

```python
def test_frame_state_rejects_an_unknown_root():
    with pytest.raises(StateContractError, match="unknown root"):
        FrameState.from_dict({**valid_frame_state(), "shadowTimeline": {}})
```

- [ ] **Step 2: Run RED**

Run: `python -m pytest tests/state/test_contracts.py -q`

Expected: import failure for missing contracts.

- [ ] **Step 3: Implement immutable parsing/serialization**

Use frozen dataclasses and explicit key-set checks. Initial chat config contains package/provenance/configuration only. Initial frame state contains mission, settlement, ship, command and time roots with schema stamps. Crew data accepts only Directive public/operational fields and does not synthesize absent values.

- [ ] **Step 4: Run GREEN**

Run: `python -m pytest tests/state/test_contracts.py -q`

Expected: all state contract tests pass.

- [ ] **Step 5: Commit**

```powershell
git add directive/state tests/state
git commit -m "feat: define Directive state contracts"
```

### Task 3: Authored Ashes package loader

**Files:**
- Create: `directive/campaign/__init__.py`
- Create: `directive/campaign/source.py`
- Create: `packages/ashes-of-peace/` (selected authored JSON copied only after this responsibility classification)
- Create: `tests/campaign/test_source.py`

**Interfaces:**
- Produces: `load_ashes_source(root: Path | None = None) -> AshesSource`
- Produces: `AshesSource.validate() -> None`

- [ ] **Step 1: Write failing source-validation tests**

Tests pin package id/version, 13 mission ids and order, unique crew ids, unique objective/evidence ids, ship/cohesion references and absence of mission-countdown fields.

- [ ] **Step 2: Run RED**

Run: `python -m pytest tests/campaign/test_source.py -q`

Expected: missing loader/package failure.

- [ ] **Step 3: Copy only classified authored data and implement the loader**

Copy the Ashes campaign package, 13 V1 missions, ship dataset, senior-staff dataset and cohesion catalog. Do not copy SillyTavern saves, presets, host metadata or runtime modules. Validate cross-document ids and freeze source objects before returning them.

- [ ] **Step 4: Run GREEN**

Run: `python -m pytest tests/campaign/test_source.py -q`

Expected: package contract tests pass with 13 missions.

- [ ] **Step 5: Commit**

```powershell
git add directive/campaign packages tests/campaign
git commit -m "feat: load authored Ashes campaign data"
```

### Task 4: Sonder archive compiler

**Files:**
- Create: `directive/campaign/compiler.py`
- Create: `tests/campaign/test_compiler.py`

**Interfaces:**
- Consumes: `AshesSource`, `PlayerSetup`
- Produces: `compile_ashes_archive(source, player) -> ProvisioningBundle`
- `ProvisioningBundle` fields: `archive`, `state`, `frame_state`, `director_context`, `narration_context`, `documents`, `package_id`, `package_version`, `player_authority`

- [ ] **Step 1: Write failing compiler tests**

Assert the archive has one persona, all senior staff with unique old ids, participant `state` JSON containing `ext:directive` crew data, a playable opening scene, package-authored rooms/lore, host clock seed, and no hidden Directive fields in public card surfaces. Assert all provisioning arguments exist before the API call.

- [ ] **Step 2: Run RED**

Run: `python -m pytest tests/campaign/test_compiler.py -q`

Expected: missing compiler failure.

- [ ] **Step 3: Implement the pure compiler**

Build ordinary JSON-compatible values only. Store Directive crew domain data in each participant's serialized state; use Sonder card fields for host identity, public appearance/history and private character material. Seed chat config/frame state/documents without opening a database or importing Sonder.

- [ ] **Step 4: Run GREEN**

Run: `python -m pytest tests/campaign/test_compiler.py -q`

Expected: compiler tests pass and the bundle is JSON serializable.

- [ ] **Step 5: Commit**

```powershell
git add directive/campaign/compiler.py tests/campaign/test_compiler.py
git commit -m "feat: compile Ashes for Sonder provisioning"
```

### Task 5: Atomic start route against current Sonder

**Files:**
- Create: `directive/routes.py`
- Create: `tests/integration/test_atomic_provisioning.py`
- Modify: `tests/conftest.py`

**Interfaces:**
- Produces: `register(api) -> None`
- Produces route: `POST /start` with validated player setup
- Calls exactly once: `api.provision_story(bundle.archive, state=..., frame_state=..., package_id=..., package_version=..., player_authority="actor_only", director_context=..., narration_context=..., documents=...)`

- [ ] **Step 1: Write the failing route test with a recording API**

Assert one call carries every initialization argument and there are no subsequent state/context/document writes.

- [ ] **Step 2: Run RED**

Run: `python -m pytest tests/integration/test_atomic_provisioning.py -q`

Expected: `/start` is not registered.

- [ ] **Step 3: Implement minimal route registration and validation**

Reject missing/invalid player fields before compiling. Return the host result unchanged plus Directive package metadata. Do not catch and downgrade `ExtensionError` from provisioning.

- [ ] **Step 4: Run target integration against current Sonder**

Stage the repository under a temporary extensions root named `directive`, enable it with the current Sonder loader, dispatch `/start`, and assert `story_view` contains the persona/cast/scene, provenance names Ashes, authority is `actor_only`, and Directive state/documents exist. Inject one invalid document and assert the database inventory is byte-for-byte unchanged after failure.

Run: `python -m pytest tests/integration/test_atomic_provisioning.py -q`

Expected: all focused integration tests pass.

- [ ] **Step 5: Commit**

```powershell
git add directive/routes.py tests
git commit -m "feat: provision Ashes atomically"
```

### Task 6: Foundation verification and status reconciliation

**Files:**
- Modify: `docs/MIGRATION_STATUS.md`
- Modify: `docs/MIGRATION_RESPONSIBILITY_MATRIX.md`
- Create: `README.md`

**Interfaces:** None; documentation must match executable evidence.

- [ ] **Step 1: Run focused and complete current target tests**

Run: `python -m pytest -q`

Expected: zero failures.

- [ ] **Step 2: Run packaging and forbidden-dependency audits**

Run: `python -m compileall -q directive extension.py`

Run: `rg -n -i "sillytavern|/api/files|generate_interceptor|chat_metadata|jQuery|window\.SillyTavern" directive extension.py manifest.json ui`

Expected: compile succeeds; forbidden audit has no runtime matches.

- [ ] **Step 3: Inspect the diff and update only evidence-backed statuses**

Mark foundation and provisioning rows **Verified** only when their focused and integration commands passed. Leave later phases **Assessed**.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs
git commit -m "docs: record provisioning milestone"
```

## Plan self-review

- Spec coverage: native package, strict state ownership, selected authored data, archive compilation, atomic provisioning and clean verification are covered.
- Placeholder scan: no TBD/TODO/deferred implementation steps remain in this phase.
- Interface consistency: Task 3 produces `AshesSource`; Task 4 consumes it and produces `ProvisioningBundle`; Task 5 is the only consumer of the bundle's host-facing fields.

