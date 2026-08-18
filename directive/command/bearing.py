"""Immutable Command Bearing reducers bound to Sonder turn ids."""

from __future__ import annotations

import copy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


KIND = "directive.commandBearing.v1"
PROJECTION_KIND = "directive.commandBearingPlayerProjection.v1"
_ROOTS = {"kind", "version", "balance", "capacity", "awards", "spends"}
_PENDING = {"reserved", "armed"}
_STATUSES = _PENDING | {"committed", "refunded"}
_EFFECTS = {"narrative_edge", "cohesion_relief"}


class BearingError(ValueError):
    pass


@dataclass(frozen=True)
class Validation:
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True)
class Result:
    applied: bool
    reason_code: str | None
    value: dict[str, Any]


def _text(value: Any, field: str, maximum: int = 360) -> str:
    text = " ".join(str(value or "").split())[:maximum].strip()
    if not text:
        raise BearingError(f"{field} is required")
    return text


def _now(value: str | None) -> str:
    return _text(value, "now") if value else datetime.now(timezone.utc).isoformat()


def create_bearing(*, capacity: int = 3) -> dict[str, Any]:
    try:
        bounded = max(1, min(5, round(float(capacity))))
    except (TypeError, ValueError):
        bounded = 3
    return {
        "kind": KIND,
        "version": 1,
        "balance": 0,
        "capacity": bounded,
        "awards": {},
        "spends": {},
    }


def validate_bearing(value: Any) -> Validation:
    errors: list[str] = []
    if not isinstance(value, dict):
        return Validation(("Command Bearing must be an object",))
    for field in sorted(set(value) - _ROOTS):
        errors.append(f"Command Bearing contains unsupported field {field}")
    if value.get("kind") != KIND:
        errors.append(f"kind must be {KIND}")
    if value.get("version") != 1:
        errors.append("version must be 1")
    capacity = value.get("capacity")
    balance = value.get("balance")
    if not isinstance(capacity, int) or isinstance(capacity, bool) or not 1 <= capacity <= 5:
        errors.append("capacity must be an integer from 1 through 5")
    if (
        not isinstance(balance, int)
        or isinstance(balance, bool)
        or not isinstance(capacity, int)
        or not 0 <= balance <= capacity
    ):
        errors.append("balance must be an integer within capacity")
    awards = value.get("awards")
    spends = value.get("spends")
    if not isinstance(awards, dict):
        errors.append("awards must be a record map")
        awards = {}
    if not isinstance(spends, dict):
        errors.append("spends must be a record map")
        spends = {}
    for key, record in awards.items():
        if not isinstance(record, dict) or record.get("id") != key:
            errors.append(f"award {key} id mismatch")
            continue
        if not record.get("source_id") or not record.get("reason") or not record.get("recorded_at"):
            errors.append(f"award {key} is incomplete")
        if not isinstance(record.get("credited"), bool):
            errors.append(f"award {key} credited must be boolean")
    pending = 0
    for key, record in spends.items():
        if not isinstance(record, dict) or record.get("id") != key:
            errors.append(f"spend {key} id mismatch")
            continue
        if record.get("effect") not in _EFFECTS:
            errors.append(f"spend {key} effect is not allowed")
        if record.get("status") not in _STATUSES:
            errors.append(f"spend {key} status is invalid")
        if not record.get("reason") or not record.get("reserved_at"):
            errors.append(f"spend {key} is incomplete")
        if record.get("status") in _PENDING:
            pending += 1
        if record.get("effect") == "cohesion_relief":
            relief = record.get("cohesion")
            if not record.get("target_issue_id"):
                errors.append(f"spend {key} target_issue_id is required")
            if not isinstance(relief, int) or isinstance(relief, bool) or not 1 <= relief <= 20:
                errors.append(f"spend {key} cohesion must be an integer from 1 through 20")
        if record.get("status") in {"armed", "committed"}:
            if not record.get("armed_by_player_turn_id") or not record.get("armed_at"):
                errors.append(f"spend {key} armed source is required")
        if record.get("status") == "committed":
            required = ("source_turn_id", "source_hash", "accepted_by_turn_id", "committed_at")
            if any(not record.get(field) for field in required):
                errors.append(f"spend {key} committed source is required")
        if record.get("status") == "refunded":
            if not record.get("refund_reason") or not record.get("refunded_at"):
                errors.append(f"spend {key} refund source is required")
    if pending > 1:
        errors.append("only one Command Bearing effect may be pending")
    return Validation(tuple(errors))


def _valid(value: Any) -> dict[str, Any]:
    validation = validate_bearing(value)
    if not validation.ok:
        raise BearingError("Invalid Command Bearing: " + "; ".join(validation.errors))
    return copy.deepcopy(value)


def _pending(value: dict[str, Any]) -> dict[str, Any] | None:
    return next(
        (record for record in value["spends"].values() if record["status"] in _PENDING),
        None,
    )


def award(value, *, award_id, source_id, reason, now=None) -> Result:
    next_value = _valid(value)
    award_id = _text(award_id, "award_id", 160)
    source_id = _text(source_id, "source_id", 160)
    reason = _text(reason, "reason")
    if award_id in next_value["awards"]:
        return Result(False, "already-awarded", next_value)
    credited = next_value["balance"] < next_value["capacity"]
    next_value["awards"][award_id] = {
        "id": award_id,
        "source_id": source_id,
        "reason": reason,
        "credited": credited,
        "recorded_at": _now(now),
    }
    if credited:
        next_value["balance"] += 1
    return Result(credited, None if credited else "reserve-full", next_value)


def _reserve(value, *, spend_id, effect, reason, now, **extra) -> Result:
    next_value = _valid(value)
    spend_id = _text(spend_id, "spend_id", 160)
    reason = _text(reason, "reason")
    if spend_id in next_value["spends"]:
        return Result(False, "already-spent", next_value)
    if _pending(next_value):
        return Result(False, "edge-already-pending", next_value)
    if next_value["balance"] < 1:
        return Result(False, "reserve-empty", next_value)
    next_value["balance"] -= 1
    next_value["spends"][spend_id] = {
        "id": spend_id,
        "effect": effect,
        "reason": reason,
        "status": "reserved",
        "reserved_at": _now(now),
        **extra,
    }
    return Result(True, None, next_value)


def reserve_edge(value, *, spend_id, reason, now=None) -> Result:
    return _reserve(
        value, spend_id=spend_id, effect="narrative_edge", reason=reason, now=now
    )


def reserve_cohesion_relief(
    value, *, spend_id, target_issue_id, cohesion=20, reason, now=None
) -> Result:
    if not isinstance(cohesion, int) or isinstance(cohesion, bool) or not 1 <= cohesion <= 20:
        raise BearingError("cohesion relief must be an integer from 1 through 20")
    return _reserve(
        value,
        spend_id=spend_id,
        effect="cohesion_relief",
        reason=reason,
        now=now,
        target_issue_id=_text(target_issue_id, "target_issue_id", 180),
        cohesion=cohesion,
    )


def arm_edge(value, *, spend_id, player_turn_id, now=None) -> Result:
    next_value = _valid(value)
    spend_id = _text(spend_id, "spend_id", 160)
    record = next_value["spends"].get(spend_id)
    if not record:
        return Result(False, "spend-not-found", next_value)
    if record["status"] == "armed":
        return Result(False, "already-armed", next_value)
    if record["status"] != "reserved":
        return Result(False, "edge-not-reserved", next_value)
    record.update({
        "status": "armed",
        "armed_by_player_turn_id": _text(player_turn_id, "player_turn_id", 180),
        "armed_at": _now(now),
    })
    return Result(True, None, next_value)


def commit_edge(
    value,
    *,
    spend_id,
    source_turn_id,
    source_hash,
    accepted_by_turn_id,
    now=None,
) -> Result:
    next_value = _valid(value)
    spend_id = _text(spend_id, "spend_id", 160)
    record = next_value["spends"].get(spend_id)
    if not record:
        return Result(False, "spend-not-found", next_value)
    if record["status"] == "committed":
        return Result(False, "already-committed", next_value)
    if record["status"] != "armed":
        return Result(False, "edge-not-armed", next_value)
    record.update({
        "status": "committed",
        "source_turn_id": _text(source_turn_id, "source_turn_id", 180),
        "source_hash": _text(source_hash, "source_hash", 80),
        "accepted_by_turn_id": _text(accepted_by_turn_id, "accepted_by_turn_id", 180),
        "committed_at": _now(now),
    })
    return Result(True, None, next_value)


def refund_spend(value, *, spend_id, reason, now=None) -> Result:
    next_value = _valid(value)
    spend_id = _text(spend_id, "spend_id", 160)
    reason = _text(reason, "reason")
    record = next_value["spends"].get(spend_id)
    if not record:
        return Result(False, "spend-not-found", next_value)
    if record["status"] == "refunded":
        return Result(False, "already-refunded", next_value)
    record.update({"status": "refunded", "refund_reason": reason, "refunded_at": _now(now)})
    next_value["balance"] = min(next_value["capacity"], next_value["balance"] + 1)
    return Result(True, None, next_value)


def project_bearing(value) -> dict[str, Any]:
    bearing = _valid(value)
    awards = list(bearing["awards"].values())
    spends = list(bearing["spends"].values())
    latest_award = next((item for item in reversed(awards) if item["credited"]), None)
    pending_edge = next((item for item in reversed(spends) if item["status"] in _PENDING and item["effect"] == "narrative_edge"), None)
    pending_relief = next((item for item in reversed(spends) if item["status"] in _PENDING and item["effect"] == "cohesion_relief"), None)
    latest_spend = next((item for item in reversed(spends) if item["status"] in {"committed", "refunded"}), None)
    return {
        "kind": PROJECTION_KIND,
        "balance": bearing["balance"],
        "capacity": bearing["capacity"],
        "latest_award_reason": latest_award["reason"] if latest_award else None,
        "pending_edge": ({key: pending_edge[key] for key in ("id", "status", "reason")} if pending_edge else None),
        "pending_cohesion_relief": ({key: pending_relief[key] for key in ("id", "status", "reason", "target_issue_id", "cohesion")} if pending_relief else None),
        "latest_spend": ({key: latest_spend[key] for key in ("id", "effect", "status", "reason")} if latest_spend else None),
    }
