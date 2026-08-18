from __future__ import annotations

import json

import pytest

from directive.campaign.compiler import (
    PlayerSetup,
    ProvisioningError,
    compile_ashes_archive,
)
from directive.campaign.source import load_ashes_source


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


def compile_bundle():
    return compile_ashes_archive(
        load_ashes_source(),
        PlayerSetup.from_dict(player_payload()),
    )


def test_player_setup_requires_every_authored_creation_field():
    payload = player_payload()
    del payload["appearance"]

    with pytest.raises(ProvisioningError, match="appearance"):
        PlayerSetup.from_dict(payload)


def test_compiles_a_complete_sonder_archive_with_one_persona_and_seven_crew():
    bundle = compile_bundle()
    archive = bundle.archive

    assert archive["version"] == 1
    assert archive["chat"]["name"] == "Ashes of Peace"
    assert archive["resources"]["persona"]["sheet"]["identity"]["name"] == "Sam Vickers"
    assert len(archive["resources"]["characters"]) == 7
    assert len(archive["participants"]) == 7
    assert len({item["old_id"] for item in archive["resources"]["characters"]}) == 7
    assert {item["char_id"] for item in archive["participants"]} == set(range(1, 8))


def test_participant_state_carries_only_directive_crew_domain_data():
    bundle = compile_bundle()

    states = [json.loads(item["state"])["ext:directive"] for item in bundle.archive["participants"]]
    mara = next(item for item in states if item["crew_id"] == "mara-whitaker")
    assert mara["rank"] == "Captain"
    assert mara["role"] == "Commanding Officer"
    assert mara["department"] == "command"
    assert mara["public_record"]["birthplace"] == "Kingston, Ontario, Earth"
    assert "duty_status" not in mara
    assert "narrationGuide" not in mara
    assert "psychology" not in mara
    assert "secrets" not in mara


def test_host_cards_keep_public_and_private_surfaces_in_their_supported_homes():
    bundle = compile_bundle()
    cards = {
        item["sheet"]["identity"]["name"]: item["sheet"]
        for item in bundle.archive["resources"]["characters"]
    }
    mara = cards["Mara Whitaker"]

    assert mara["knowledge"]["public_history"].startswith("Captain Mara Whitaker")
    assert mara["knowledge"]["private_history"] == []
    assert mara["embodiment"]["visible"]["summary"] == ""
    assert mara["psychology"]["drive"]["essence"]
    assert "narrationGuide" not in mara
    assert "publicRecord" not in mara


def test_opening_scene_and_clock_are_playable_without_a_bootstrap_step():
    bundle = compile_bundle()
    world = bundle.archive["world"]
    scene = world["scene"]

    assert scene["rooms"]["ready-room-threshold"]["adjacent"]["ready-room"]["barrier"] == "closed_door"
    assert scene["positions"]["Sam Vickers"] == "ready-room-threshold"
    assert scene["positions"]["Mara Whitaker"] == "ready-room"
    assert world["simulation_clock"] == {
        "elapsed_seconds": 0.0,
        "display": "08:30:00",
        "time_scale": "scene",
    }
    assert world["known"]["Sam Vickers"] == [
        "Mara Whitaker", "Kieran Vale", "Priya Nayar", "Hadrik Bronn",
        "Rowan Saye", "Miriam Sato", "Imani Cross",
    ]


def test_bundle_contains_every_atomic_provisioning_argument():
    bundle = compile_bundle()
    kwargs = bundle.provision_kwargs()

    assert kwargs["state"]["kind"] == "directive.campaignConfig.v1"
    assert kwargs["frame_state"]["kind"] == "directive.frameState.v1"
    assert kwargs["package_id"] == "directive:campaign-package:breckenridge-ashes-of-peace"
    assert kwargs["package_version"] == "0.3.0-pre-alpha.2"
    assert kwargs["player_authority"] == "actor_only"
    assert set(kwargs["director_context"]) == {"establish", "interpret", "resolve"}
    assert kwargs["narration_context"]
    assert len(kwargs["documents"]) == 18
    assert "package/missions/prelude-a-ship-underway" in kwargs["documents"]
    assert "player/profile" in kwargs["documents"]


def test_frame_state_starts_with_domain_authority_derived_from_the_host_epoch():
    frame = compile_bundle().frame_state

    assert frame["mission"]["kind"] == "directive.missionState.v1"
    assert frame["mission"]["definitionId"] == "mission.prelude-a-ship-underway"
    assert frame["mission"]["branchId"] == "frame.root"
    assert frame["mission"]["revision"] == 0
    assert frame["command"]["bearing"] == {
        "kind": "directive.commandBearing.v1",
        "version": 1,
        "balance": 0,
        "capacity": 3,
        "awards": {},
        "spends": {},
    }
    assert frame["time"]["ledger"] == {
        "kind": "directive.timeLedger.v1",
        "elapsed_seconds": 0,
        "stardate": 53068.4,
        "ship_clock": {
            "second_of_day": 30600,
            "minute_of_day": 510,
            "display": "08:30:00",
        },
    }


def test_bundle_is_plain_json_and_does_not_import_sonder_to_compile():
    bundle = compile_bundle()

    json.dumps(bundle.archive)
    json.dumps(bundle.provision_kwargs())


def test_persona_resource_uid_changes_when_player_identity_changes():
    first = compile_bundle().archive["resources"]["persona"]["resource_uid"]
    changed = player_payload()
    changed["name"] = "T'Vel"
    second = compile_ashes_archive(
        load_ashes_source(), PlayerSetup.from_dict(changed)
    ).archive["resources"]["persona"]["resource_uid"]

    assert first != second
