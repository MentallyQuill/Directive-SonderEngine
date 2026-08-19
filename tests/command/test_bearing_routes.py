from __future__ import annotations

import copy
from dataclasses import dataclass

from directive import routes
from directive.command.bearing import award, create_bearing, project_bearing
from directive.command.service import commit_pending_edge


class Store:
    def __init__(self, value):
        self.value = value

    def get(self):
        return copy.deepcopy(self.value)

    def set_now(self, value):
        self.value = copy.deepcopy(value)


class Documents:
    def __init__(self):
        self.values = {}

    def get(self, path):
        return copy.deepcopy(self.values.get(path))

    def put_now(self, path, value):
        self.values[path] = copy.deepcopy(value)

    def delete_now(self, path):
        return self.values.pop(path, None) is not None


class Block:
    def __init__(self, phases=False):
        self.phases = phases
        self.value = {"resolve": {"text": "Base resolve context."}} if phases else {"text": "Base narration context."}

    @property
    def text(self):
        return str((self.value or {}).get("text") or "")

    def get(self, phase=None):
        if phase is None:
            return copy.deepcopy(self.value)
        return copy.deepcopy((self.value or {}).get(phase))

    def set(self, value=None, **kwargs):
        if self.phases:
            for phase, text in {**(value or {}), **kwargs}.items():
                self.value[phase] = {"text": text}
        else:
            self.value = {"text": value}

    def clear(self):
        self.value = {} if self.phases else None


class API:
    def __init__(self):
        bearing = award(
            create_bearing(), award_id="award.1", source_id="objective.1",
            reason="Earned through command.", now="2026-08-18T00:00:00+00:00",
        ).value
        self.frame = Store({"command": {"bearing": bearing}})
        self.frame.value.update({
            "mission": {"branchId": "frame.root"},
            "ship": {"effects": []},
        })
        self.docs = Documents()
        self.director = Block(phases=True)
        self.narration = Block()
        self.routes = {}
        self.director_payload_hooks = []
        self.current_turn_id = None
        self.chats = self

    def add_route(self, path, fn, *, methods=("GET",)):
        for method in methods:
            self.routes[(method, path)] = fn

    def frame_state(self, chat_id):
        return self.frame

    def documents(self, chat_id):
        return self.docs

    def director_context(self, chat_id):
        return self.director

    def narration_context(self, chat_id):
        return self.narration

    def provenance(self, chat_id):
        from directive.state.contracts import PACKAGE_ID, PACKAGE_VERSION
        return {"package": PACKAGE_ID, "version": PACKAGE_VERSION, "extension": "directive"}

    def add_model_lane(self, *args, **kwargs):
        return "ext:directive:test"

    def add_stage(self, *args, **kwargs):
        pass

    def add_commit_domain(self, *args, **kwargs):
        pass

    def on_director_result(self, *args, **kwargs):
        pass

    def on_director_payload(self, fn):
        self.director_payload_hooks.append(fn)

    def turns(self, chat_id, limit=20):
        return [] if self.current_turn_id is None else [{"turn_id": self.current_turn_id}]


@dataclass
class Request:
    chat_id: int
    body: object = None


def test_reserve_waits_for_a_real_generation_boundary_without_mutating_durable_state():
    api = API()
    routes.register(api)

    reserved = api.routes[("POST", "/command-bearing/edge")](Request(7))

    assert reserved["applied"] is True
    assert reserved["command_bearing"]["balance"] == 0
    assert reserved["command_bearing"]["pending_edge"]["status"] == "reserved"
    assert "COMMAND BEARING" not in api.director.get("resolve")["text"]
    assert "COMMAND BEARING" not in api.narration.text

    info = type("Info", (), {"chat_id": 7, "turn_id": 88, "phase": "establish"})()
    payload = api.director_payload_hooks[0]({"scene": {}}, info)

    assert payload["extension_context"][-1]["text"].startswith("COMMAND BEARING")
    assert project_bearing(api.frame.get()["command"]["bearing"])["pending_edge"]["status"] == "reserved"
    assert "COMMAND BEARING" not in api.director.get("resolve")["text"]
    assert "COMMAND BEARING" not in api.narration.text

    cancelled = api.routes[("DELETE", "/command-bearing/edge")](Request(7))

    assert cancelled["applied"] is True
    assert cancelled["command_bearing"]["balance"] == 1
    assert cancelled["command_bearing"]["pending_edge"] is None
    assert api.director.get("resolve")["text"] == "Base resolve context."
    assert api.narration.text == "Base narration context."
    assert api.docs.get("command/bearing-context") is None


def test_pending_edge_commits_atomically_on_the_next_durable_turn():
    api = API()
    routes.register(api)
    api.routes[("POST", "/command-bearing/edge")](Request(7))
    info = type("Info", (), {"chat_id": 7, "turn_id": 88, "phase": "establish"})()
    api.director_payload_hooks[0]({}, info)

    frame, applied = commit_pending_edge(
        api, 7, api.frame.get(), turn_id=88, source_hash="sha256:accepted",
    )

    assert applied is True
    projection = project_bearing(frame["command"]["bearing"])
    assert projection["pending_edge"] is None
    assert projection["latest_spend"]["status"] == "committed"
    assert api.director.get("resolve")["text"] == "Base resolve context."
    assert api.narration.text == "Base narration context."


def test_reservation_during_an_inflight_turn_cannot_affect_that_turn():
    api = API()
    api.current_turn_id = 88
    routes.register(api)
    api.routes[("POST", "/command-bearing/edge")](Request(7))
    hook = api.director_payload_hooks[0]

    current = hook(
        {"scene": {}},
        type("Info", (), {"chat_id": 7, "turn_id": 88, "phase": "resolve"})(),
    )
    assert "extension_context" not in current
    assert project_bearing(api.frame.get()["command"]["bearing"])["pending_edge"]["status"] == "reserved"

    following = hook(
        {"scene": {}},
        type("Info", (), {"chat_id": 7, "turn_id": 89, "phase": "establish"})(),
    )
    assert "COMMAND BEARING" in following["extension_context"][-1]["text"]
    _, bound_turn = commit_pending_edge(
        api, 7, api.frame.get(), turn_id=89, source_hash="sha256:accepted",
    )
    assert bound_turn is True


def test_commit_domain_can_finish_a_reserved_spend_after_a_later_stage_resume():
    api = API()
    api.current_turn_id = 88
    routes.register(api)
    api.routes[("POST", "/command-bearing/edge")](Request(7))

    # A resumed turn may reuse a previously generated Director result without
    # rerunning the total payload hook. The commit-domain transition remains
    # authoritative and atomic with the accepted turn.
    frame, applied = commit_pending_edge(
        api, 7, api.frame.get(), turn_id=89, source_hash="sha256:resumed",
    )

    assert applied is True
    assert project_bearing(frame["command"]["bearing"])["latest_spend"]["status"] == "committed"


def test_ship_cohesion_relief_validates_the_target_and_resolves_only_that_issue():
    api = API()
    routes.register(api)

    rejected = api.routes[("POST", "/command-bearing/cohesion")](
        Request(7, {"issue_id": "not-visible"})
    )
    assert rejected["applied"] is False
    assert rejected["reason_code"] == "cohesion-target-unavailable"

    reserved = api.routes[("POST", "/command-bearing/cohesion")](
        Request(7, {"issue_id": "cohesion-authored.sensor-calibration"})
    )
    assert reserved["applied"] is True
    assert reserved["target_issue_id"] == "cohesion-authored.sensor-calibration"
    assert reserved["command_bearing"]["pending_cohesion_relief"]["status"] == "reserved"

    hook = api.director_payload_hooks[0]
    payload = hook(
        {"scene": {}},
        type("Info", (), {"chat_id": 7, "turn_id": 91, "phase": "establish"})(),
    )
    assert "COHESION RELIEF" in payload["extension_context"][-1]["text"]
    frame, applied = commit_pending_edge(
        api, 7, api.frame.get(), turn_id=91, source_hash="sha256:relief",
    )
    assert applied is True
    effects = frame["ship"]["effects"]
    assert effects[-1]["targetIssueId"] == "cohesion-authored.sensor-calibration"
    assert effects[-1]["method"] == "command-bearing"
