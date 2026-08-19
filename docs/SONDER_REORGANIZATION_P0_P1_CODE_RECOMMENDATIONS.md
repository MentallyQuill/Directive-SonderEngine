# Sonder Engine reorganization: P0/P1 code recommendations for Directive

Audience: Sonder Engine developer  
Reviewed branch: [`reorganization`](https://github.com/N0819/Sonder_Engine/tree/52fd9573f620c18905839e379612f378f4f621bb)  
Reviewed commit: `52fd9573f620c18905839e379612f378f4f621bb`  
Baseline: `main` at `418ab5b469ebd8682157646229ae7e5bc7aa078b` (`alpha 9.5`)  
Companion review: `docs/SONDER_REORGANIZATION_DIRECTIVE_COMPATIBILITY_REVIEW.docx`

## Purpose

This document turns the P0 and P1 findings from the compatibility review into concrete code recommendations. It is not a release decision and does not ask Sonder to absorb Directive's campaign semantics. The goal is to make Sonder's public extension boundary sufficient for Directive without coupling Directive production code to `core.db`, `web.app`, or other reorganized internals.

The code below is source-grounded against `52fd9573`. It is recommended patch shape, not a claim that these exact diffs have been applied or run upstream.

## Recommended patch set

| Priority | Patch | Primary files | Result |
|---|---|---|---|
| P0 | Add a frame-bound extension read facade | `extension_runtime/api.py`, `web/story_view.py`, `tests/test_extensions.py`, `tests/test_story_view.py` | One Directive projection cannot mix frames |
| P0 | Restore the declared CI contract | `agents/director_floors.py`, `agents/director_scopes.py`, `tests/test_lore_blind_scoring.py`, `.github/workflows/ci.yml` | Python 3.11/3.12, Pydantic 1.x, and browser gates report independently |
| P1 | Add an executable extension contract fixture | `tests/test_extension_contract.py` or `tests/test_extensions.py` | Public API behavior is tested as an external extension would use it |
| P1 | Stage and audit the files that will actually install | `extension_runtime/__init__.py`, `tests/test_extension_install.py` | Git worktrees install cleanly without weakening symlink/size defenses |
| P1 | Update Directive's test-only host imports | Directive `tests/integration/test_atomic_provisioning.py` | Reorganization stops breaking the external integration harness |

## P0.1 - Make public extension reads frame-coherent

### Confirmed failure

`web.story_view.player_view()` now resolves the latest committed turn across all frames and holds that turn's frame while building the view. That repair is correct in isolation. However, Directive builds one DTO using separate public calls:

```python
player = api.player_view(chat_id, "player")
frame = api.frame_state(chat_id).get() or {}
campaign_state = api.state(chat_id).get() or {}
# _people(...) later calls api.char_state(chat_id, person_id).get()
```

The first call reads the latest turn's frame. `frame_state()` and `char_state()` use `core.db.active_frame_id`, which is unset for an extension HTTP route, so they read the implicit present frame. A valid DTO can therefore contain future-frame location/identity with present-frame mission, time, and crew state.

Relevant current code:

- [`web/story_view.py`: `latest_turn`, `_reading_frame`, `story_view`, `player_view`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/web/story_view.py)
- [`extension_runtime/api.py`: `_world_state`, `_read_char_state`, `story_view`, `player_view`, `frame_state`, `char_state`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/extension_runtime/api.py)
- [`core/db.py`: `wget_for_frame` and `wset_for_frame`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/core/db.py)

### Recommended API

Add `api.at_frame(chat_id, frame_id=LATEST)` and return an immutable, frame-bound facade. Omitting `frame_id` resolves the latest committed turn once. Passing `None` explicitly means the implicit present frame. Passing an integer selects that declared frame after verifying it belongs to the chat.

```python
view = api.at_frame(chat_id)            # latest committed turn's frame
player = view.player_view("player")
mission = view.frame_state().get() or {}
crew = view.char_state(person_id).get() or {}

assert view.frame_id == player["frame"]["id"]
```

Why a facade instead of only adding optional `frame_id` parameters:

1. The frame is resolved once, not independently by every method.
2. The selected frame is inspectable in logs and tests.
3. A future DTO can add more reads without remembering to propagate `frame_id` again.
4. Existing methods remain backward-compatible for extensions that do not need coordinated reads.

### Recommended `extension_runtime/api.py` patch shape

Use a private sentinel because `None` is a real frame identifier (the implicit present era).

```python
_LATEST_FRAME = object()
_AMBIENT_FRAME = object()


def _validate_frame(chat_id, frame_id):
    from core.frames import get_frame

    if frame_id is None:
        return None
    frame = get_frame(frame_id)
    if frame is None or int(frame["chat_id"]) != int(chat_id):
        raise ExtensionError(
            f"frame {frame_id!r} does not belong to chat {int(chat_id)}")
    return int(frame_id)


def _latest_frame_id(chat_id):
    from web.story_view import latest_turn

    turn = latest_turn(int(chat_id))
    return turn["frame_id"] if turn else None
```

Make frame-scoped extension state support an explicit frame while retaining the ambient behavior used inside pipeline execution:

```python
def _world_state(ext_id, chat_id, *, gated=True, frame_scoped=False,
                 frame_id=_AMBIENT_FRAME):
    from core.db import wget, wget_for_frame, wset, wset_for_frame

    key = f"{'extf' if frame_scoped else 'ext'}:{ext_id}"
    cid = int(chat_id)

    if frame_scoped and frame_id is not _AMBIENT_FRAME:
        reader = lambda: wget_for_frame(cid, key, frame_id)
        writer = lambda value: wset_for_frame(cid, key, value, frame_id)
    else:
        reader = lambda: wget(cid, key)
        writer = lambda value: wset(cid, key, value)

    return ExtState(
        f"extension {ext_id!r} state for chat {cid}",
        reader,
        writer,
        gated=gated,
    )
```

Do the same for character state. Do not set `active_frame_id` and leave it ambient across arbitrary extension code; resolve it into the query and write call:

```python
def _read_char_state(chat_id, char_id, *, frame_id=_AMBIENT_FRAME):
    from core.db import active_frame_id, q

    resolved = active_frame_id.get() if frame_id is _AMBIENT_FRAME else frame_id
    row = q(
        "SELECT COALESCE(ccf.state, cc.state) AS state FROM chat_chars cc "
        "LEFT JOIN chat_char_frames ccf "
        "  ON ccf.chat_id=cc.chat_id AND ccf.char_id=cc.char_id "
        " AND ccf.frame_id IS ? "
        "WHERE cc.chat_id=? AND cc.char_id=?",
        (resolved, int(chat_id), int(char_id)), one=True,
    )
    if not row:
        raise ExtensionError(
            f"character {char_id} is not attached to chat {chat_id}")
    try:
        state = json.loads(row["state"] or "{}")
    except (TypeError, ValueError):
        state = {}
    return state if isinstance(state, dict) else {}


def _write_char_state(chat_id, char_id, mutate, *, frame_id=_AMBIENT_FRAME):
    from core.db import active_frame_id
    from story.scene import set_char_state

    resolved = active_frame_id.get() if frame_id is _AMBIENT_FRAME else frame_id
    state = _read_char_state(chat_id, char_id, frame_id=resolved)
    mutate(state)
    set_char_state(
        int(chat_id), int(char_id),
        json.dumps(state, ensure_ascii=False),
        frame_id=resolved,
    )


def _char_ext_state(ext_id, chat_id, char_id, *, gated=True,
                    frame_id=_AMBIENT_FRAME):
    key = f"ext:{ext_id}"

    def read():
        return _read_char_state(
            chat_id, char_id, frame_id=frame_id).get(key)

    def write(value):
        def mutate(state):
            state[key] = value
        _write_char_state(
            chat_id, char_id, mutate, frame_id=frame_id)

    return ExtState(
        f"extension {ext_id!r} state for character {char_id} "
        f"in chat {chat_id}",
        read, write, gated=gated,
    )
```

Then add the bound facade. A normal class is enough; a dataclass is optional.

```python
class ExtensionFrameView:
    def __init__(self, api, chat_id, frame_id):
        self._api = api
        self.chat_id = int(chat_id)
        self.frame_id = frame_id

    def story_view(self, *, events=None):
        return self._api.story_view(
            self.chat_id, events=events, frame_id=self.frame_id)

    def player_view(self, viewer="player", *, memories=12):
        return self._api.player_view(
            self.chat_id, viewer, memories=memories,
            frame_id=self.frame_id)

    def frame_state(self):
        return _world_state(
            self._api.id, self.chat_id,
            frame_scoped=True, frame_id=self.frame_id)

    def char_state(self, char_id):
        return _char_ext_state(
            self._api.id, self.chat_id, char_id,
            frame_id=self.frame_id)


class SonderExtensionAPI:
    # ...existing methods...

    def at_frame(self, chat_id, frame_id=_LATEST_FRAME):
        """Return a public read/write facade bound to exactly one frame.

        Omit frame_id to select the latest committed turn's frame. Pass None
        explicitly for the implicit present era.
        """
        cid = int(chat_id)
        resolved = (_latest_frame_id(cid)
                    if frame_id is _LATEST_FRAME else frame_id)
        resolved = _validate_frame(cid, resolved)
        return ExtensionFrameView(self, cid, resolved)
```

Keep the existing `api.frame_state(chat_id)` and `api.char_state(chat_id, char_id)` behavior for compatibility. Internally they continue using `_AMBIENT_FRAME`.

Extend the existing public view methods without passing `api.py`'s private sentinel into `web.story_view.py` (the two modules' sentinels are intentionally different objects):

```python
def story_view(self, chat_id, *, events=None, frame_id=_LATEST_FRAME):
    from web import story_view as facade

    kwargs = {}
    if events is not None:
        kwargs["events"] = events
    if frame_id is not _LATEST_FRAME:
        kwargs["frame_id"] = frame_id
    return facade.story_view(chat_id, **kwargs)


def player_view(self, chat_id, viewer="player", *, memories=12,
                frame_id=_LATEST_FRAME):
    from web import story_view as facade

    kwargs = {"memories": memories}
    if frame_id is not _LATEST_FRAME:
        kwargs["frame_id"] = frame_id
    return facade.player_view(chat_id, viewer, **kwargs)
```

### Recommended `web/story_view.py` patch shape

Both public views need an explicit `frame_id` path so the bound facade does not re-resolve “latest” between calls. Use another sentinel to distinguish omitted/latest from explicit present (`None`).

```python
_LATEST_FRAME = object()


def _turn_for_read(chat_id, frame_id=_LATEST_FRAME):
    if frame_id is _LATEST_FRAME:
        return latest_turn(chat_id)
    return latest_turn(chat_id, frame_id=frame_id)


def story_view(chat_id, *, events=DEFAULT_EVENT_LIMIT,
               frame_id=_LATEST_FRAME):
    chat_id = int(chat_id)
    chat = _chat_row(chat_id)
    if not chat:
        raise ValueError(f"no chat {chat_id}")

    turn = _turn_for_read(chat_id, frame_id)
    resolved = turn["frame_id"] if frame_id is _LATEST_FRAME and turn else frame_id
    with _reading_frame_id(resolved):
        return _story_view_in_frame(chat_id, chat, turn, events)


def player_view(chat_id, viewer="player", *, memories=12,
                frame_id=_LATEST_FRAME):
    chat_id = int(chat_id)
    identity = _viewer_identity(chat_id, viewer)
    if identity is None:
        raise ValueError(f"no viewer {viewer!r} in chat {chat_id}")

    turn = _turn_for_read(chat_id, frame_id)
    resolved = turn["frame_id"] if frame_id is _LATEST_FRAME and turn else frame_id
    with _reading_frame_id(resolved):
        view = _player_view_in_frame(chat_id, identity, turn, memories)
    view["frame"] = _frame_from_id(resolved)
    return view
```

Implementation notes:

- Rename `_reading_frame(turn)` to `_reading_frame_id(frame_id)` or add the latter beside it.
- Validate a non-`None` frame belongs to `chat_id` before reading. `core.frames.get_frame()` already returns `chat_id` for declared frames.
- Add the selected `frame` to `player_view`, matching `story_view`. This makes coherence observable without disclosing private state.
- An additive `frame` field should not require a schema bump unless a current consumer rejects unknown fields. If any consumer does, bump `STORY_VIEW_SCHEMA` and document the change.
- Event reads currently query by `chat_id`, not frame. Decide explicitly whether events are story-global or frame-bound; do not let the new facade imply frame-scoped events if they are intentionally global.

### Directive usage after the patch

The Directive projection should change from independent calls to one bound facade:

```diff
 def create_player_projection(api, chat_id: int) -> dict[str, Any]:
     source = load_ashes_source()
-    player = api.player_view(chat_id, "player")
-    frame = api.frame_state(chat_id).get() or {}
+    host = api.at_frame(chat_id)
+    player = host.player_view("player")
+    frame = host.frame_state().get() or {}
     campaign_state = api.state(chat_id).get() or {}
```

Pass `host` into `_people(...)` and use `host.char_state(person_id)` there. `api.state(chat_id)` remains chat-global by design and does not need frame binding.

### Required tests

Add a route-level test, not only unit tests of the helper. The defect exists because separately correct APIs were composed through a real extension route.

```python
def test_extension_route_reads_one_frame_for_the_whole_projection(
        temp_db, story, ext_root):
    from core.db import active_frame_id, wset
    from story.scene import set_char_state
    from web import app

    # Create a future frame and seed values that cannot be confused with
    # the present frame.
    future = app.frames_create(
        story["chat_id"],
        {"label": "Future", "ordinal": 10, "kind": "future"})
    token = active_frame_id.set(future["id"])
    try:
        wset(story["chat_id"], "scene", {
            "location": "future-bridge", "time": "after",
            "rooms": {"future-bridge": {"name": "Future Bridge"}},
            "positions": {"Sam": "future-bridge"},
            "entities": {},
        })
        wset(story["chat_id"], "extf:directive", {
            "mission": {"revision": 77}})
        set_char_state(
            story["chat_id"], story["char_id"],
            json.dumps({"ext:directive": {"duty": "future"}}),
            frame_id=future["id"],
        )
    finally:
        active_frame_id.reset(token)

    temp_db.qi(
        "INSERT INTO turns(chat_id,idx,player_input,created,frame_id) "
        "VALUES(?,?,?,?,?)",
        (story["chat_id"], 99, "look", time.time(), future["id"]),
    )

    api = extension_runtime._apis["directive"]
    bound = api.at_frame(story["chat_id"])

    assert bound.frame_id == future["id"]
    assert bound.player_view()["location"] == {
        "room_id": "future-bridge", "name": "Future Bridge"}
    assert bound.frame_state().get()["mission"]["revision"] == 77
    assert bound.char_state(story["char_id"]).get()["duty"] == "future"
```

Also test:

- `api.at_frame(chat_id, None)` reads the implicit present frame.
- Selecting a frame from another chat raises `ExtensionError`.
- A frame with no turns has defined behavior (recommended: return the selected frame's state with `turn=None`).
- A bound `ExtState` still reads the captured frame if `.get()` is called after another context changes `active_frame_id`.
- Writes through the bound facade land only in the selected frame.
- Checkpoint restore, branch, and archive preserve the selected frame's extension and character domains.

## P0.2 - Restore the declared CI/runtime contract

The failed run is [CI 32204039378](https://github.com/N0819/Sonder_Engine/actions/runs/32204039378): Python 3.11 cannot compile; Python 3.12 reports 17 failures; Pydantic 1.x and browser jobs are skipped because both declare `needs: fast` without an always-run condition.

### Fix the Python 3.11 parser failure

`agents/director_floors.py:577` uses nested double quotes inside a double-quoted f-string expression. Python 3.12 accepts the PEP 701 form; Python 3.11 does not.

```diff
 return re.compile(
-    rf"{name}(?:'s)?{gap}(?:\S+\s+){{0,4}}?{_ling("_DESTRUCTION_TERMINAL_CUES")}"
-    rf"|{_ling("_DESTRUCTION_VERB_OBJECT")}{gap}"
+    rf"{name}(?:'s)?{gap}(?:\S+\s+){{0,4}}?{_ling('_DESTRUCTION_TERMINAL_CUES')}"
+    rf"|{_ling('_DESTRUCTION_VERB_OBJECT')}{gap}"
     rf"(?:the\s+|all\s+of\s+|the\s+whole\s+|the\s+entire\s+|most\s+of\s+)?"
     rf"{name}"
-    rf"|{_ling("_DESTRUCTION_OF_PHRASE")}{gap}(?:the\s+)?{name}"
+    rf"|{_ling('_DESTRUCTION_OF_PHRASE')}{gap}(?:the\s+)?{name}"
 )
```

Add a direct compile regression to the existing compile gate; `make check-fast` already invokes it, so no new job is required.

### Fix Pydantic-2 specialist channel introspection

The seven director-orchestration failures and two resolve-reconciliation failures share one upstream cause: `_schema_list_channels()` reads `StateDiff.__fields__` and `field.outer_type_`. Under Pydantic 2, the field objects do not expose the Pydantic-1 `outer_type_` contract. `_LIST_DELEGATED` becomes empty, so list channels such as `contact_ops`, `introductions`, `remove_rooms`, and `crowd_ops` are normalized as dicts and discarded.

`llm.schemas` already owns the cross-version compatibility layer through `_fields()` and `_declared()`. Reuse it instead of creating a second Pydantic version check in `director_scopes.py`.

```diff
 def _schema_list_channels():
-    from llm.schemas import StateDiff
-
-    out = set()
-    for name, field in StateDiff.__fields__.items():
-        annotation = getattr(field, "outer_type_", None)
-        if annotation is list or get_origin(annotation) is list:
-            out.add(name)
-    return out
+    from llm.schemas import StateDiff, _declared, _fields
+
+    return {
+        name
+        for name, field in _fields(StateDiff).items()
+        if _declared(field).is_list
+    }
```

If private imports between host modules are undesirable, rename/export those helpers as `model_fields()` and `declared_field()` from `llm.schemas`; do not duplicate their Pydantic-1/Pydantic-2 branching.

Add one focused invariant test:

```python
def test_every_list_state_diff_channel_is_registered_as_list_shaped():
    from agents.director_scopes import _LIST_DELEGATED, _schema_list_channels

    expected = _schema_list_channels()
    assert expected
    assert expected <= _LIST_DELEGATED
    assert {"contact_ops", "introductions", "remove_rooms", "crowd_ops"} \
        <= _LIST_DELEGATED
```

This test must run in both the normal Pydantic-2 matrix and the Pydantic-1 job.

### Fix the NumPy fixture dtype, not production vector decoding

The lore tests say `_entry()` creates “exactly `dims` float32s,” but this expression can promote the result to float64:

```python
np.ones(dims, dtype=np.float32) / np.sqrt(dims)
```

The byte buffer then contains twice the expected number of float32 elements, so production `_vec(..., dtype=np.float32)` correctly observes 512 values where the test claims it wrote 256. Do not change `_vec()` to accommodate an incorrectly encoded fixture.

Create one test helper and use it throughout `tests/test_lore_blind_scoring.py`:

```python
def _unit_vector(dims):
    value = np.float32(1.0 / np.sqrt(dims))
    return np.full(dims, value, dtype=np.float32)


def _entry(db, book_id, title, content, dims, keys=""):
    vec = _unit_vector(dims)
    assert vec.dtype == np.float32
    assert vec.nbytes == dims * np.dtype(np.float32).itemsize
    return db.qi(
        "INSERT INTO lore_entries(lorebook_id,title,keys,content,category,"
        "embedding) VALUES(?,?,?,?,?,?)",
        (book_id, title, keys, content, "layout", vec.tobytes()),
    )
```

Use `_unit_vector(dims)` in `_stub_embedder()`, `_live_embedder()`, and every inline vector fixture in that file. Keep the `nbytes` assertion so a future NumPy promotion cannot silently invalidate the tests again.

### Let independent CI gates report independently

Current `pydantic1` and `browser` jobs use `needs: fast`. GitHub skips them when either `fast` matrix leg fails, which hid their status in the reviewed run.

```diff
 pydantic1:
   needs: fast
+  if: ${{ always() && !cancelled() }}
   runs-on: ubuntu-latest

 browser:
   needs: fast
+  if: ${{ always() && !cancelled() }}
   runs-on: ubuntu-latest
```

If the intent is merely ordering, this preserves it while reporting all gates. If the intent was to save cost after a core failure, keep the dependency but accept that the branch cannot claim browser or Pydantic-1 evidence from a failed run.

### P0 verification commands

```bash
python3.11 -m compileall -q .
python3.12 -m pytest -q \
  tests/test_director_orchestration.py \
  tests/test_resolve_reconciliation.py \
  tests/test_lore_blind_scoring.py
make check-fast
```

Then verify the Pydantic-1 and browser jobs actually execute in GitHub Actions. A green local Pydantic-2 run is not evidence for either.

## P1.1 - Add an executable extension contract fixture

### Problem

Sonder already has strong unit coverage for extension state, checkpoint restore, disabled assets, and story/player views. What is missing is composition coverage that behaves like a real external extension: register, serve a route, make several public reads, and verify persistence/lifecycle behavior through the host surface.

The mixed-frame defect passed because `story_view` and `player_view` were tested for frame correctness separately from `frame_state` and `char_state`.

### Recommended test fixture

Add `tests/test_extension_contract.py` with a minimal generated extension. Keep the fixture intentionally generic; it should model an external consumer without importing Directive campaign code.

```python
CONTRACT_EXTENSION = '''
def register(api):
    def projection(request):
        chat_id = request.chat_id
        if chat_id is None:
            raise ValueError("chat_id is required")
        viewer = request.query.get("viewer", "player")
        person_id = int(request.query["person_id"])
        host = api.at_frame(chat_id)
        return {
            "frame_id": host.frame_id,
            "player": host.player_view(viewer),
            "frame_state": host.frame_state().get(),
            "char_state": host.char_state(person_id).get(),
            "story_state": api.state(chat_id).get(),
        }

    api.add_route("/projection", projection, methods=("GET",))
'''
```

Contract scenarios:

1. Latest-turn frame coherence across `player_view`, `frame_state`, and `char_state`.
2. Explicit present/future selection and rejection of a foreign-chat frame.
3. Checkpoint restore of chat-global, frame-scoped, and character extension domains.
4. Branch and archive round-trip, including frame-ID remapping.
5. Disabled/failed extension serves no route, assets, UI, or stored context.
6. `on_error="fail"` commit domain rolls back both core and extension writes.
7. Re-enable registers each hook/stage/route once; no stale registration survives disable.

Do not assert internal registry layout. Invoke `web.app` endpoints or `extension_runtime.dispatch_route()` and inspect only public results and durable state.

### CI placement

Run this file in both Python versions and the Pydantic-1 job. It is small enough to remain in `make check-fast`; do not put it only behind the browser gate.

## P1.2 - Audit the install payload, not the whole development tree

### Current behavior

`install_extension()` calls `_audit_tree(origin)` before `copytree()` applies ignore patterns. A local development checkout is therefore rejected for files that will not be installed, including `.git` and ignored build/test directories. The current Directive worktree has more than 367,000 visible files; its tracked extension payload is 144 files and about 5.96 MiB.

The security limits are appropriate:

- no symlinks;
- at most 4,096 members;
- at most 256 MiB extracted size;
- containment under the selected source root.

The recommended change is to preserve those limits but apply them to the exact file manifest that will be copied.

### Recommended staging model

For a Git checkout, use Git's own file manifest:

```bash
git -C <source> ls-files -z --cached --others --exclude-standard
```

This includes tracked files plus non-ignored development files, excludes `.git` and ignored `node_modules`/artifacts, and gives the installer a deterministic list to audit and copy. For a non-Git directory, retain the strict recursive walk.

### Recommended `extension_runtime/__init__.py` patch shape

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class TreeAudit:
    files: tuple[Path, ...]
    count: int
    bytes: int


def _git_source_files(root: Path):
    try:
        output = _git(
            "-C", str(root), "ls-files", "-z",
            "--cached", "--others", "--exclude-standard")
    except ExtensionError:
        return None
    return [root / item for item in output.split("\0") if item]


def _audit_files(root: Path, files) -> TreeAudit:
    base = root.resolve()
    accepted = []
    total = 0

    for path in files:
        relative = path.relative_to(root)
        if path.is_symlink():
            raise ExtensionError(
                f"extension source contains a symlink: {relative}")
        if not path.is_file():
            continue
        resolved = path.resolve()
        if resolved != base and base not in resolved.parents:
            raise ExtensionError(
                f"path escapes the extension directory: {relative}")

        accepted.append(relative)
        total += path.stat().st_size
        if len(accepted) > MAX_ARCHIVE_MEMBERS:
            raise ExtensionError(
                "extension payload exceeds the file limit: "
                f"{len(accepted)} > {MAX_ARCHIVE_MEMBERS}")
        if total > MAX_EXTRACTED_BYTES:
            raise ExtensionError(
                "extension payload exceeds the size limit: "
                f"{total} bytes > {MAX_EXTRACTED_BYTES} bytes")

    return TreeAudit(tuple(accepted), len(accepted), total)


def _source_manifest(root: Path) -> TreeAudit:
    files = _git_source_files(root)
    if files is None:
        files = root.rglob("*")
    return _audit_files(root, files)


def _copy_manifest(root: Path, staged: Path, audit: TreeAudit):
    for relative in audit.files:
        source = root / relative
        target = staged / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
```

Then use the same audited manifest for local folders and cloned repositories:

```diff
 if kind == "git":
     checkout = Path(tmp) / "checkout"
     origin_url, origin_ref, commit = _git_clone(source, checkout)
-    _audit_tree(checkout)
-    shutil.copytree(checkout, staged, symlinks=False,
-                    ignore=shutil.ignore_patterns(
-                        ".git", "__pycache__", "*.pyc"))
+    audit = _source_manifest(checkout)
+    staged.mkdir()
+    _copy_manifest(checkout, staged, audit)
 # ...
 else:
     origin = Path(source).expanduser()
     if not origin.is_dir():
         raise ExtensionError(f"not a directory: {source}")
-    _audit_tree(origin)
-    shutil.copytree(origin, staged, dirs_exist_ok=True,
-                    symlinks=False, ignore=shutil.ignore_patterns(
-                        "__pycache__", "*.pyc", ".git"))
+    audit = _source_manifest(origin)
+    _copy_manifest(origin, staged, audit)
```

### Security and behavior requirements

- Reject Git mode `120000` symlinks even on platforms where checkout behavior differs. `git ls-files --stage` can provide the mode if `Path.is_symlink()` is insufficient.
- Never execute or import source files while auditing.
- Use the same manifest for audit and copy; otherwise a time-of-check/time-of-use mismatch remains.
- Consider opening source files with no-follow semantics on platforms that support it if local hostile writers are in scope.
- Include observed and allowed counts/bytes in errors.
- Return audit metadata (`file_count`, `extracted_bytes`) in the successful install record for diagnostics.
- Do not silently add general ignore names such as `node_modules` outside Git. A plain directory is already an explicit package; if it contains 100,000 files, the strict limit should apply.

### Required installer tests

```python
def test_git_worktree_installs_only_tracked_and_nonignored_files(...):
    # tracked manifest + ignored node_modules + nonignored local UI file
    # assert tracked/nonignored files install and ignored tree does not


def test_git_symlink_is_rejected_before_copy(...):
    # assert both filesystem symlink and Git mode 120000 are rejected


def test_audit_error_reports_observed_and_allowed_counts(...):
    # 4,097 selected files -> message contains 4097 and 4096


def test_non_git_folder_remains_strict(...):
    # ignored-looking directory names are still counted in a plain package
```

An alternative with a smaller runtime change is to keep local-folder installation strict and ship a documented `sonder extension pack <path>` command that emits a clean zip from `git ls-files`. Either approach is acceptable. The important invariant is that the audited set and copied set are identical.

## P1.3 - Update Directive's reorganized test imports without adding production coupling

This item is Directive-owned. Sonder should not add top-level compatibility shims such as `db.py`, `checkpoints.py`, or `app.py`; doing so would turn former internals into an accidental public API.

The exact Directive test-only update is:

```diff
--- a/tests/integration/test_atomic_provisioning.py
+++ b/tests/integration/test_atomic_provisioning.py
@@
-    import db
+    from core import db
@@
-    from db import set_setting
+    from core.db import set_setting
@@
-    from checkpoints import ensure_checkpoint, restore_checkpoint
-    from db import wset
-    import app
+    from persist.checkpoints import ensure_checkpoint, restore_checkpoint
+    from core.db import wset
+    from web import app
```

After this change, the focused file should advance past the six setup errors caused by `ModuleNotFoundError: No module named 'db'`.

For dual support during a short transition, Directive may use a test-only resolver:

```python
try:
    from core import db
    from core.db import set_setting, wset
    from persist.checkpoints import ensure_checkpoint, restore_checkpoint
    from web import app
except ImportError:  # alpha 9.5 test harness only; remove after cutover
    import db
    from db import set_setting, wset
    from checkpoints import ensure_checkpoint, restore_checkpoint
    import app
```

Do not ship this fallback in Directive production code. Production already uses `SonderExtensionAPI`, which is the desired reorganization boundary.

## Recommended implementation order

1. Fix the Python 3.11 f-string, Pydantic field introspection, and float32 fixtures.
2. Make Pydantic-1 and browser jobs report even when `fast` fails.
3. Add the frame-bound extension facade and explicit frame support in story/player views.
4. Add the route-level extension contract fixture, including mixed-frame proof.
5. Refactor install audit/copy to use one selected file manifest.
6. Update Directive's test-only imports and projection to use `api.at_frame()`.
7. Run the full Sonder matrix, then Directive's focused and full acceptance gates.

## Completion criteria

The P0/P1 work is complete when all of the following are true:

- Python 3.11 and 3.12 compile and run the complete Sonder suite.
- Pydantic 1.x and browser jobs execute and report their own results even if another job fails.
- `_LIST_DELEGATED` contains every list-shaped `StateDiff` channel under both Pydantic majors.
- Lore vector tests write exactly the dtype and dimensions their assertions claim.
- A real extension route can build a player projection whose scene, clock, frame state, and character state all share one selected frame.
- Explicit present/future selection and foreign-chat frame rejection are tested.
- Checkpoint, branch, and archive tests preserve frame-scoped extension and character domains.
- A Git development worktree installs only the selected payload and remains subject to symlink, containment, member-count, and byte limits.
- Directive's production extension imports no Sonder internals.
- Directive's test harness uses the reorganized host imports or a clearly temporary test-only compatibility resolver.

## Source index

- [Extension public API at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/extension_runtime/api.py)
- [Extension runtime, route dispatch, and installer at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/extension_runtime/__init__.py)
- [Story/player view facade at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/web/story_view.py)
- [Frame-aware world storage at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/core/db.py)
- [Frame model at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/core/frames.py)
- [Director specialist registry at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/agents/director_scopes.py)
- [Python 3.11 parser failure at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/agents/director_floors.py)
- [Lore vector implementation at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/mind/memory.py)
- [Lore regression tests at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/tests/test_lore_blind_scoring.py)
- [CI workflow at `52fd9573`](https://github.com/N0819/Sonder_Engine/blob/52fd9573f620c18905839e379612f378f4f621bb/.github/workflows/ci.yml)
- [Failed CI run 32204039378](https://github.com/N0819/Sonder_Engine/actions/runs/32204039378)
