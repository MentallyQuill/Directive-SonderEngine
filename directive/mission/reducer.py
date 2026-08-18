"""Deterministic closed-candidate mission evidence reduction."""

from __future__ import annotations

import copy
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .predicates import index_definition
from .state import (
    mission_context,
    plain,
    predicate,
    reduce_objectives,
    validate_mission_state,
)


_STABLE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_CLAIM_ORDER = {
    "worldFactEstablished": 10,
    "eventOccurred": 20,
    "outcomeObserved": 30,
    "factDisclosed": 40,
    "intentExpressed": 50,
    "decisionRecorded": 60,
}
_AUTHORITATIVE_WORLD_ROLES = {"runtime", "adjudicator"}


class MissionReductionError(ValueError):
    pass


@dataclass(frozen=True)
class Reduction:
    state: dict[str, Any]
    effects: tuple[dict[str, Any], ...]
    transition_packet: dict[str, Any] | None
    command_bearing_awards: tuple[dict[str, Any], ...]


def _sorted(records: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    return sorted(records, key=lambda item: (_CLAIM_ORDER.get(item.get("claimType"), 999), str(item.get("claimId") or "")))


def _source_bound(claim: Mapping[str, Any]) -> None:
    for field in ("claimId", "evidenceKey", "sourceTurnId", "sourceHash", "sourceRole"):
        value = claim.get(field)
        if not isinstance(value, str) or not value.strip():
            raise MissionReductionError(f"claim {field} is required")
    if not _STABLE_ID.fullmatch(claim["claimId"]):
        raise MissionReductionError("claimId must be stable")


def _validate_claim(definition, state, claim, *, ship_capabilities):
    _source_bound(claim)
    index = index_definition(definition)
    policy = index.evidence_policies.get(claim.get("policyId"))
    if not policy or policy.get("claimType") != claim.get("claimType") or policy.get("targetId") != claim.get("targetId"):
        raise MissionReductionError("claim policy does not match its effect")
    if claim["claimType"] == "worldFactEstablished" and claim["sourceRole"] not in _AUTHORITATIVE_WORLD_ROLES:
        raise MissionReductionError("player or narration cannot establish world truth")
    if claim["sourceRole"] not in set(policy.get("sourceRoles") or ()):
        raise MissionReductionError("claim source role is not authorized by policy")
    if claim["claimType"] in {"outcomeObserved", "decisionRecorded"}:
        outcome = index.outcomes.get(claim["targetId"])
        if not outcome or claim.get("value") not in set(outcome.get("allowedValues") or ()):
            raise MissionReductionError("claim outcome value is not authored")
    if not predicate(definition, state, policy.get("when"), ship_capabilities=ship_capabilities):
        raise MissionReductionError("claim policy precondition is not met")
    if claim["claimType"] == "factDisclosed" and claim["targetId"] not in state["worldFacts"]:
        raise MissionReductionError("a fact cannot be disclosed before it is world truth")


def _add(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


def _apply(state, claim):
    kind = claim["claimType"]
    if kind == "worldFactEstablished":
        _add(state["worldFacts"], claim["targetId"])
    elif kind == "factDisclosed":
        _add(state["knownFacts"], claim["targetId"])
    elif kind == "eventOccurred":
        _add(state["events"], claim["targetId"])
    elif kind in {"outcomeObserved", "decisionRecorded"}:
        state["outcomes"][claim["targetId"]] = claim["value"]


def _dimensions(definition, state, *, ship_capabilities):
    derived = {}
    for dimension in definition.get("outcomeDimensions") or ():
        candidates = sorted(dimension.get("derive") or (), key=lambda item: -int(item.get("priority") or 0))
        match = next((item for item in candidates if predicate(definition, state, item.get("when"), ship_capabilities=ship_capabilities)), None)
        if match:
            derived[dimension["id"]] = match["value"]
    state["outcomeDimensions"] = derived


def _select(records, definition, state, *, ship_capabilities):
    candidates = sorted(records or (), key=lambda item: -int(item.get("priority") or 0))
    return next((item for item in candidates if predicate(definition, state, item.get("when"), ship_capabilities=ship_capabilities)), None)


def _awards(definition, state):
    result = []
    for award in definition.get("commandBearingAwards") or ():
        objective = state["objectives"].get(award.get("sourceObjectiveId")) or {}
        if objective.get("state") == "terminal" and objective.get("disposition") in set(award.get("eligibleDispositions") or ()):
            result.append({
                "id": award["id"],
                "sourceMissionId": definition["id"],
                "sourceObjectiveId": award["sourceObjectiveId"],
                "reason": award["reason"],
            })
    return tuple(result)


def _transition_packet(definition, state, transition, effects):
    index = index_definition(definition)
    terminal = index.terminal_dispositions.get(state["terminalDisposition"]) or {}
    optional = []
    for objective in index.objectives.values():
        effective_class = objective.get("activatedAs") if objective.get("class") == "conditional" else objective.get("class")
        record = state["objectives"][objective["id"]]
        if effective_class != "optional" or record["visibility"] == "hidden" or record["state"] != "terminal":
            continue
        terminal_text = next((item.get("text") for item in (objective.get("playerText") or {}).get("terminal", ()) if item.get("disposition") == record["disposition"]), None)
        if terminal_text:
            optional.append(terminal_text)
    summary = (terminal.get("playerText") or {}).get("summary")
    return {
        "kind": "directive.missionTransitionNarration.v1",
        "sourceMissionId": definition["id"],
        "sourceDisposition": state["terminalDisposition"],
        "committedEffects": plain(effects),
        "playerKnownOutcomeSummary": [summary] if summary else [],
        "optionalOutcomeSummaries": optional,
        "unresolvedPlayerKnownConsequences": [],
        "next": plain(transition.get("target") or {}),
        "mustNarrate": list(transition.get("mustNarrate") or ()),
        "mustNotReveal": list(transition.get("mustNotReveal") or ()),
    }


def reduce_evidence(
    definition: Mapping[str, Any],
    input_state: Mapping[str, Any],
    claims: Sequence[Mapping[str, Any]],
    *,
    ship_capabilities: set[str] | frozenset[str] = frozenset(),
) -> Reduction:
    validation = validate_mission_state(definition, dict(input_state))
    if not validation.ok:
        raise MissionReductionError("invalid mission state: " + "; ".join(validation.errors))
    state = copy.deepcopy(input_state)
    ordered = _sorted(claims)
    if state.get("transitionReceipt") and all(item.get("evidenceKey") in state["acceptedEvidenceKeys"] for item in ordered):
        return Reduction(state, (), copy.deepcopy(state["transitionReceipt"]["packet"]), _awards(definition, state))
    effects = []
    accepted_revision = state["revision"]
    for claim in ordered:
        if claim.get("evidenceKey") in state["acceptedEvidenceKeys"]:
            continue
        _validate_claim(definition, state, claim, ship_capabilities=ship_capabilities)
        state["acceptedEvidenceKeys"].append(claim["evidenceKey"])
        entry = {
            "claimId": claim["claimId"],
            "policyId": claim["policyId"],
            "evidenceKey": claim["evidenceKey"],
            "claimType": claim["claimType"],
            "targetId": claim["targetId"],
            "value": claim.get("value"),
            "sourceTurnId": claim["sourceTurnId"],
            "sourceHash": claim["sourceHash"],
            "sourceRole": claim["sourceRole"],
            "acceptedAtMissionRevision": accepted_revision,
        }
        state["evidenceLog"].append(entry)
        _apply(state, claim)
        effects.append({
            "id": claim["claimId"],
            "type": f"mission.{claim['claimType']}",
            "targetId": claim["targetId"],
            "value": claim.get("value"),
            "sourceTurnIds": [claim["sourceTurnId"]],
            "status": "active",
        })
    if not effects:
        return Reduction(state, (), copy.deepcopy((state.get("transitionReceipt") or {}).get("packet")), _awards(definition, state))
    reduce_objectives(definition, state, ship_capabilities=ship_capabilities)
    _dimensions(definition, state, ship_capabilities=ship_capabilities)
    if state["status"] != "terminal" and predicate(definition, state, definition.get("closeWhen"), ship_capabilities=ship_capabilities):
        terminal = _select(definition.get("terminalDispositions"), definition, state, ship_capabilities=ship_capabilities)
        if not terminal:
            raise MissionReductionError("closeWhen is true without an eligible terminal disposition")
        state["status"] = "terminal"
        state["terminalDisposition"] = terminal["id"]
    state["revision"] += 1
    packet = None
    if state["status"] == "terminal" and not state["transitionReceipt"]:
        transition = _select(definition.get("transitions"), definition, state, ship_capabilities=ship_capabilities)
        if not transition:
            raise MissionReductionError("terminal mission has no eligible transition")
        packet = _transition_packet(definition, state, transition, effects)
        state["transitionReceipt"] = {
            "kind": "directive.missionTransitionReceipt.v1",
            "transitionId": transition["id"],
            "committedAtRevision": state["revision"],
            "target": plain(transition["target"]),
            "packet": copy.deepcopy(packet),
        }
    final_validation = validate_mission_state(definition, state)
    if not final_validation.ok:
        raise MissionReductionError("reducer produced invalid state: " + "; ".join(final_validation.errors))
    return Reduction(state, tuple(effects), packet, _awards(definition, state))
