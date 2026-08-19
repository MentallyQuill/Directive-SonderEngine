from __future__ import annotations

import pytest

from directive.state.contracts import (
    CampaignConfig,
    CrewProfile,
    FrameState,
    PackageActorBinding,
    StateContractError,
    migrate_crew_profile,
)


PACKAGE_ID = "directive:campaign-package:breckenridge-ashes-of-peace"
PACKAGE_VERSION = "0.3.0-pre-alpha.2"


def valid_campaign_config():
    return {
        "kind": "directive.campaignConfig.v1",
        "schema": 1,
        "campaign_id": "ashes-of-peace",
        "package": {"id": PACKAGE_ID, "version": PACKAGE_VERSION},
        "settings": {"simulation_mode": "Command"},
    }


def valid_frame_state():
    return {
        "kind": "directive.frameState.v1",
        "schema": 1,
        "campaign_id": "ashes-of-peace",
        "package_version": PACKAGE_VERSION,
        "mission": {"active_id": "prelude-a-ship-underway"},
        "settlement": {"sources": []},
        "ship": {"ship_id": "uss-breckenridge"},
        "command": {"bearing": 0},
        "time": {"opening_stardate": 53068.4},
    }


def test_campaign_config_round_trips_exactly():
    value = valid_campaign_config()

    assert CampaignConfig.from_dict(value).to_dict() == value


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("kind", "directive.campaignConfig.v2"),
        ("schema", 2),
        ("campaign_id", "another-campaign"),
    ],
)
def test_campaign_config_rejects_incompatible_identity(field, value):
    payload = valid_campaign_config()
    payload[field] = value

    with pytest.raises(StateContractError, match=field):
        CampaignConfig.from_dict(payload)


def test_campaign_config_rejects_an_unknown_root():
    with pytest.raises(StateContractError, match="unknown root.*save_registry"):
        CampaignConfig.from_dict(
            {**valid_campaign_config(), "save_registry": {}}
        )


def test_frame_state_round_trips_exactly():
    value = valid_frame_state()

    assert FrameState.from_dict(value).to_dict() == value


def test_frame_state_rejects_an_unknown_root():
    with pytest.raises(StateContractError, match="unknown root.*shadowTimeline"):
        FrameState.from_dict(
            {**valid_frame_state(), "shadowTimeline": {}}
        )


@pytest.mark.parametrize("missing", ["mission", "settlement", "ship", "command", "time"])
def test_frame_state_requires_every_domain_root(missing):
    payload = valid_frame_state()
    del payload[missing]

    with pytest.raises(StateContractError, match=f"missing root.*{missing}"):
        FrameState.from_dict(payload)


def valid_crew_v1():
    return {
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }


def valid_crew_profile():
    return {
        "kind": "directive.crewProfile.v2",
        "schema": 2,
        "binding": {
            "kind": "directive.packageActorBinding.v1",
            "package_id": PACKAGE_ID,
            "package_version": PACKAGE_VERSION,
            "actor_ref": "mara-whitaker",
        },
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }


def test_package_actor_binding_round_trips_exactly():
    value = valid_crew_profile()["binding"]

    assert PackageActorBinding.from_dict(value).to_dict() == value


def test_crew_profile_uses_a_private_binding_instead_of_a_second_identity():
    value = valid_crew_profile()

    profile = CrewProfile.from_dict(value)

    assert profile.to_dict() == value
    assert profile.to_public_dict() == {
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }
    assert "crew_id" not in profile.to_dict()
    assert "binding" not in profile.to_public_dict()


def test_crew_profile_rejects_the_retired_crew_identity_root():
    value = {**valid_crew_profile(), "crew_id": "mara-whitaker"}

    with pytest.raises(StateContractError, match="unknown root.*crew_id"):
        CrewProfile.from_dict(value)


def test_v1_crew_domain_migrates_losslessly_to_v2_profile():
    value = {
        **valid_crew_v1(),
        "assignment": "U.S.S. Breckenridge",
        "duty_status": "On duty",
        "public_record": {
            "age": "47",
            "birthplace": "Kingston, Ontario, Earth",
        },
        "operational_summary": "Retains final legal command.",
    }

    migrated = migrate_crew_profile(value)

    assert migrated == {
        **valid_crew_profile(),
        "assignment": "U.S.S. Breckenridge",
        "duty_status": "On duty",
        "public_record": {
            "age": "47",
            "birthplace": "Kingston, Ontario, Earth",
        },
        "operational_summary": "Retains final legal command.",
    }
    assert "crew_id" not in migrated


def test_v2_migration_is_idempotent_and_returns_detached_data():
    value = {
        **valid_crew_profile(),
        "assignment": "U.S.S. Breckenridge",
    }

    migrated = migrate_crew_profile(value)
    value["binding"]["actor_ref"] = "mutated-after-parse"

    assert migrated["binding"]["actor_ref"] == "mara-whitaker"


@pytest.mark.parametrize(
    "value",
    [
        {**valid_crew_v1(), "schema": 7},
        {**valid_crew_profile(), "schema": 7},
        {**valid_crew_profile(), "kind": "directive.crewProfile.v3"},
    ],
)
def test_crew_profile_migration_rejects_unknown_versions(value):
    with pytest.raises(StateContractError):
        migrate_crew_profile(value)


@pytest.mark.parametrize("private_field", ["secrets", "psychology", "narration_guide"])
def test_crew_profile_rejects_private_or_narrator_fields(private_field):
    value = {
        **valid_crew_profile(),
        private_field: {"must_not": "leak"},
    }

    with pytest.raises(StateContractError, match=f"unknown root.*{private_field}"):
        CrewProfile.from_dict(value)


def test_contracts_do_not_retain_mutable_input_aliases():
    payload = valid_frame_state()
    parsed = FrameState.from_dict(payload)
    payload["mission"]["active_id"] = "mutated-after-parse"

    assert parsed.to_dict()["mission"]["active_id"] == "prelude-a-ship-underway"
