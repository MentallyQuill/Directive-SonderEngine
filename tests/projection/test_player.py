from __future__ import annotations

from directive.campaign.compiler import PlayerSetup, compile_ashes_archive
from directive.campaign.source import load_ashes_source
from directive.projection.player import create_player_projection


def frame():
    player = PlayerSetup.from_dict({
        "name": "Sam Vickers", "pronouns_or_address": "they/them", "species": "Human",
        "age_band": "mid-career", "appearance": "Close-cropped dark hair.",
        "career_background": "operations-logistics", "formative_experience": "fleet-service",
        "assignment_reason": "requested-by-captain", "insight_trait": "analytical",
        "connection_trait": "candid", "execution_trait": "decisive", "flaw": "guarded",
    })
    return compile_ashes_archive(load_ashes_source(), player).frame_state


class Store:
    def __init__(self, value):
        self.value = value
    def get(self):
        return self.value


class API:
    def __init__(self):
        self._frame = Store(frame())
        self.states = {
            11: Store({
                "kind": "directive.crewDomain.v1", "schema": 1,
                "crew_id": "mara-whitaker", "rank": "Captain",
                "role": "Commanding Officer", "department": "command",
                "public_record": {"birthplace": "Kingston, Ontario, Earth"},
            })
        }

    def frame_state(self, chat_id):
        return self._frame

    def player_view(self, chat_id, viewer):
        return {
            "schema": 2,
            "viewer": {"id": "player", "name": "Sam Vickers", "kind": "player"},
            "story": {"chat_id": chat_id},
            "clock": {"elapsed_seconds": 0},
            "location": {"room_id": "threshold", "name": "Ready Room Threshold"},
            "people": [
                {"id": "11", "kind": "character", "display_name": "Mara Whitaker", "identity_status": "recognized", "facts": {"public_history": "Captain Whitaker commands the Breckenridge."}},
                {"id": "body:unknown-1", "kind": "presence", "display_name": "an unfamiliar ensign", "identity_status": "observed"},
            ],
        }

    def char_state(self, chat_id, char_id):
        return self.states.get(char_id, Store({}))


def test_projection_joins_directive_crew_only_by_stable_recognized_host_id():
    projection = create_player_projection(API(), 9)
    mara, stranger = projection["people"]

    assert mara["id"] == "11"
    assert mara["directive"] == {
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
        "public_record": {"birthplace": "Kingston, Ontario, Earth"},
    }
    assert stranger == {
        "id": "body:unknown-1",
        "kind": "presence",
        "display_name": "an unfamiliar ensign",
        "identity_status": "observed",
    }


def test_projection_omits_hidden_objectives_and_private_state_roots():
    projection = create_player_projection(API(), 9)

    assert all(item["visibility"] != "hidden" for item in projection["mission"]["objectives"])
    rendered = repr(projection)
    for forbidden in ("evidenceLog", "worldFacts", "acceptedEvidenceKeys", "psychology", "private_history"):
        assert forbidden not in rendered
    assert projection["time"]["clock_display"] == "08:30:00"
    assert projection["command_bearing"]["balance"] == 0
    assert projection["ship"]["cohesion"]["total"] == 75
    assert projection["ship"]["cohesion"]["band"]["id"] == "ready"
    assert len(projection["ship"]["cohesion"]["issues"]) == 2
    assert "narratorGuidance" not in rendered
    assert "interpretation" not in rendered


def test_absent_directive_crew_values_remain_absent():
    projection = create_player_projection(API(), 9)
    directive = projection["people"][0]["directive"]
    assert "assignment" not in directive
    assert "duty_status" not in directive
