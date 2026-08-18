from __future__ import annotations

import pytest

from directive.state.contracts import (
    CampaignConfig,
    CrewDomain,
    FrameState,
    StateContractError,
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


def test_crew_domain_omits_unknown_optional_values():
    value = {
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }

    assert CrewDomain.from_dict(value).to_dict() == value


def test_crew_domain_preserves_only_explicit_public_and_operational_fields():
    value = {
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
        "assignment": "U.S.S. Breckenridge",
        "duty_status": "On duty",
        "public_record": {
            "age": "47",
            "birthplace": "Kingston, Ontario, Earth",
        },
        "operational_summary": "Retains final legal command.",
    }

    assert CrewDomain.from_dict(value).to_dict() == value


@pytest.mark.parametrize("private_field", ["secrets", "psychology", "narration_guide"])
def test_crew_domain_rejects_private_or_narrator_fields(private_field):
    value = {
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": "mara-whitaker",
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
        private_field: {"must_not": "leak"},
    }

    with pytest.raises(StateContractError, match=f"unknown root.*{private_field}"):
        CrewDomain.from_dict(value)


def test_contracts_do_not_retain_mutable_input_aliases():
    payload = valid_frame_state()
    parsed = FrameState.from_dict(payload)
    payload["mission"]["active_id"] = "mutated-after-parse"

    assert parsed.to_dict()["mission"]["active_id"] == "prelude-a-ship-underway"
