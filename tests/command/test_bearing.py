from __future__ import annotations

import copy

import pytest

from directive.command.bearing import (
    BearingError,
    arm_edge,
    award,
    commit_edge,
    create_bearing,
    project_bearing,
    refund_spend,
    reserve_cohesion_relief,
    reserve_edge,
    validate_bearing,
)


NOW = "2026-08-18T12:00:00Z"


def test_award_reserve_arm_commit_refund_is_immutable_and_idempotent():
    initial = create_bearing(capacity=3)
    snapshot = copy.deepcopy(initial)
    earned = award(initial, award_id="award.one", source_id="objective.one", reason="Follow-through.", now=NOW)
    duplicate = award(earned.value, award_id="award.one", source_id="objective.one", reason="Again.", now=NOW)
    reserved = reserve_edge(earned.value, spend_id="spend.42", reason="A bounded edge.", now=NOW)
    armed = arm_edge(reserved.value, spend_id="spend.42", player_turn_id="turn.42", now=NOW)
    committed = commit_edge(
        armed.value,
        spend_id="spend.42",
        source_turn_id="turn.43",
        source_hash="abc123",
        accepted_by_turn_id="turn.44",
        now=NOW,
    )
    refunded = refund_spend(committed.value, spend_id="spend.42", reason="Rerolled.", now=NOW)

    assert initial == snapshot
    assert earned.applied and earned.value["balance"] == 1
    assert not duplicate.applied and duplicate.reason_code == "already-awarded"
    assert reserved.value["balance"] == 0
    assert committed.value["spends"]["spend.42"]["status"] == "committed"
    assert refunded.value["balance"] == 1
    assert refund_spend(refunded.value, spend_id="spend.42", reason="Again.", now=NOW).reason_code == "already-refunded"


def test_pending_effects_are_mutually_exclusive_and_projection_is_bounded():
    bearing = award(create_bearing(), award_id="award.one", source_id="objective.one", reason="Earned.", now=NOW).value
    relief = reserve_cohesion_relief(
        bearing,
        spend_id="relief.one",
        target_issue_id="issue.visible.one",
        cohesion=20,
        reason="Command attention.",
        now=NOW,
    )

    assert relief.applied
    assert reserve_edge(relief.value, spend_id="edge.blocked", reason="Blocked.", now=NOW).reason_code == "edge-already-pending"
    projection = project_bearing(relief.value)
    assert projection["pending_edge"] is None
    assert projection["pending_cohesion_relief"] == {
        "id": "relief.one",
        "status": "reserved",
        "reason": "Command attention.",
        "target_issue_id": "issue.visible.one",
        "cohesion": 20,
    }
    assert "awards" not in projection and "spends" not in projection


def test_contract_rejects_unknown_fields_and_out_of_range_relief():
    invalid = {**create_bearing(), "tracks": {}}
    assert validate_bearing(invalid).errors == ("Command Bearing contains unsupported field tracks",)
    with pytest.raises(BearingError, match="integer from 1 through 20"):
        reserve_cohesion_relief(
            create_bearing(),
            spend_id="bad",
            target_issue_id="issue.one",
            cohesion=21,
            reason="Too much.",
            now=NOW,
        )
