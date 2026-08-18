"""Exact Directive mission state derived from authored definitions."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from .predicates import Evaluation, index_definition, evaluate_predicate


MISSION_STATE_KIND = "directive.missionState.v1"
_ROOTS = {
    "kind", "schemaVersion", "definitionId", "definitionVersion",
    "packageBinding", "branchId", "revision", "status", "entryContext",
    "objectives", "knownFacts", "worldFacts", "events", "outcomes",
    "outcomeDimensions", "acceptedEvidenceKeys", "evidenceLog",
    "invalidatedSourceContributionIds", "terminalDisposition",
    "transitionReceipt",
}


@dataclass(frozen=True)
class Validation:
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


def plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return copy.deepcopy(value)


def mission_context(
    definition: Mapping[str, Any],
    state: Mapping[str, Any],
    *,
    ship_capabilities: set[str] | frozenset[str] = frozenset(),
) -> dict[str, Any]:
    return {
        "index": index_definition(definition),
        "entry_capabilities": {
            item.get("id") for item in (state.get("entryContext") or {}).get("capabilities", ())
            if isinstance(item, Mapping) and item.get("id")
        },
        "ship_capabilities": set(ship_capabilities),
        "known_facts": set(state.get("knownFacts") or ()),
        "world_facts": set(state.get("worldFacts") or ()),
        "events": set(state.get("events") or ()),
        "outcomes": dict(state.get("outcomes") or {}),
        "objectives": dict(state.get("objectives") or {}),
        "mission_status": state.get("status"),
    }


def predicate(
    definition: Mapping[str, Any],
    state: Mapping[str, Any],
    value: Any,
    *,
    ship_capabilities: set[str] | frozenset[str] = frozenset(),
) -> bool:
    result: Evaluation = evaluate_predicate(
        value, mission_context(definition, state, ship_capabilities=ship_capabilities)
    )
    if not result.ok:
        raise ValueError("invalid authored predicate: " + "; ".join(result.errors))
    return result.value


def reduce_objectives(
    definition: Mapping[str, Any],
    state: dict[str, Any],
    *,
    ship_capabilities: set[str] | frozenset[str] = frozenset(),
) -> None:
    objectives = tuple(definition.get("objectives") or ())
    for _pass in range(len(objectives) + 1):
        changed = False
        for objective in objectives:
            current = state["objectives"][objective["id"]]
            if current["state"] == "terminal":
                continue
            active = predicate(definition, state, objective.get("activationWhen"), ship_capabilities=ship_capabilities)
            visible = active and predicate(definition, state, objective.get("visibleWhen"), ship_capabilities=ship_capabilities)
            available = active and predicate(definition, state, objective.get("availableWhen"), ship_capabilities=ship_capabilities)
            next_state = "available" if available else "inactive"
            if available and predicate(definition, state, objective.get("progressWhen"), ship_capabilities=ship_capabilities):
                next_state = "inProgress"
            disposition = None
            for terminal in objective.get("terminalWhen") or ():
                if active and predicate(definition, state, terminal.get("when"), ship_capabilities=ship_capabilities):
                    next_state = "terminal"
                    disposition = terminal.get("disposition")
                    break
            next_value = {
                "state": next_state,
                "visibility": "resolved" if visible and next_state == "terminal" else ("visible" if visible else "hidden"),
                "disposition": disposition,
            }
            if next_value != current:
                state["objectives"][objective["id"]] = next_value
                changed = True
        if not changed:
            break


def create_mission_state(
    definition: Mapping[str, Any],
    *,
    branch_id: str,
    entry_capabilities: list[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    index = index_definition(definition)
    state = {
        "kind": MISSION_STATE_KIND,
        "schemaVersion": 1,
        "definitionId": definition["id"],
        "definitionVersion": definition.get("version"),
        "packageBinding": plain(definition.get("packageBinding") or {}),
        "branchId": str(branch_id),
        "revision": 0,
        "status": "active",
        "entryContext": {
            "kind": "directive.missionEntryContext.v1",
            "capabilities": plain(entry_capabilities or []),
        },
        "objectives": {
            objective_id: {"state": "inactive", "visibility": "hidden", "disposition": None}
            for objective_id in index.objectives
        },
        "knownFacts": [
            fact["id"] for fact in index.facts.values()
            if fact.get("initiallyTrue") is True and fact.get("visibility") == "known"
        ],
        "worldFacts": [
            fact["id"] for fact in index.facts.values() if fact.get("initiallyTrue") is True
        ],
        "events": [],
        "outcomes": {
            outcome_id: outcome.get("initialValue")
            for outcome_id, outcome in index.outcomes.items()
        },
        "outcomeDimensions": {},
        "acceptedEvidenceKeys": [],
        "evidenceLog": [],
        "invalidatedSourceContributionIds": [],
        "terminalDisposition": None,
        "transitionReceipt": None,
    }
    reduce_objectives(definition, state)
    return state


def validate_mission_state(definition: Mapping[str, Any], state: Any) -> Validation:
    errors: list[str] = []
    if not isinstance(state, dict):
        return Validation(("mission state must be an object",))
    unknown = sorted(set(state) - _ROOTS)
    missing = sorted(_ROOTS - set(state))
    errors.extend(f"mission state contains unknown field: {item}" for item in unknown)
    errors.extend(f"mission state is missing field: {item}" for item in missing)
    if state.get("kind") != MISSION_STATE_KIND:
        errors.append(f"kind must be {MISSION_STATE_KIND}")
    if state.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if state.get("definitionId") != definition.get("id") or state.get("definitionVersion") != definition.get("version"):
        errors.append("mission definition binding mismatch")
    if state.get("packageBinding") != plain(definition.get("packageBinding") or {}):
        errors.append("mission package binding mismatch")
    if not isinstance(state.get("branchId"), str) or not state.get("branchId"):
        errors.append("branchId is required")
    if not isinstance(state.get("revision"), int) or isinstance(state.get("revision"), bool) or state.get("revision", -1) < 0:
        errors.append("revision must be a non-negative integer")
    if state.get("status") not in {"active", "terminal"}:
        errors.append("status is unknown")
    index = index_definition(definition)
    objectives = state.get("objectives")
    if not isinstance(objectives, dict) or set(objectives) != set(index.objectives):
        errors.append("objectives must exactly match the definition")
    else:
        for objective_id, record in objectives.items():
            if not isinstance(record, dict) or set(record) != {"state", "visibility", "disposition"}:
                errors.append(f"objective {objective_id} has an invalid record")
                continue
            if record["state"] not in {"inactive", "available", "inProgress", "terminal"}:
                errors.append(f"objective {objective_id} state is unknown")
            if record["visibility"] not in {"hidden", "visible", "resolved"}:
                errors.append(f"objective {objective_id} visibility is unknown")
    for field, allowed in (
        ("knownFacts", set(index.facts)), ("worldFacts", set(index.facts)),
        ("events", set(index.events)),
    ):
        values = state.get(field)
        if not isinstance(values, list) or len(values) != len(set(values)) or any(item not in allowed for item in values):
            errors.append(f"{field} contains invalid ids")
    outcomes = state.get("outcomes")
    if not isinstance(outcomes, dict) or set(outcomes) != set(index.outcomes):
        errors.append("outcomes must exactly match the definition")
    else:
        for outcome_id, value in outcomes.items():
            if value not in set(index.outcomes[outcome_id].get("allowedValues") or ()):
                errors.append(f"outcome {outcome_id} value is not authored")
    for field in ("acceptedEvidenceKeys", "evidenceLog", "invalidatedSourceContributionIds"):
        if not isinstance(state.get(field), list):
            errors.append(f"{field} must be an array")
    if state.get("status") == "active" and (state.get("terminalDisposition") is not None or state.get("transitionReceipt") is not None):
        errors.append("active mission cannot carry a terminal receipt")
    if state.get("status") == "terminal":
        if state.get("terminalDisposition") not in index.terminal_dispositions:
            errors.append("terminalDisposition is not authored")
        if not isinstance(state.get("transitionReceipt"), dict):
            errors.append("terminal mission requires a transition receipt")
    return Validation(tuple(errors))
