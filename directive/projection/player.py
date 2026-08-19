"""Aggregate only host-certified and explicitly allowlisted player data."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from typing import Any

from ..campaign.source import load_ashes_source
from ..command.bearing import project_bearing
from ..ship.mechanics import derive_ship_state
from ..time.clock import project_time


_CREW_FIELDS = (
    "crew_id", "rank", "role", "department", "assignment", "duty_status",
    "public_record", "operational_summary",
)


def _asset_url(path: Any) -> str | None:
    value = str(path or "").replace("\\", "/").lstrip("/")
    if not value.startswith("assets/packages/breckenridge/images/") or ".." in value.split("/"):
        return None
    return f"/api/extensions/directive/asset/{value}"


def _asset_tree(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            str(key): projected
            for key, item in value.items()
            if (projected := _asset_tree(item)) not in (None, {})
        }
    return _asset_url(value)


def _media() -> dict[str, dict[str, Any]]:
    records = (load_ashes_source().campaign.get("assets") or {}).get("images") or ()
    result = {}
    for record in records:
        variants = {
            key: url
            for key, path in (record.get("variants") or {}).items()
            if (url := _asset_url(path)) is not None
        }
        subject_id = str(record["subjectId"])
        if variants and (subject_id not in result or record.get("kind") == "ship.hero"):
            cohesion = (result.get(subject_id, {}).get("variants") or {}).get("cohesion")
            result[subject_id] = {
                "kind": record.get("kind"),
                "alt": record.get("alt"),
                "variants": variants,
            }
            if cohesion:
                result[subject_id]["variants"]["cohesion"] = cohesion
            if record.get("kind") == "ship.hero":
                scene = _asset_tree(record.get("layers") or {})
                if scene:
                    result[subject_id]["scene"] = {
                        "layers": {key: scene[key] for key in ("background", "stars", "foreground") if key in scene},
                        **({"cruise": scene["cruise"]} if scene.get("cruise") else {}),
                        **({"emissive": scene["emissive"]} if scene.get("emissive") else {}),
                    }
        if record.get("kind") == "ship.cohesion" and variants.get("hero"):
            target = result.setdefault(subject_id, {
                "kind": record.get("kind"),
                "alt": record.get("alt"),
                "variants": {},
            })
            target["variants"]["cohesion"] = variants["hero"]
            anchors = {
                str(key): {"x": float(value.get("x", 0)), "y": float(value.get("y", 0))}
                for key, value in (record.get("visualAnchors") or {}).items()
                if isinstance(value, Mapping)
            }
            if anchors:
                target["anchors"] = anchors
    return result


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
        effective_class = source.get("activatedAs") if source.get("class") == "conditional" else source.get("class")
        if effective_class in {"required", "optional"}:
            item["class"] = effective_class
        if record.get("disposition") is not None:
            item["disposition"] = record["disposition"]
            terminal_text = next(
                (entry.get("text") for entry in player_text.get("terminal") or () if entry.get("disposition") == record["disposition"]),
                None,
            )
            if terminal_text:
                item["terminal_text"] = terminal_text
        objectives.append(item)
    known_ids = set(state.get("knownFacts") or ())
    facts = [{
        "id": fact["id"],
        "summary": (fact.get("playerText") or {}).get("summary"),
    } for fact in definition.get("facts") or ()
        if fact.get("visibility") != "hidden" and fact.get("id") in known_ids]
    available_ids = {
        item.get("id") for item in (state.get("entryContext") or {}).get("capabilities") or ()
        if isinstance(item, Mapping)
    }
    capabilities = [{
        "id": capability["id"],
        "label": (capability.get("playerText") or {}).get("label"),
        "summary": (capability.get("playerText") or {}).get("summary"),
    } for capability in definition.get("entryCapabilities") or ()
        if capability.get("id") in available_ids]
    receipt = state.get("transitionReceipt") or {}
    packet = receipt.get("packet") or {}
    return {
        "kind": "directive.missionPlayerProjection.v1",
        "id": state.get("definitionId"),
        "title": (definition.get("playerText") or {}).get("title"),
        "summary": (definition.get("playerText") or {}).get("summary"),
        "version": state.get("definitionVersion"),
        "revision": state.get("revision"),
        "status": state.get("status"),
        "objectives": objectives,
        "facts": facts,
        "capabilities": capabilities,
        "outcome_dimensions": copy.deepcopy(state.get("outcomeDimensions") or {}),
        "terminal_disposition": state.get("terminalDisposition"),
        "outcome_summary": copy.deepcopy(packet.get("playerKnownOutcomeSummary") or []),
        "optional_outcome_summaries": copy.deepcopy(packet.get("optionalOutcomeSummaries") or []),
    }


def _people(api, chat_id: int, player_view: Mapping[str, Any], media: Mapping[str, Any]) -> list[dict[str, Any]]:
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
                    if domain.get("crew_id") in media:
                        allowed["media"] = copy.deepcopy(media[domain["crew_id"]])
                    person["directive"] = allowed
        output.append(person)
    return output


def _ship_projection(source, frame_ship: Mapping[str, Any], branch_id: str) -> dict[str, Any]:
    state = derive_ship_state(
        source.ship,
        source.cohesion,
        frame_ship.get("effects") or (),
        branch_id=branch_id,
    )
    identity = source.campaign.get("ship") or {}
    return {
        "kind": "directive.shipPlayerProjection.v1",
        "name": identity.get("name"),
        "class_name": identity.get("class"),
        "systems": [{
            "id": item["id"],
            "label": item.get("label"),
            "summary": item.get("summary"),
            "state": copy.deepcopy(item["state"]),
            "state_ladder": copy.deepcopy(item["stateLadder"]),
            "work_orders": copy.deepcopy(item["workOrders"]),
        } for item in state["systems"]],
        "capabilities": [{
            "id": item["id"],
            **copy.deepcopy(item.get("playerText") or {}),
        } for item in state["capabilities"]],
        "constraints": [{
            "id": item["id"],
            **copy.deepcopy(item.get("playerText") or {}),
        } for item in state["constraints"]],
        "cohesion": {
            "total": state["cohesion"]["total"],
            "debt": state["cohesion"]["debt"],
            "band": copy.deepcopy(state["cohesion"]["band"]),
            "segments": copy.deepcopy(state["cohesion"]["segments"]),
            "issues": [{
                "id": item["id"],
                "level": item["level"],
                "cohesion": item["cohesion"],
                "primary_family": item.get("primaryFamily"),
                "anchor": item.get("anchor"),
                "player_text": copy.deepcopy(item["playerText"]),
                "computer_help": item.get("computerHelp"),
                "phases": copy.deepcopy(item["phases"]),
                "current_phase": copy.deepcopy(item.get("currentPhase")),
            } for item in state["cohesion"]["visibleTasks"]],
            "queued_count": len(state["cohesion"]["queuedTasks"]),
            "completed": copy.deepcopy(state["cohesion"]["completedHistory"]),
        },
    }


def _transition_projection(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    target = value.get("next") or {}
    return {
        "source_mission_id": value.get("sourceMissionId"),
        "source_disposition": value.get("sourceDisposition"),
        "outcome_summary": copy.deepcopy(value.get("playerKnownOutcomeSummary") or []),
        "optional_outcome_summaries": copy.deepcopy(value.get("optionalOutcomeSummaries") or []),
        "next": {
            "kind": target.get("kind"),
            "id": target.get("id"),
            "player_safe_setup": target.get("playerSafeSetup"),
        },
    }


def create_player_projection(api, chat_id: int) -> dict[str, Any]:
    source = load_ashes_source()
    player = api.player_view(chat_id, "player")
    frame = api.frame_state(chat_id).get() or {}
    campaign_state = api.state(chat_id).get() or {}
    mission = frame.get("mission") or {}
    settlement = frame.get("settlement") or {}
    campaign = source.campaign.get("campaign") or {}
    media = _media()
    projection = {
        "kind": "directive.playerProjection.v1",
        "schema": 1,
        "chat_id": int(chat_id),
        "campaign": {
            "id": "ashes-of-peace",
            "title": campaign.get("title"),
            "simulation_mode": (campaign_state.get("settings") or {}).get("simulation_mode"),
        },
        "media": {
            "ship": copy.deepcopy(media.get("uss-breckenridge")),
            "location": copy.deepcopy(media.get("asterion-station")),
        },
        "viewer": copy.deepcopy(player.get("viewer") or {}),
        "mission": _mission_projection(mission),
        "journey": {
            "completed_count": len(settlement.get("mission_history") or ()),
            "completed_mission_ids": [
                (item.get("state") or {}).get("definitionId")
                for item in settlement.get("mission_history") or ()
            ],
            "last_transition": _transition_projection(settlement.get("last_transition")),
            "campaign_conclusion": copy.deepcopy(settlement.get("campaign_conclusion")),
        },
        "ship": _ship_projection(
            source,
            frame.get("ship") or {},
            str(mission.get("branchId") or ""),
        ),
        "command_bearing": project_bearing((frame.get("command") or {}).get("bearing")),
        "time": project_time((frame.get("time") or {}).get("ledger")),
        "people": _people(api, int(chat_id), player, media),
    }
    for field in ("turn", "location", "perception", "knows"):
        if field in player:
            projection[field] = copy.deepcopy(player[field])
    return projection
