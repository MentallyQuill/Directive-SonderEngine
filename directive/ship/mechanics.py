"""Deterministic authored ship work, capability, constraint, and cohesion state."""

from __future__ import annotations

import copy
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any


SHIP_STATE_KIND = "directive.shipState.v1"
SHIP_CLAIM_TYPE = "shipMilestoneCompleted"
SHIP_EFFECT_TYPE = "ship.milestoneCompleted"


class ShipReductionError(ValueError):
    """Ship evidence is unbound, unavailable, or outside the authored catalog."""


@dataclass(frozen=True)
class ShipReduction:
    state: dict[str, Any]
    effects: tuple[dict[str, Any], ...]
    applied: tuple[dict[str, Any], ...]


def _plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return copy.deepcopy(value)


def _index(ship_dataset: Mapping[str, Any]) -> tuple[Mapping[str, Any], dict[str, Any], dict[str, Any]]:
    mechanics = ship_dataset.get("mechanics")
    if not isinstance(mechanics, Mapping) or mechanics.get("kind") != "directive.shipMechanics.v1":
        raise ShipReductionError("ship dataset has no Directive v1 mechanics")
    capabilities = {item["id"]: item for item in mechanics.get("capabilities") or ()}
    constraints = {item["id"]: item for item in mechanics.get("constraints") or ()}
    systems = mechanics.get("systems") or ()
    if not systems:
        raise ShipReductionError("ship mechanics has no systems")
    return mechanics, capabilities, constraints


def _active_effects(effects: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    accepted = []
    seen_ids: set[str] = set()
    seen_keys: set[str] = set()
    for effect in effects:
        if effect.get("type") != SHIP_EFFECT_TYPE or effect.get("status") != "active":
            continue
        effect_id = str(effect.get("id") or "")
        evidence_key = str(effect.get("evidenceKey") or "")
        if not effect_id or not evidence_key:
            raise ShipReductionError("ship milestone effect is missing stable custody")
        if effect_id in seen_ids or evidence_key in seen_keys:
            raise ShipReductionError("ship milestone effects contain duplicate custody")
        seen_ids.add(effect_id)
        seen_keys.add(evidence_key)
        accepted.append(_plain(effect))
    return sorted(accepted, key=lambda item: (str(item["targetId"]), str(item["id"])))


def _mechanics_state(ship_dataset: Mapping[str, Any], effects: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    mechanics, capability_index, constraint_index = _index(ship_dataset)
    active = _active_effects(effects)
    effects_by_milestone: dict[str, list[dict[str, Any]]] = {}
    for effect in active:
        effects_by_milestone.setdefault(str(effect["targetId"]), []).append(effect)
    satisfied = set(effects_by_milestone)
    systems = []
    active_capabilities: dict[str, dict[str, Any]] = {}
    active_constraints: dict[str, dict[str, Any]] = {}
    evidence_by_capability: dict[str, list[str]] = {}
    for system in mechanics.get("systems") or ():
        states = {item["id"]: item for item in system.get("states") or ()}
        current = states.get(system.get("openingStateId"))
        if current is None:
            raise ShipReductionError(f"ship system {system.get('id')} has an unknown opening state")
        transitions = sorted(
            system.get("transitions") or (),
            key=lambda item: (
                int((states.get(item.get("toStateId")) or {}).get("rank") or 0),
                str(item.get("id") or ""),
            ),
        )
        establishing: list[str] = []
        while True:
            transition = next((
                item for item in transitions
                if item.get("fromStateId") == current.get("id")
                and all(required in satisfied for required in item.get("requiredMilestoneIds") or ())
            ), None)
            if transition is None:
                break
            for milestone_id in transition.get("requiredMilestoneIds") or ():
                establishing.extend(item["id"] for item in effects_by_milestone.get(milestone_id, ()))
            current = states.get(transition.get("toStateId"))
            if current is None:
                raise ShipReductionError(f"ship transition {transition.get('id')} has an unknown target")
        evidence_ids = sorted(set(establishing))
        system_capabilities = []
        for capability_id in current.get("capabilityIds") or ():
            capability = capability_index.get(capability_id)
            if capability is None:
                raise ShipReductionError(f"ship state references unknown capability {capability_id}")
            public = _plain(capability)
            system_capabilities.append(public)
            active_capabilities[capability_id] = public
            evidence_by_capability[capability_id] = evidence_ids
        system_constraints = []
        for constraint_id in current.get("constraintIds") or ():
            constraint = constraint_index.get(constraint_id)
            if constraint is None:
                raise ShipReductionError(f"ship state references unknown constraint {constraint_id}")
            public = _plain(constraint)
            system_constraints.append(public)
            active_constraints[constraint_id] = public
        work_orders = []
        for milestone in system.get("milestones") or ():
            milestone_id = milestone["id"]
            if milestone_id in satisfied:
                status = "satisfied"
            elif (milestone.get("revealWhen") or {}).get("milestoneSatisfied") not in (None, *satisfied):
                status = "unknown"
            else:
                status = "known"
            item = {"id": milestone_id, "status": status}
            if status != "unknown":
                item.update(_plain(milestone.get("playerText") or {}))
            work_orders.append(item)
        systems.append({
            "id": system["id"],
            "label": (system.get("playerText") or {}).get("label"),
            "summary": (system.get("playerText") or {}).get("summary"),
            "state": {
                "id": current["id"],
                "rank": current["rank"],
                **_plain(current.get("playerText") or {}),
            },
            "stateLadder": [
                {"id": item["id"], "rank": item["rank"], **_plain(item.get("playerText") or {})}
                for item in sorted(states.values(), key=lambda item: int(item["rank"]))
            ],
            "activeCapabilities": system_capabilities,
            "activeConstraints": system_constraints,
            "workOrders": work_orders,
        })
    return {
        "systems": systems,
        "capabilities": [active_capabilities[key] for key in sorted(active_capabilities)],
        "constraints": [active_constraints[key] for key in sorted(active_constraints)],
        "capabilityEvidenceById": {
            key: evidence_by_capability[key] for key in sorted(evidence_by_capability)
        },
    }


def cohesion_band(total: int) -> dict[str, Any]:
    bounded = max(0, min(100, int(total)))
    if bounded >= 75:
        return {"id": "ready", "label": "Ready", "minimum": 75, "maximum": 100}
    if bounded >= 40:
        return {"id": "strained", "label": "Strained", "minimum": 40, "maximum": 74}
    return {"id": "critical", "label": "Critical", "minimum": 0, "maximum": 39}


def _cohesion_state(catalog: Mapping[str, Any], mechanics_state: Mapping[str, Any], branch_id: str) -> dict[str, Any]:
    if catalog.get("kind") != "directive.cohesionCatalog.v1":
        raise ShipReductionError("cohesion catalog kind is invalid")
    systems = {item["id"]: item for item in mechanics_state["systems"]}
    issues = []
    completed = []
    next_segment = 0
    for contract in catalog.get("authoredIssues") or ():
        system = systems.get(contract.get("systemId"))
        if system is None:
            raise ShipReductionError(f"cohesion issue references unknown system {contract.get('systemId')}")
        amount = int(contract["level"]) * 5
        if system["state"]["id"] == contract.get("terminalStateId"):
            completed.append({
                "id": contract["id"],
                "title": (contract.get("playerText") or {}).get("title"),
                "cohesionRestored": amount,
                "method": "authored-system",
            })
            continue
        orders = {item["id"]: item for item in system["workOrders"]}
        phases = []
        for milestone_id in contract.get("phaseMilestoneIds") or ():
            order = orders.get(milestone_id) or {}
            phases.append({
                "id": milestone_id,
                "status": "completed" if order.get("status") == "satisfied" else "available",
                "label": order.get("label") or "Unknown work order",
                "summary": order.get("summary") or "",
            })
        segment_ids = list(range(next_segment, next_segment + int(contract["level"])))
        next_segment += int(contract["level"])
        issues.append({
            "id": contract["id"],
            "authored": True,
            "systemId": contract["systemId"],
            "level": int(contract["level"]),
            "cohesion": amount,
            "primaryFamily": contract.get("primaryFamily"),
            "anchor": contract.get("anchor"),
            "conditionId": contract.get("conditionId"),
            "playerText": _plain(contract.get("playerText") or {}),
            "computerHelp": contract.get("computerHelp"),
            "segmentIds": segment_ids,
            "phases": phases,
            "completedPhaseCount": sum(item["status"] == "completed" for item in phases),
            "currentPhase": next((item for item in phases if item["status"] != "completed"), None),
        })
    debt = sum(item["cohesion"] for item in issues)
    total = max(0, 100 - debt)
    owners = {segment: issue for issue in issues for segment in issue["segmentIds"]}
    segments = [{
        "index": index,
        "filled": index not in owners,
        "issueId": (owners.get(index) or {}).get("id"),
        "visible": index in owners,
        "level": (owners.get(index) or {}).get("level"),
    } for index in range(20)]
    return {
        "kind": "directive.cohesionState.v1",
        "branchId": str(branch_id),
        "total": total,
        "debt": debt,
        "band": cohesion_band(total),
        "segments": segments,
        "issues": issues,
        "visibleTasks": _plain(issues[: int(((catalog.get('policy') or {}).get('schedule') or {}).get('visibleLimit') or 5)]),
        "queuedTasks": _plain(issues[int(((catalog.get('policy') or {}).get('schedule') or {}).get('visibleLimit') or 5):]),
        "completedHistory": completed,
    }


def derive_ship_state(
    ship_dataset: Mapping[str, Any],
    cohesion_catalog: Mapping[str, Any],
    effects: Sequence[Mapping[str, Any]],
    *,
    branch_id: str,
) -> dict[str, Any]:
    mechanics = _mechanics_state(ship_dataset, effects)
    return {
        "kind": SHIP_STATE_KIND,
        "schema": 1,
        "branchId": str(branch_id),
        "effects": _active_effects(effects),
        **mechanics,
        "cohesion": _cohesion_state(cohesion_catalog, mechanics, branch_id),
    }


def reduce_ship_evidence(
    ship_dataset: Mapping[str, Any],
    cohesion_catalog: Mapping[str, Any],
    input_effects: Sequence[Mapping[str, Any]],
    claims: Sequence[Mapping[str, Any]],
    *,
    branch_id: str,
) -> ShipReduction:
    effects = _active_effects(input_effects)
    applied = []
    for claim in sorted(claims, key=lambda item: str(item.get("claimId") or "")):
        for field in ("claimId", "targetId", "evidenceKey", "sourceTurnId", "sourceHash", "sourceRole"):
            if not isinstance(claim.get(field), str) or not claim[field].strip():
                raise ShipReductionError(f"ship claim {field} is required")
        if claim.get("claimType") != SHIP_CLAIM_TYPE:
            raise ShipReductionError("ship claim type is invalid")
        if claim["sourceRole"] not in {"adjudicator", "runtime"}:
            raise ShipReductionError("ship work requires an authoritative source")
        if any(item["evidenceKey"] == claim["evidenceKey"] for item in effects):
            continue
        current = derive_ship_state(ship_dataset, cohesion_catalog, effects, branch_id=branch_id)
        known = {
            order["id"]
            for system in current["systems"]
            for order in system["workOrders"]
            if order["status"] == "known"
        }
        if claim["targetId"] not in known:
            raise ShipReductionError(f"ship milestone {claim['targetId']} is not currently available")
        effect = {
            "id": claim["claimId"],
            "type": SHIP_EFFECT_TYPE,
            "status": "active",
            "targetId": claim["targetId"],
            "evidenceKey": claim["evidenceKey"],
            "sourceTurnId": claim["sourceTurnId"],
            "sourceHash": claim["sourceHash"],
            "sourceRole": claim["sourceRole"],
        }
        effects.append(effect)
        applied.append(_plain(effect))
    state = derive_ship_state(ship_dataset, cohesion_catalog, effects, branch_id=branch_id)
    return ShipReduction(state, tuple(_plain(effects)), tuple(applied))


def ship_interpretation_candidates(ship_dataset: Mapping[str, Any], state: Mapping[str, Any]) -> list[dict[str, Any]]:
    mechanics = ship_dataset.get("mechanics") or {}
    milestones = {
        item["id"]: item
        for system in mechanics.get("systems") or ()
        for item in system.get("milestones") or ()
    }
    return [{
        "policyId": milestone_id,
        "claimType": SHIP_CLAIM_TYPE,
        "targetId": milestone_id,
        "evidenceStandard": (milestones[milestone_id].get("interpretation") or {}).get("evidenceStandard"),
        "guidance": (milestones[milestone_id].get("interpretation") or {}).get("guidance"),
        "exclusions": _plain((milestones[milestone_id].get("interpretation") or {}).get("exclusions") or ()),
    } for system in state.get("systems") or () for order in system.get("workOrders") or ()
      if order.get("status") == "known" for milestone_id in (order["id"],)]
