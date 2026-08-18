import copy

import pytest

from directive.campaign.source import load_ashes_source
from directive.ship.mechanics import (
    ShipReductionError,
    derive_ship_state,
    reduce_ship_evidence,
)


def claim(target, *, key=None):
    return {
        "claimId": f"claim.{target}",
        "claimType": "shipMilestoneCompleted",
        "targetId": target,
        "evidenceKey": key or f"frame.root|7|hash|{target}",
        "sourceTurnId": "7",
        "sourceHash": "sha256:resolved",
        "sourceRole": "adjudicator",
    }


def test_authored_opening_ship_state_drives_work_constraints_and_cohesion():
    source = load_ashes_source()

    state = derive_ship_state(source.ship, source.cohesion, [], branch_id="frame.root")

    assert state["kind"] == "directive.shipState.v1"
    assert state["cohesion"]["total"] == 75
    assert state["cohesion"]["band"]["id"] == "ready"
    assert {item["id"] for item in state["cohesion"]["issues"]} == {
        "cohesion-authored.sensor-calibration",
        "cohesion-authored.systems-integration",
    }
    integration = next(item for item in state["systems"] if item["id"] == "ship-system.systems-integration")
    assert integration["state"]["id"] == "ship-state.integration.unvalidated"
    assert [item["status"] for item in integration["workOrders"]] == [
        "known", "unknown", "unknown",
    ]
    assert {item["id"] for item in state["constraints"]} == {
        "ship-constraint.integration-cascade-risk",
        "ship-constraint.sensor-corroboration-required",
    }


def test_milestone_evidence_advances_only_authored_revealed_work():
    source = load_ashes_source()
    effects = []

    with pytest.raises(ShipReductionError, match="not currently available"):
        reduce_ship_evidence(
            source.ship,
            source.cohesion,
            effects,
            [claim("ship-milestone.integration-combined-load-test")],
            branch_id="frame.root",
        )

    reduction = reduce_ship_evidence(
        source.ship,
        source.cohesion,
        effects,
        [claim("ship-milestone.integration-isolation-test")],
        branch_id="frame.root",
    )
    integration = next(item for item in reduction.state["systems"] if item["id"] == "ship-system.systems-integration")
    assert integration["state"]["id"] == "ship-state.integration.segmented"
    assert [item["status"] for item in integration["workOrders"]] == [
        "satisfied", "known", "unknown",
    ]
    assert {item["id"] for item in reduction.state["capabilities"]} == {
        "ship-capability.segmented-isolation"
    }


def test_ship_reduction_is_immutable_and_replay_idempotent():
    source = load_ashes_source()
    original = []
    evidence = claim("ship-milestone.sensor-controlled-baseline")

    first = reduce_ship_evidence(
        source.ship, source.cohesion, original, [evidence], branch_id="frame.root"
    )
    replay = reduce_ship_evidence(
        source.ship, source.cohesion, first.effects, [copy.deepcopy(evidence)], branch_id="frame.root"
    )

    assert original == []
    assert len(first.effects) == 1
    assert replay.effects == first.effects
    assert replay.applied == ()


def test_completed_authored_system_restores_exact_cohesion_debt():
    source = load_ashes_source()
    targets = (
        "ship-milestone.integration-isolation-test",
        "ship-milestone.integration-combined-load-test",
        "ship-milestone.integration-failover-validation",
    )
    effects = []
    for position, target in enumerate(targets, start=1):
        item = claim(target, key=f"frame.root|{position}|hash|{target}")
        item["sourceTurnId"] = str(position)
        effects = reduce_ship_evidence(
            source.ship, source.cohesion, effects, [item], branch_id="frame.root"
        ).effects

    state = derive_ship_state(source.ship, source.cohesion, effects, branch_id="frame.root")
    assert state["cohesion"]["total"] == 90
    assert [item["id"] for item in state["cohesion"]["issues"]] == [
        "cohesion-authored.sensor-calibration"
    ]
    assert any(item["id"] == "ship-capability.integrated-failover" for item in state["capabilities"])

