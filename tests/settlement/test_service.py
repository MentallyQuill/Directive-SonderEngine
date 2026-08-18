from __future__ import annotations

import copy

from directive.campaign.compiler import PlayerSetup, compile_ashes_archive
from directive.campaign.source import load_ashes_source
from directive.settlement.service import (
    commit_settlement,
    interpret_settlement,
    player_authority_violation,
    register,
)


def player():
    return PlayerSetup.from_dict({
        "name": "Sam Vickers", "pronouns_or_address": "they/them", "species": "Human",
        "age_band": "mid-career", "appearance": "Close-cropped dark hair.",
        "career_background": "operations-logistics", "formative_experience": "fleet-service",
        "assignment_reason": "requested-by-captain", "insight_trait": "analytical",
        "connection_trait": "candid", "execution_trait": "decisive", "flaw": "guarded",
    })


class Store:
    def __init__(self, value):
        self.value = copy.deepcopy(value)

    def get(self):
        return copy.deepcopy(self.value)

    def set(self, value):
        self.value = copy.deepcopy(value)
        return copy.deepcopy(value)


class API:
    def __init__(self, frame):
        self.frame = Store(frame)
        self.calls = []

    def add_model_lane(self, *args, **kwargs):
        self.calls.append(("lane", args, kwargs))
        return "ext:directive:settlement"

    def add_stage(self, *args, **kwargs):
        self.calls.append(("stage", args, kwargs))

    def add_commit_domain(self, *args, **kwargs):
        self.calls.append(("domain", args, kwargs))

    def on_director_result(self, *args, **kwargs):
        self.calls.append(("validator", args, kwargs))

    def frame_state(self, chat_id):
        return self.frame

    def story_view(self, chat_id):
        return {
            "player": {"name": "Sam Vickers"},
            "clock": {"elapsed_seconds": 60},
        }

    def llm_json(self, system, payload, **kwargs):
        self.last_payload = payload
        return {"claims": [{
            "policyId": "policy.prelude.command-handover-terms-settled",
            "claimType": "eventOccurred",
            "targetId": "event.prelude.command-handover-terms-settled",
        }]}

    def correction(self, code, message, evidence=None):
        return {"code": code, "message": message, "evidence": evidence}


class StepView:
    chat_id = 4
    turn_id = 7
    turn_idx = 1

    resolve = {"resolved_event": "Whitaker and Vickers settle the handover terms.", "state_diff": {}}
    resolved_event = resolve["resolved_event"]
    state_diff = {}


class CommitView:
    chat_id = 4
    turn_id = 7
    turn_idx = 1

    def __init__(self, frame, settlement):
        self.frame_state = Store(frame)
        self._values = {
            "director_resolve": StepView.resolve,
            "ext:directive:settlement": settlement,
        }

    def step_content(self, key):
        return self._values.get(key)


def initial_frame():
    return compile_ashes_archive(load_ashes_source(), player()).frame_state


def test_registration_uses_one_lane_one_stage_and_fail_closed_host_seams():
    api = API(initial_frame())
    register(api)

    assert [item[0] for item in api.calls] == ["lane", "stage", "domain", "validator"]
    assert next(item for item in api.calls if item[0] == "stage")[2]["anchor"] == "after:director_resolve"
    assert next(item for item in api.calls if item[0] == "domain")[2]["on_error"] == "fail"
    assert next(item for item in api.calls if item[0] == "validator")[2]["on_error"] == "fail"


def test_stage_exposes_only_closed_authored_candidates_and_binds_host_source():
    api = API(initial_frame())
    output = interpret_settlement(StepView(), api, "ext:directive:settlement")

    assert output["kind"] == "directive.settlementProposal.v1"
    assert len(output["claims"]) == 1
    claim = output["claims"][0]
    assert claim["sourceTurnId"] == "7"
    assert claim["sourceHash"].startswith("sha256:")
    assert claim["evidenceKey"].startswith("frame.root|7|")
    assert {item["policyId"] for item in api.last_payload["candidates"]}
    assert "documents" not in api.last_payload


def test_commit_domain_revalidates_exact_source_and_writes_only_frame_state():
    api = API(initial_frame())
    proposal = interpret_settlement(StepView(), api, "ext:directive:settlement")
    view = CommitView(initial_frame(), proposal)

    result = commit_settlement(view, api)

    assert result["applied"] == 1
    mission = view.frame_state.value["mission"]
    assert mission["revision"] == 1
    assert "event.prelude.command-handover-terms-settled" in mission["events"]
    assert view.frame_state.value["time"]["ledger"]["elapsed_seconds"] == 60


def test_malformed_model_output_becomes_no_proposal_and_never_mutates_frame():
    api = API(initial_frame())
    api.llm_json = lambda *args, **kwargs: {"claims": [{"policyId": "invented"}]}
    output = interpret_settlement(StepView(), api, "ext:directive:settlement")

    assert output["claims"] == []
    assert output["rejected"]


def test_directive_rejects_any_surviving_player_dialogue_after_host_floors():
    api = API(initial_frame())

    class Result:
        resolve = {"dialogue_log": [{"speaker": "Sam Vickers", "exact_quote": "I agree."}]}
        def story_view(self):
            return api.story_view(4)

    correction = player_authority_violation(Result(), api)
    assert correction["code"] == "invented-player-dialogue"
    assert correction["evidence"]["speaker"] == "Sam Vickers"
