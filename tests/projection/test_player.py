from __future__ import annotations

import json

from directive.campaign.compiler import PlayerSetup, compile_ashes_archive
from directive.campaign.source import load_ashes_source
from directive.projection.player import _mission_projection, _player_profile, create_player_projection
from directive.state.contracts import PACKAGE_ID, PACKAGE_VERSION


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


class Documents:
    def __init__(self, values):
        self.values = values

    def get(self, key):
        return self.values.get(key)


class API:
    def __init__(self):
        self._frame = Store(frame())
        self._state = Store({"settings": {"simulation_mode": "Command"}})
        self.states = {
            11: Store({
                "kind": "directive.crewProfile.v2", "schema": 2,
                "binding": {
                    "kind": "directive.packageActorBinding.v1",
                    "package_id": PACKAGE_ID,
                    "package_version": PACKAGE_VERSION,
                    "actor_ref": "mara-whitaker",
                },
                "rank": "Captain",
                "role": "Commanding Officer", "department": "command",
                "public_record": {"birthplace": "Kingston, Ontario, Earth"},
            })
        }
        self._documents = Documents({
            "player/profile": {
                "name": "Sam Vickers",
                "pronouns_or_address": "they/them",
                "species": "Human",
                "age_band": "mid-career",
                "appearance": "Close-cropped dark hair.",
                "career_background": "operations-logistics",
                "formative_experience": "fleet-service",
                "assignment_reason": "requested-by-captain",
                "insight_trait": "analytical",
                "connection_trait": "candid",
                "execution_trait": "decisive",
                "flaw": "guarded",
            },
            "timeline/saves": {
                "kind": "directive.timelineRegistry.v1",
                "schema": 1,
                "saved_games": [{
                    "id": "save-42",
                    "chat_id": 42,
                    "name": "Before the briefing",
                    "createdAt": "2026-08-18T12:34:56.000Z",
                    "chapter": "Prelude: A Ship Underway",
                    "stardate": 53068.4,
                }],
            },
        })

    def frame_state(self, chat_id):
        return self._frame

    def state(self, chat_id):
        return self._state

    def player_view(self, chat_id, viewer):
        return {
            "schema": 3,
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

    def documents(self, chat_id):
        return self._documents


def test_projection_joins_directive_crew_only_by_stable_recognized_host_id():
    projection = create_player_projection(API(), 9)
    mara, stranger = projection["people"]

    assert mara["id"] == "11"
    assert mara["directive"] == {
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
        "public_record": {"birthplace": "Kingston, Ontario, Earth"},
        "species": "Human",
        "service": {
            "organization": "starfleet",
            "department": "command",
            "rankCode": "captain",
            "rankLabel": "Captain",
        },
        "media": {
            "kind": "crew.portrait.formal",
            "alt": "Captain Mara Whitaker",
            "variants": {
                "detail": "/api/extensions/directive/asset/assets/packages/breckenridge/images/crew/mara-whitaker.detail.webp",
                "card": "/api/extensions/directive/asset/assets/packages/breckenridge/images/crew/mara-whitaker.card.webp",
                "thumb": "/api/extensions/directive/asset/assets/packages/breckenridge/images/crew/mara-whitaker.thumb.webp",
            },
        },
    }
    assert stranger == {
        "id": "body:unknown-1",
        "kind": "presence",
        "display_name": "an unfamiliar ensign",
        "identity_status": "observed",
    }


def test_projection_never_exposes_portable_package_identity_material():
    projection = create_player_projection(API(), 9)
    rendered = json.dumps(projection)

    for forbidden in (
        "crew_id",
        "actor_ref",
        PACKAGE_ID,
        PACKAGE_VERSION,
        "directive-crew-mara-whitaker",
    ):
        assert forbidden not in rendered


def test_projection_exposes_only_public_player_profile_fields_and_authored_role():
    projection = create_player_projection(API(), 9)

    assert projection["player"] == {
        "id": "player",
        "name": "Sam Vickers",
        "pronouns_or_address": "they/them",
        "species": "Human",
        "age_band": "mid-career",
        "appearance": "Close-cropped dark hair.",
        "service": {
            "organization": "starfleet",
            "department": "command",
            "rank_code": "commander",
            "rank_label": "Commander",
        },
        "billet": "Executive Officer",
        "role": "Principal mission commander and coordinator of shipboard operations.",
    }


def test_projection_orders_recognized_crew_by_the_authored_directive_roster():
    api = API()
    api.states[12] = Store({
        "kind": "directive.crewProfile.v2", "schema": 2,
        "binding": {
            "kind": "directive.packageActorBinding.v1",
            "package_id": PACKAGE_ID,
            "package_version": PACKAGE_VERSION,
            "actor_ref": "kieran-vale",
        },
        "rank": "Lieutenant", "role": "Flight Control Officer", "department": "flight",
    })
    original = api.player_view
    api.player_view = lambda chat_id, viewer: {
        **original(chat_id, viewer),
        "people": [
            {"id": "12", "kind": "character", "display_name": "Kieran Vale", "identity_status": "recognized"},
            {"id": "11", "kind": "character", "display_name": "Mara Whitaker", "identity_status": "recognized"},
        ],
    }

    projection = create_player_projection(api, 9)

    assert [person["display_name"] for person in projection["people"]] == ["Mara Whitaker", "Kieran Vale"]
    rendered = json.dumps(projection)
    for forbidden in (
        "operations-logistics",
        "fleet-service",
        "requested-by-captain",
        "analytical",
        "candid",
        "decisive",
        "guarded",
    ):
        assert forbidden not in rendered


def test_player_projection_omits_an_unavailable_name_instead_of_inventing_commander():
    api = API()
    api.documents(9).values.pop("player/profile", None)
    player = _player_profile(api, 9, {"viewer": {"id": "player"}}, load_ashes_source())

    assert "name" not in player
    assert player["service"]["rank_label"] == "Commander"


def test_projection_exposes_only_valid_saved_game_registry_records():
    projection = create_player_projection(API(), 9)

    assert projection["saved_games"] == [{
        "id": "save-42",
        "chat_id": 42,
        "name": "Before the briefing",
        "createdAt": "2026-08-18T12:34:56.000Z",
        "chapter": "Prelude: A Ship Underway",
        "stardate": 53068.4,
    }]


def test_projection_reads_v1_state_without_restoring_crew_identity_to_the_dto():
    api = API()
    api.states[11] = Store({
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    })

    directive = create_player_projection(api, 9)["people"][0]["directive"]

    assert directive["rank"] == "Captain"
    assert directive["media"]["variants"]["thumb"].endswith(
        "mara-whitaker.thumb.webp"
    )
    assert "crew_id" not in directive


def test_projection_omits_hidden_objectives_and_private_state_roots():
    projection = create_player_projection(API(), 9)

    assert projection["mission"]["title"] == "Prelude: A Ship Underway"
    assert projection["mission"]["summary"] == "Complete the command handover, establish a working command rhythm, and bring the Breckenridge to the Asterion Reach."
    assert projection["ship"]["name"] == "U.S.S. Breckenridge"
    assert projection["ship"]["class_name"] == "Intrepid-class"
    assert projection["ship"]["registry"] == "NCC-74656"
    assert projection["campaign"]["summary"] == (
        "The war is over, but peace in the Asterion Reach depends on who controls "
        "Starfleet's voice, who receives relief, and whose evidence survives. The "
        "newly refit U.S.S. Breckenridge enters that fracture with an incoming "
        "executive officer and a command team still learning how to trust one another."
    )
    assert projection["media"]["ship"]["variants"]["cohesion"] == "/api/extensions/directive/asset/assets/packages/breckenridge/images/ship/uss-breckenridge.cohesion.png"
    assert projection["media"]["ship"]["scene"]["layers"]["foreground"].endswith("uss-breckenridge.hero-ship.webp")
    assert projection["media"]["ship"]["scene"]["emissive"]["windows"].endswith("uss-breckenridge.hero-windows.png")
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


def test_mission_projection_preserves_player_safe_objective_class_facts_and_support():
    source = load_ashes_source()
    definition = next(item for item in source.missions if item["id"] == "mission.chapter-2-false-colors")
    optional = next(item for item in definition["objectives"] if item.get("activatedAs") == "optional")
    known_fact = next(item for item in definition["facts"] if item.get("visibility") != "hidden")
    capability = definition["entryCapabilities"][0]
    state = {
        "definitionId": definition["id"],
        "definitionVersion": definition["version"],
        "revision": 7,
        "status": "active",
        "objectives": {
            optional["id"]: {"state": "available", "visibility": "visible", "disposition": None},
        },
        "knownFacts": [known_fact["id"]],
        "entryContext": {"capabilities": [{"id": capability["id"]}]},
        "outcomeDimensions": {},
    }

    mission = _mission_projection(state)

    assert mission["objectives"][0]["class"] == "optional"
    assert mission["facts"] == [{"id": known_fact["id"], "summary": known_fact["playerText"]["summary"]}]
    assert mission["capabilities"] == [{
        "id": capability["id"],
        "label": capability["playerText"]["label"],
        "summary": capability["playerText"]["summary"],
    }]


def test_absent_directive_crew_values_remain_absent():
    projection = create_player_projection(API(), 9)
    directive = projection["people"][0]["directive"]
    assert "assignment" not in directive
    assert "duty_status" not in directive
