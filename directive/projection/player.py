"""Aggregate only host-certified and explicitly allowlisted player data."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from typing import Any

from ..campaign.source import load_ashes_source
from ..command.bearing import project_bearing
from ..time.clock import project_time


_CREW_FIELDS = (
    "crew_id", "rank", "role", "department", "assignment", "duty_status",
    "public_record", "operational_summary",
)


def _definition(definition_id: str):
    return next(
        (mission for mission in load_ashes_source().missions if mission.get("id") == definition_id),
        None,
    )


def _mission_projection(state: Mapping[str, Any]) -> dict[str, Any]:
    definition = _definition(str(state.get("definitionId") or ""))
    if definition is None:
        raise ValueError("frame references an unknown Directive mission")
    authored = {item["id"]: item for item in definition.get("objectives") or ()}
    objectives = []
    for objective_id, record in (state.get("objectives") or {}).items():
        if record.get("visibility") == "hidden":
            continue
        source = authored.get(objective_id) or {}
        player_text = source.get("playerText") or {}
        item = {
            "id": objective_id,
            "state": record.get("state"),
            "visibility": record.get("visibility"),
            "title": player_text.get("title"),
            "summary": player_text.get("summary"),
        }
        if record.get("disposition") is not None:
            item["disposition"] = record["disposition"]
            terminal_text = next(
                (entry.get("text") for entry in player_text.get("terminal") or () if entry.get("disposition") == record["disposition"]),
                None,
            )
            if terminal_text:
                item["terminal_text"] = terminal_text
        objectives.append(item)
    receipt = state.get("transitionReceipt") or {}
    packet = receipt.get("packet") or {}
    return {
        "kind": "directive.missionPlayerProjection.v1",
        "id": state.get("definitionId"),
        "version": state.get("definitionVersion"),
        "revision": state.get("revision"),
        "status": state.get("status"),
        "objectives": objectives,
        "outcome_dimensions": copy.deepcopy(state.get("outcomeDimensions") or {}),
        "terminal_disposition": state.get("terminalDisposition"),
        "outcome_summary": copy.deepcopy(packet.get("playerKnownOutcomeSummary") or []),
        "optional_outcome_summaries": copy.deepcopy(packet.get("optionalOutcomeSummaries") or []),
    }


def _people(api, chat_id: int, player_view: Mapping[str, Any]) -> list[dict[str, Any]]:
    output = []
    for raw in player_view.get("people") or ():
        if not isinstance(raw, Mapping):
            continue
        person = copy.deepcopy(dict(raw))
        person_id = str(person.get("id") or "")
        if person.get("kind") == "character" and person.get("identity_status") == "recognized" and person_id.isdigit():
            domain = api.char_state(chat_id, int(person_id)).get() or {}
            if domain.get("kind") == "directive.crewDomain.v1" and domain.get("schema") == 1:
                allowed = {
                    field: copy.deepcopy(domain[field])
                    for field in _CREW_FIELDS
                    if field in domain
                }
                if allowed:
                    person["directive"] = allowed
        output.append(person)
    return output


def create_player_projection(api, chat_id: int) -> dict[str, Any]:
    player = api.player_view(chat_id, "player")
    frame = api.frame_state(chat_id).get() or {}
    mission = frame.get("mission") or {}
    campaign = load_ashes_source().campaign.get("campaign") or {}
    projection = {
        "kind": "directive.playerProjection.v1",
        "schema": 1,
        "chat_id": int(chat_id),
        "campaign": {
            "id": "ashes-of-peace",
            "title": campaign.get("title"),
        },
        "viewer": copy.deepcopy(player.get("viewer") or {}),
        "mission": _mission_projection(mission),
        "ship": {
            "cohesion": (frame.get("ship") or {}).get("cohesion"),
        },
        "command_bearing": project_bearing((frame.get("command") or {}).get("bearing")),
        "time": project_time((frame.get("time") or {}).get("ledger")),
        "people": _people(api, int(chat_id), player),
    }
    for field in ("turn", "location", "perception", "knows"):
        if field in player:
            projection[field] = copy.deepcopy(player[field])
    return projection
