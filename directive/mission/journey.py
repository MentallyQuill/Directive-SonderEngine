"""Mission-chain transitions and capability custody across committed missions."""

from __future__ import annotations

import copy
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .state import create_mission_state, plain


class JourneyError(ValueError):
    pass


@dataclass(frozen=True)
class JourneyAdvance:
    current: dict[str, Any]
    history: tuple[dict[str, Any], ...]
    advanced: bool
    conclusion: dict[str, Any] | None


def entry_capabilities(
    definition: Mapping[str, Any],
    history: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    archived = {
        (
            (item.get("state") or {}).get("definitionId"),
            (item.get("state") or {}).get("definitionVersion"),
        ): item.get("state") or {}
        for item in history
    }
    granted = []
    for capability in definition.get("entryCapabilities") or ():
        source = capability.get("source") or {}
        state = archived.get((source.get("definitionId"), source.get("definitionVersion")))
        if state is None:
            continue
        dimensions = state.get("outcomeDimensions") or {}
        requirements = source.get("requirements") or ()
        if all(dimensions.get(item.get("dimensionId")) in set(item.get("in") or ()) for item in requirements):
            granted.append(plain(capability))
    return granted


def _target_definition(definitions, target_id):
    return next((
        definition for definition in definitions
        if definition.get("id") == target_id
        or (definition.get("packageBinding") or {}).get("sourceId") == target_id
    ), None)


def advance_journey(
    definitions: Sequence[Mapping[str, Any]],
    current: Mapping[str, Any],
    history: Sequence[Mapping[str, Any]],
) -> JourneyAdvance:
    if current.get("status") != "terminal" or not isinstance(current.get("transitionReceipt"), Mapping):
        return JourneyAdvance(copy.deepcopy(dict(current)), tuple(copy.deepcopy(list(history))), False, None)
    archived = copy.deepcopy(list(history))
    archive_key = (current.get("definitionId"), current.get("revision"))
    if not any(
        ((item.get("state") or {}).get("definitionId"), (item.get("state") or {}).get("revision")) == archive_key
        for item in archived
    ):
        archived.append({
            "kind": "directive.missionArchive.v1",
            "state": plain(current),
        })
    target = (current.get("transitionReceipt") or {}).get("target") or {}
    if target.get("kind") == "phase":
        conclusion = plain(target.get("campaignConclusion") or {})
        conclusion.setdefault("id", target.get("id"))
        return JourneyAdvance(plain(current), tuple(archived), False, conclusion)
    if target.get("kind") != "mission" or not target.get("id"):
        raise JourneyError("terminal mission transition has an unsupported target")
    definition = _target_definition(definitions, target["id"])
    if definition is None:
        raise JourneyError(f"mission transition target is not installed: {target['id']}")
    capabilities = entry_capabilities(definition, archived)
    next_state = create_mission_state(
        definition,
        branch_id=str(current.get("branchId") or "frame.root"),
        entry_capabilities=capabilities,
    )
    return JourneyAdvance(next_state, tuple(archived), True, None)
