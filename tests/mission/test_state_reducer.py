from __future__ import annotations

import copy

import pytest

from directive.campaign.source import load_ashes_source
from directive.mission.reducer import MissionReductionError, reduce_evidence
from directive.mission.state import create_mission_state, validate_mission_state


def small_definition():
    return {
        "kind": "directive.missionDefinition.v1",
        "schemaVersion": 1,
        "id": "mission.small",
        "version": "1.0.0",
        "packageBinding": {"packageId": "package.one", "packageVersion": "1.0.0", "sourceId": "small"},
        "facts": [{"id": "fact.truth", "initiallyTrue": False, "visibility": "known"}],
        "events": [{"id": "event.rescue", "playerVisibility": "visible"}],
        "outcomes": [{"id": "outcome.cost", "initialValue": "unknown", "allowedValues": ["unknown", "none", "high"], "playerVisibility": "visible"}],
        "objectives": [{
            "id": "objective.rescue",
            "class": "required",
            "activatedAs": None,
            "activationWhen": True,
            "availableWhen": True,
            "visibleWhen": True,
            "progressWhen": False,
            "terminalWhen": [{"disposition": "completed", "when": {"eventOccurred": "event.rescue"}}],
            "supportedDispositions": ["completed"],
            "playerText": {"title": "Rescue", "terminal": [{"disposition": "completed", "text": "Rescue complete."}]},
        }],
        "evidencePolicies": [
            {"id": "policy.truth", "claimType": "worldFactEstablished", "targetId": "fact.truth", "sourceRoles": ["runtime"], "when": True},
            {"id": "policy.rescue", "claimType": "eventOccurred", "targetId": "event.rescue", "sourceRoles": ["runtime"], "when": True},
            {"id": "policy.cost", "claimType": "outcomeObserved", "targetId": "outcome.cost", "sourceRoles": ["runtime"], "when": True},
        ],
        "outcomeDimensions": [{
            "id": "dimension.cost",
            "derive": [
                {"value": "costly", "priority": 100, "when": {"outcomeIs": {"id": "outcome.cost", "equals": "high"}}},
                {"value": "clean", "priority": 50, "when": {"outcomeIs": {"id": "outcome.cost", "equals": "none"}}},
            ],
        }],
        "closeWhen": {"objectiveState": {"id": "objective.rescue", "equals": "terminal"}},
        "terminalDispositions": [{"id": "success", "priority": 100, "when": {"objectiveDisposition": {"id": "objective.rescue", "equals": "completed"}}, "playerText": {"summary": "The rescue is complete."}}],
        "transitions": [{"id": "next", "priority": 100, "when": {"missionStatus": {"equals": "terminal"}}, "target": {"kind": "mission", "id": "next"}, "mustNarrate": ["Acknowledge the rescue."], "mustNotReveal": ["Do not invent casualties."]}],
        "commandBearingAwards": [],
    }


def claim(claim_id, policy_id, claim_type, target_id, value=None):
    item = {
        "claimId": claim_id,
        "policyId": policy_id,
        "claimType": claim_type,
        "targetId": target_id,
        "evidenceKey": f"main|turn.7|hash|{claim_type}|{target_id}",
        "sourceTurnId": "turn.7",
        "sourceHash": "sha256:accepted-result",
        "sourceRole": "runtime",
    }
    if value is not None:
        item["value"] = value
    return item


def test_every_authored_mission_creates_a_valid_exact_initial_state():
    for mission in load_ashes_source().missions:
        state = create_mission_state(mission, branch_id="frame.root")
        validation = validate_mission_state(mission, state)
        assert validation.ok, (mission["id"], validation.errors)
        assert state["revision"] == 0
        assert state["status"] == "active"
        assert "clocks" not in state


def test_reduction_is_deterministic_source_bound_immutable_and_idempotent():
    definition = small_definition()
    initial = create_mission_state(definition, branch_id="main")
    before = copy.deepcopy(initial)
    claims = [
        claim("claim.cost", "policy.cost", "outcomeObserved", "outcome.cost", "high"),
        claim("claim.rescue", "policy.rescue", "eventOccurred", "event.rescue"),
        claim("claim.truth", "policy.truth", "worldFactEstablished", "fact.truth"),
    ]

    result = reduce_evidence(definition, initial, list(reversed(claims)))
    reordered = reduce_evidence(definition, initial, claims)
    replay = reduce_evidence(definition, result.state, claims)

    assert initial == before
    assert result.state == reordered.state
    assert result.state["revision"] == 1
    assert result.state["status"] == "terminal"
    assert result.state["terminalDisposition"] == "success"
    assert result.state["objectives"]["objective.rescue"] == {
        "state": "terminal", "visibility": "resolved", "disposition": "completed"
    }
    assert result.state["outcomeDimensions"] == {"dimension.cost": "costly"}
    assert result.state["evidenceLog"][0]["claimId"] == "claim.truth"
    assert all(item["sourceTurnId"] == "turn.7" for item in result.state["evidenceLog"])
    assert result.transition_packet["next"] == {"kind": "mission", "id": "next"}
    assert replay.state == result.state
    assert replay.effects == ()


def test_claims_without_committed_source_binding_or_matching_policy_fail_closed():
    definition = small_definition()
    initial = create_mission_state(definition, branch_id="main")
    missing_source = claim("claim.rescue", "policy.rescue", "eventOccurred", "event.rescue")
    del missing_source["sourceTurnId"]
    with pytest.raises(MissionReductionError, match="sourceTurnId"):
        reduce_evidence(definition, initial, [missing_source])
    with pytest.raises(MissionReductionError, match="policy"):
        reduce_evidence(
            definition,
            initial,
            [claim("claim.wrong", "policy.truth", "eventOccurred", "event.rescue")],
        )


def test_player_or_narration_cannot_establish_world_truth():
    definition = small_definition()
    initial = create_mission_state(definition, branch_id="main")
    proposed = claim("claim.truth", "policy.truth", "worldFactEstablished", "fact.truth")
    proposed["sourceRole"] = "user"
    with pytest.raises(MissionReductionError, match="world truth"):
        reduce_evidence(definition, initial, [proposed])
