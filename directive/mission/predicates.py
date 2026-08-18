"""Closed authored mission indexes and deterministic predicate evaluation."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any


_STABLE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_OPERATORS = {
    "all", "any", "not", "capabilityAvailable", "shipCapabilityAvailable",
    "factKnown", "worldFact", "eventOccurred", "outcomeIs",
    "objectiveState", "objectiveDisposition", "missionStatus",
}
_OBJECTIVE_STATES = {"inactive", "available", "inProgress", "terminal"}
_OBJECTIVE_DISPOSITIONS = {
    "completed", "completedWithCost", "handedOff", "knowinglyDeclined",
    "waived", "failedAfterInformedAction",
}
_MISSION_STATUSES = {"inactive", "active", "terminal", "invalidated"}


class MissionDefinitionError(ValueError):
    pass


@dataclass(frozen=True)
class MissionIndex:
    entry_capabilities: Mapping[str, Mapping[str, Any]]
    facts: Mapping[str, Mapping[str, Any]]
    events: Mapping[str, Mapping[str, Any]]
    outcomes: Mapping[str, Mapping[str, Any]]
    objectives: Mapping[str, Mapping[str, Any]]
    evidence_policies: Mapping[str, Mapping[str, Any]]
    outcome_dimensions: Mapping[str, Mapping[str, Any]]
    terminal_dispositions: Mapping[str, Mapping[str, Any]]
    transitions: Mapping[str, Mapping[str, Any]]


@dataclass(frozen=True)
class PredicateRefs:
    facts: frozenset[str] = frozenset()
    events: frozenset[str] = frozenset()
    outcomes: frozenset[str] = frozenset()
    objectives: frozenset[str] = frozenset()
    entry_capabilities: frozenset[str] = frozenset()
    ship_capabilities: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Validation:
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True)
class Evaluation(Validation):
    value: bool = False
    reasons: tuple[str, ...] = ()


def _items(value: Any) -> tuple[Mapping[str, Any], ...]:
    if value is None:
        return ()
    if isinstance(value, Mapping):
        return (value,)
    if isinstance(value, (list, tuple)):
        return tuple(item for item in value if isinstance(item, Mapping))
    return ()


def _records(definition: Mapping[str, Any], field: str) -> Mapping[str, Mapping[str, Any]]:
    records: dict[str, Mapping[str, Any]] = {}
    raw = definition.get(field)
    values = _items(raw)
    if raw is not None and not isinstance(raw, (Mapping, list, tuple)):
        raise MissionDefinitionError(f"{field} must be an object or array")
    for item in values:
        item_id = item.get("id")
        if not isinstance(item_id, str) or not _STABLE_ID.fullmatch(item_id):
            raise MissionDefinitionError(f"{field} contains an invalid id")
        if item_id in records:
            raise MissionDefinitionError(f"{field} contains duplicate id {item_id}")
        records[item_id] = item
    return MappingProxyType(records)


def index_definition(definition: Any) -> MissionIndex:
    if not isinstance(definition, Mapping):
        raise MissionDefinitionError("mission definition must be an object")
    mission_id = definition.get("id")
    if not isinstance(mission_id, str) or not _STABLE_ID.fullmatch(mission_id):
        raise MissionDefinitionError("mission definition id must be stable")
    return MissionIndex(
        entry_capabilities=_records(definition, "entryCapabilities"),
        facts=_records(definition, "facts"),
        events=_records(definition, "events"),
        outcomes=_records(definition, "outcomes"),
        objectives=_records(definition, "objectives"),
        evidence_policies=_records(definition, "evidencePolicies"),
        outcome_dimensions=_records(definition, "outcomeDimensions"),
        terminal_dispositions=_records(definition, "terminalDispositions"),
        transitions=_records(definition, "transitions"),
    )


def _match(
    value: Any,
    allowed: set[Any],
    path: str,
    errors: list[str],
    *,
    needs_id: bool = True,
) -> tuple[str | None, tuple[Any, ...]]:
    if not isinstance(value, Mapping):
        errors.append(f"{path} must be an object")
        return None, ()
    allowed_keys = {"equals", "in"} | ({"id"} if needs_id else set())
    if any(key not in allowed_keys for key in value):
        errors.append(f"{path} contains an unknown match field")
    item_id = value.get("id") if needs_id else None
    if needs_id and (not isinstance(item_id, str) or not item_id):
        errors.append(f"{path} requires an id")
    has_equals = "equals" in value
    has_in = "in" in value
    candidates = (value.get("equals"),) if has_equals else tuple(value.get("in") or ())
    if has_equals == has_in or (has_in and not isinstance(value.get("in"), (list, tuple))):
        errors.append(f"{path} requires exactly one of equals or in")
        return item_id, ()
    for candidate in candidates:
        if candidate not in allowed:
            errors.append(f"{path} contains unknown value: {candidate}")
    return item_id, candidates


def _validate_node(
    predicate: Any,
    index: MissionIndex,
    path: str,
    errors: list[str],
    refs: dict[str, set[str]],
) -> None:
    if isinstance(predicate, bool):
        return
    if not isinstance(predicate, Mapping):
        errors.append(f"{path} must be a boolean or predicate object")
        return
    if len(predicate) != 1:
        errors.append(f"{path} must contain exactly one predicate operator")
        return
    operator, value = next(iter(predicate.items()))
    if operator not in _OPERATORS:
        errors.append(f"{path} has an unknown predicate operator: {operator}")
        return
    if operator in {"all", "any"}:
        if not isinstance(value, (list, tuple)) or not value:
            errors.append(f"{path}.{operator} must be a non-empty array")
            return
        for position, child in enumerate(value):
            _validate_node(child, index, f"{path}.{operator}[{position}]", errors, refs)
        return
    if operator == "not":
        _validate_node(value, index, f"{path}.not", errors, refs)
        return
    if operator in {"factKnown", "worldFact"}:
        refs["facts"].add(str(value))
        if value not in index.facts:
            errors.append(f"{path} references unknown fact: {value}")
        return
    if operator == "eventOccurred":
        refs["events"].add(str(value))
        if value not in index.events:
            errors.append(f"{path} references unknown event: {value}")
        return
    if operator == "capabilityAvailable":
        refs["entry_capabilities"].add(str(value))
        if value not in index.entry_capabilities:
            errors.append(f"{path} references unknown capability: {value}")
        return
    if operator == "shipCapabilityAvailable":
        refs["ship_capabilities"].add(str(value))
        if not isinstance(value, str) or not _STABLE_ID.fullmatch(value):
            errors.append(f"{path} shipCapabilityAvailable requires a stable id")
        return
    if operator == "outcomeIs":
        item_id = value.get("id") if isinstance(value, Mapping) else None
        refs["outcomes"].add(str(item_id))
        outcome = index.outcomes.get(item_id)
        if not outcome:
            errors.append(f"{path} references unknown outcome: {item_id}")
        _match(value, set((outcome or {}).get("allowedValues") or ()), path, errors)
        return
    if operator in {"objectiveState", "objectiveDisposition"}:
        item_id = value.get("id") if isinstance(value, Mapping) else None
        refs["objectives"].add(str(item_id))
        objective = index.objectives.get(item_id)
        if not objective:
            errors.append(f"{path} references unknown objective: {item_id}")
        allowed = _OBJECTIVE_STATES if operator == "objectiveState" else _OBJECTIVE_DISPOSITIONS
        _, candidates = _match(value, allowed, path, errors)
        if operator == "objectiveDisposition" and objective:
            supported = set(objective.get("supportedDispositions") or ())
            for candidate in candidates:
                if candidate not in supported:
                    errors.append(f"{path} objective disposition is not supported: {candidate}")
        return
    _match(value, _MISSION_STATUSES, path, errors, needs_id=False)


def _ref_sets() -> dict[str, set[str]]:
    return {
        "facts": set(), "events": set(), "outcomes": set(),
        "objectives": set(), "entry_capabilities": set(),
        "ship_capabilities": set(),
    }


def validate_predicate(predicate: Any, index: MissionIndex) -> Validation:
    errors: list[str] = []
    _validate_node(predicate, index, "predicate", errors, _ref_sets())
    return Validation(tuple(errors))


def collect_predicate_refs(predicate: Any) -> PredicateRefs:
    refs = _ref_sets()

    def walk(node: Any) -> None:
        if not isinstance(node, Mapping):
            return
        for operator, value in node.items():
            if operator in {"all", "any"} and isinstance(value, (list, tuple)):
                for child in value:
                    walk(child)
            elif operator == "not":
                walk(value)
            elif operator in {"factKnown", "worldFact"}:
                refs["facts"].add(str(value))
            elif operator == "eventOccurred":
                refs["events"].add(str(value))
            elif operator == "outcomeIs" and isinstance(value, Mapping):
                refs["outcomes"].add(str(value.get("id")))
            elif operator in {"objectiveState", "objectiveDisposition"} and isinstance(value, Mapping):
                refs["objectives"].add(str(value.get("id")))
            elif operator == "capabilityAvailable":
                refs["entry_capabilities"].add(str(value))
            elif operator == "shipCapabilityAvailable":
                refs["ship_capabilities"].add(str(value))

    walk(predicate)
    return PredicateRefs(**{key: frozenset(value) for key, value in refs.items()})


def _contains(collection: Any, value: Any) -> bool:
    return value in collection if collection is not None else False


def evaluate_predicate(predicate: Any, context: Mapping[str, Any]) -> Evaluation:
    index = context.get("index")
    if not isinstance(index, MissionIndex):
        return Evaluation(("context requires a MissionIndex",), False, ())
    validation = validate_predicate(predicate, index)
    if not validation.ok:
        return Evaluation(validation.errors, False, ())
    reasons: list[str] = []

    def reason(operator: str, reference: str, value: bool) -> bool:
        reasons.append(f"{operator}:{reference}={'true' if value else 'false'}")
        return value

    def match(value: Mapping[str, Any], actual: Any) -> bool:
        return actual == value["equals"] if "equals" in value else actual in value["in"]

    def run(node: Any) -> bool:
        if isinstance(node, bool):
            return node
        operator, value = next(iter(node.items()))
        if operator == "all":
            return all(run(child) for child in value)
        if operator == "any":
            return any(run(child) for child in value)
        if operator == "not":
            return not run(value)
        if operator == "factKnown":
            return reason(operator, value, _contains(context.get("known_facts"), value))
        if operator == "worldFact":
            return reason(operator, value, _contains(context.get("world_facts"), value))
        if operator == "eventOccurred":
            return reason(operator, value, _contains(context.get("events"), value))
        if operator == "capabilityAvailable":
            return reason(operator, value, _contains(context.get("entry_capabilities"), value))
        if operator == "shipCapabilityAvailable":
            return reason(operator, value, _contains(context.get("ship_capabilities"), value))
        if operator == "outcomeIs":
            return reason(operator, value["id"], match(value, (context.get("outcomes") or {}).get(value["id"])))
        if operator in {"objectiveState", "objectiveDisposition"}:
            record = (context.get("objectives") or {}).get(value["id"]) or {}
            field = "state" if operator == "objectiveState" else "disposition"
            return reason(operator, value["id"], match(value, record.get(field)))
        return reason(operator, "mission", match(value, context.get("mission_status")))

    return Evaluation((), run(predicate), tuple(reasons))


def validate_definition(definition: Any) -> Validation:
    try:
        index = index_definition(definition)
    except MissionDefinitionError as exc:
        return Validation((str(exc),))
    errors: list[str] = []

    def check(predicate: Any, label: str) -> None:
        result = validate_predicate(predicate, index)
        errors.extend(f"{label}: {error}" for error in result.errors)

    for objective in index.objectives.values():
        for field in ("activationWhen", "availableWhen", "visibleWhen", "progressWhen"):
            check(objective.get(field), f"{objective['id']}.{field}")
        for terminal in _items(objective.get("terminalWhen")):
            check(terminal.get("when"), f"{objective['id']}.terminalWhen")
    for policy in index.evidence_policies.values():
        check(policy.get("when"), f"{policy['id']}.when")
    for dimension in index.outcome_dimensions.values():
        for derivation in _items(dimension.get("derive")):
            check(derivation.get("when"), f"{dimension['id']}.derive")
    check(definition.get("closeWhen"), "closeWhen")
    for disposition in index.terminal_dispositions.values():
        check(disposition.get("when"), f"{disposition['id']}.when")
    for transition in index.transitions.values():
        check(transition.get("when"), f"{transition['id']}.when")
    return Validation(tuple(errors))
