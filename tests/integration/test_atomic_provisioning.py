from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
from dataclasses import dataclass

import pytest

from directive import routes
from directive.campaign.compiler import PlayerSetup, compile_ashes_archive
from directive.campaign.source import load_ashes_source
from directive.state.contracts import PACKAGE_ID, PACKAGE_VERSION


def player_payload():
    return {
        "name": "Sam Vickers",
        "pronouns_or_address": "they/them",
        "species": "Human",
        "age_band": "mid-career",
        "appearance": "A composed officer with close-cropped dark hair.",
        "career_background": "operations-logistics",
        "formative_experience": "dominion-war-fleet-service",
        "assignment_reason": "requested-by-captain",
        "insight_trait": "analytical",
        "connection_trait": "candid",
        "execution_trait": "decisive",
        "flaw": "guarded",
    }


@dataclass
class Request:
    body: object


class RecordingAPI:
    def __init__(self):
        self.routes = {}
        self.provision_calls = []

    def add_route(self, path, fn, *, methods=("GET",)):
        for method in methods:
            self.routes[(method, path)] = fn

    def provision_story(self, archive, **kwargs):
        self.provision_calls.append((archive, kwargs))
        return {"chat_id": 42, "name": "Ashes of Peace", "schema": 2}

    def add_model_lane(self, name, **kwargs):
        return f"ext:directive:{name}"

    def add_stage(self, *args, **kwargs):
        pass

    def add_commit_domain(self, *args, **kwargs):
        pass

    def on_director_result(self, *args, **kwargs):
        pass


def test_start_route_provisions_once_with_every_turn_zero_value():
    api = RecordingAPI()
    routes.register(api)

    result = api.routes[("POST", "/start")](Request(player_payload()))

    assert len(api.provision_calls) == 1
    archive, kwargs = api.provision_calls[0]
    assert archive["chat"]["name"] == "Ashes of Peace"
    assert kwargs["state"]["kind"] == "directive.campaignConfig.v1"
    assert kwargs["frame_state"]["kind"] == "directive.frameState.v1"
    assert kwargs["package_id"] == PACKAGE_ID
    assert kwargs["package_version"] == PACKAGE_VERSION
    assert kwargs["player_authority"] == "actor_only"
    assert set(kwargs["director_context"]) == {"establish", "interpret", "resolve"}
    assert kwargs["narration_context"]
    assert len(kwargs["documents"]) == 18
    assert result == {
        "chat_id": 42,
        "name": "Ashes of Peace",
        "schema": 2,
        "directive": {"package_id": PACKAGE_ID, "package_version": PACKAGE_VERSION},
    }


def test_start_route_accepts_simulation_mode_outside_player_identity():
    api = RecordingAPI()
    routes.register(api)
    body = player_payload()
    body["simulation_mode"] = "Exploration"

    api.routes[("POST", "/start")](Request(body))

    assert api.provision_calls[0][1]["state"]["settings"]["simulation_mode"] == "Exploration"


def test_start_route_refuses_an_invalid_body_before_provisioning():
    api = RecordingAPI()
    routes.register(api)

    with pytest.raises(ValueError, match="player setup"):
        api.routes[("POST", "/start")](Request(None))

    assert api.provision_calls == []


@pytest.fixture
def live_sonder(tmp_path, monkeypatch, repo_root):
    sonder_root = Path(
        os.environ.get("SONDER_ENGINE_ROOT") or repo_root.parent / "Sonder_Engine"
    )
    if not (sonder_root / "extension_runtime" / "api.py").is_file():
        pytest.skip(f"current Sonder checkout not found at {sonder_root}")
    monkeypatch.syspath_prepend(str(sonder_root))
    monkeypatch.chdir(sonder_root)

    import db
    import extension_runtime

    old_db = db.DB
    db.close_connection()
    test_db = tmp_path / "sonder-integration.db"
    db.configure(str(test_db))
    db.init()

    extensions_root = tmp_path / "extensions"
    staged = extensions_root / "directive"
    shutil.copytree(
        repo_root,
        staged,
        ignore=shutil.ignore_patterns(
            ".git", ".pytest_cache", ".tmp", "__pycache__", "tests", "docs"
        ),
    )
    monkeypatch.setenv(extension_runtime.ROOT_ENV, str(extensions_root))
    monkeypatch.delenv(extension_runtime.SAFE_MODE_ENV, raising=False)
    extension_runtime.reload()
    from db import set_setting

    installed = extension_runtime.installed_extensions(refresh=True)
    assert "directive" in installed, extension_runtime.load_errors()
    set_setting(extension_runtime.ENABLED_SETTING, json.dumps(["directive"]))
    extension_runtime.activate(refresh=True)
    assert "directive" in extension_runtime._apis, extension_runtime.load_errors()

    try:
        yield extension_runtime, extension_runtime._apis["directive"], db, test_db
    finally:
        extension_runtime.reload()
        db.close_connection()
        db.configure(old_db)


def test_current_sonder_loads_and_provisions_the_complete_story(live_sonder):
    extension_runtime, api, _db, _path = live_sonder

    result = extension_runtime.dispatch_route(
        "directive", "POST", "/start", body=player_payload()
    )
    chat_id = result["chat_id"]
    view = api.story_view(chat_id)

    assert result["directive"] == {
        "package_id": PACKAGE_ID,
        "package_version": PACKAGE_VERSION,
    }
    assert view["schema"] == 2
    assert view["story"]["name"] == "Ashes of Peace"
    assert view["player"]["name"] == "Sam Vickers"
    assert view["scene"]["location"] == "U.S.S. Breckenridge"
    assert view["player_authority"]["mode"] == "actor_only"
    assert len(view["cast"]) == 7
    assert api.provenance(chat_id)["package"] == PACKAGE_ID
    assert api.provenance(chat_id)["version"] == PACKAGE_VERSION
    assert api.state(chat_id).get()["kind"] == "directive.campaignConfig.v1"
    assert api.frame_state(chat_id).get()["kind"] == "directive.frameState.v1"
    assert api.documents(chat_id).get("package/campaign")["manifest"]["id"] == PACKAGE_ID
    assert api.documents(chat_id).get("player/profile")["name"] == "Sam Vickers"

    projection = extension_runtime.dispatch_route(
        "directive", "GET", "/projection", query={"chat_id": str(chat_id)}
    )
    assert projection["kind"] == "directive.playerProjection.v1"
    assert len(projection["people"]) == 7
    assert {item["directive"]["crew_id"] for item in projection["people"]} == {
        "mara-whitaker", "kieran-vale", "priya-nayar", "hadrik-bronn",
        "rowan-saye", "miriam-sato", "imani-cross",
    }
    assert "narrationGuide" not in repr(projection)
    assert "psychology" not in repr(projection)


def test_current_sonder_rejects_invalid_turn_zero_data_without_a_database_write(
    live_sonder,
):
    extension_runtime, api, db, database_path = live_sonder
    bundle = compile_ashes_archive(
        load_ashes_source(), PlayerSetup.from_dict(player_payload())
    )
    kwargs = bundle.provision_kwargs()
    kwargs["documents"]["../escape"] = {"must": "fail before import"}

    db.q("PRAGMA wal_checkpoint(FULL)")
    before = hashlib.sha256(database_path.read_bytes()).digest()
    with pytest.raises(extension_runtime.ExtensionError, match="document path"):
        api.provision_story(bundle.archive, **kwargs)
    after = hashlib.sha256(database_path.read_bytes()).digest()

    assert after == before
    assert db.q("SELECT COUNT(*) AS count FROM chats", one=True)["count"] == 0


def test_current_sonder_commit_domain_advances_exactly_the_bound_turn(
    live_sonder,
):
    extension_runtime, api, _db, _path = live_sonder
    result = extension_runtime.dispatch_route(
        "directive", "POST", "/start", body=player_payload()
    )
    chat_id = result["chat_id"]
    frame = api.frame_state(chat_id).get()
    resolve = {
        "resolved_event": "Whitaker and Vickers settle the command handover terms.",
        "state_diff": {},
    }
    from directive.settlement.service import PROPOSAL_KIND, _hash

    source_hash = _hash(resolve)
    proposal = {
        "kind": PROPOSAL_KIND,
        "rejected": [],
        "claims": [{
            "claimId": "claim.integration-handover",
            "policyId": "policy.prelude.command-handover-terms-settled",
            "claimType": "eventOccurred",
            "targetId": "event.prelude.command-handover-terms-settled",
            "evidenceKey": (
                f"{frame['mission']['branchId']}|701|{source_hash}|"
                "eventOccurred|event.prelude.command-handover-terms-settled"
            ),
            "sourceTurnId": "701",
            "sourceHash": source_hash,
            "sourceRole": "adjudicator",
        }],
    }

    class Value:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    class Context:
        chat = Value(id=chat_id)
        turn = Value(id=701, idx=1, frame_id=None)
        warnings = []
        def get(self, key, default=None):
            return {
                "director_resolve": resolve,
                "ext:directive:settlement": proposal,
            }.get(key, default)
        def add_warning(self, message):
            self.warnings.append(message)

    results = {}
    extension_runtime.run_commit_domains(Context(), results)

    committed = api.frame_state(chat_id).get()
    assert committed["mission"]["revision"] == 1
    assert "event.prelude.command-handover-terms-settled" in committed["mission"]["events"]
    assert results["ext:directive:settlement"]["applied"] == 1


def test_current_sonder_serves_the_directive_module_graph_and_lcars_styles(live_sonder):
    extension_runtime, _api, _db, _path = live_sonder

    script = extension_runtime.extension_script("directive")
    styles = extension_runtime.extension_styles("directive")
    app_module = extension_runtime.asset_path("directive", "ui/app.js").read_text(
        encoding="utf-8"
    )

    assert 'Sonder._loadModule("directive"' in script
    assert "createDirectiveView" in app_module
    assert "@media (max-width: 720px)" in styles
    assert "prefers-reduced-motion" in styles


def test_current_sonder_checkpoint_branch_and_archive_carry_directive_state(live_sonder):
    extension_runtime, api, db, _path = live_sonder
    from checkpoints import ensure_checkpoint, restore_checkpoint
    from db import wset
    import app

    made = extension_runtime.dispatch_route(
        "directive", "POST", "/start", body=player_payload()
    )
    chat_id = made["chat_id"]
    expected_state = api.state(chat_id).get()
    expected_frame = api.frame_state(chat_id).get()
    expected_campaign = api.documents(chat_id).get("package/campaign")

    ensure_checkpoint(chat_id, 0)
    changed = json.loads(json.dumps(expected_frame))
    changed["settlement"] = {"status": "must-be-rewound"}
    wset(chat_id, "extf:directive", changed)
    assert api.frame_state(chat_id).get()["settlement"]["status"] == "must-be-rewound"

    restore_checkpoint(chat_id, 0)
    assert api.frame_state(chat_id).get() == expected_frame

    turn_id = db.qi(
        "INSERT INTO turns(chat_id,idx,player_input,created,frame_id) VALUES(?,?,?,?,?)",
        (chat_id, 0, "Branch boundary", 1.0, None),
    )
    branched = app.turn_branch(turn_id)
    branch_id = branched["id"]
    assert api.state(branch_id).get() == expected_state
    assert api.frame_state(branch_id).get() == expected_frame
    assert api.documents(branch_id).get("package/campaign") == expected_campaign

    imported = app.chat_import({"data": app.chat_export(chat_id)})
    imported_id = imported["id"]
    assert api.state(imported_id).get() == expected_state
    assert api.frame_state(imported_id).get() == expected_frame
    assert api.documents(imported_id).get("package/campaign") == expected_campaign
    provenance = api.provenance(imported_id)
    assert provenance["package"] == PACKAGE_ID
    assert provenance["version"] == PACKAGE_VERSION
    assert provenance["extension"] == "directive"


def test_current_sonder_marks_surviving_player_dialogue_fatal_before_commit(live_sonder):
    extension_runtime, api, _db, _path = live_sonder
    made = extension_runtime.dispatch_route(
        "directive", "POST", "/start", body=player_payload()
    )
    chat_id = made["chat_id"]
    before = api.frame_state(chat_id).get()

    class Value:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    class Context:
        chat = Value(id=chat_id)
        turn = Value(id=900, idx=1, frame_id=None)
        warnings = []

    violations, fatal = extension_runtime.validate_director_result(
        Context(),
        {
            "resolved_event": "Whitaker waits for the commander's answer.",
            "state_diff": {},
            "dialogue_log": [{"speaker": "Sam Vickers", "exact_quote": "I agree."}],
        },
    )

    assert fatal is True
    assert violations[0]["extension"] == "directive"
    assert violations[0]["code"] == "invented-player-dialogue"
    assert api.frame_state(chat_id).get() == before
