"""Host actions and prompt custody for a pending Command Bearing edge."""

from __future__ import annotations

import copy
import uuid
from typing import Any

from ..campaign.source import load_ashes_source
from ..ship.mechanics import create_cohesion_relief_effect, derive_ship_state
from .bearing import (
    commit_edge,
    project_bearing,
    refund_spend,
    reserve_cohesion_relief,
    reserve_edge,
)

CONTEXT_PATH = "command/bearing-context"
EDGE_INSTRUCTION = (
    "COMMAND BEARING: The player has spent one Command Bearing for this turn. "
    "Create one credible favorable edge that follows from established facts and "
    "the player's chosen approach. Do not erase established costs, override "
    "player agency, invent player dialogue, or guarantee success."
)
RELIEF_INSTRUCTION = (
    "COMMAND BEARING COHESION RELIEF: Resolve only the named visible Cohesion "
    "issue through a credible commander-led causal result in this response. "
    "Do not bypass unrelated permanent capability evidence or clear anonymous debt."
)


def reserve_command_bearing_edge(api, chat_id: int) -> dict[str, Any]:
    frame = copy.deepcopy(api.frame_state(chat_id).get() or {})
    bearing = (frame.get("command") or {}).get("bearing")
    spend_id = f"command-bearing-edge.{uuid.uuid4().hex}"
    reserved = reserve_edge(
        bearing,
        spend_id=spend_id,
        reason="Create one credible favorable edge without erasing established costs.",
    )
    if not reserved.applied:
        return {
            "applied": False,
            "reason_code": reserved.reason_code,
            "command_bearing": project_bearing(reserved.value),
        }
    next_bearing = reserved.value
    latest_turn_id = _latest_turn_id(api, chat_id)
    if latest_turn_id is not None:
        next_bearing["spends"][spend_id]["reserved_after_turn_id"] = str(latest_turn_id)
    frame.setdefault("command", {})["bearing"] = next_bearing
    api.frame_state(chat_id).set_now(frame)
    return {
        "applied": True,
        "reason_code": None,
        "spend_id": spend_id,
        "command_bearing": project_bearing(next_bearing),
    }


def reserve_command_bearing_cohesion_relief(api, chat_id: int, raw: Any) -> dict[str, Any]:
    issue_id = str((raw or {}).get("issue_id") or "").strip() if isinstance(raw, dict) else ""
    frame = copy.deepcopy(api.frame_state(chat_id).get() or {})
    source = load_ashes_source()
    branch_id = str((frame.get("mission") or {}).get("branchId") or "")
    ship = derive_ship_state(
        source.ship, source.cohesion, (frame.get("ship") or {}).get("effects") or (),
        branch_id=branch_id,
    )
    target = next(
        (item for item in ship["cohesion"]["visibleTasks"] if item["id"] == issue_id),
        None,
    )
    bearing = (frame.get("command") or {}).get("bearing")
    if target is None:
        return {
            "applied": False,
            "reason_code": "cohesion-target-unavailable",
            "command_bearing": project_bearing(bearing),
        }
    spend_id = f"command-bearing-cohesion.{uuid.uuid4().hex}"
    reserved = reserve_cohesion_relief(
        bearing,
        spend_id=spend_id,
        target_issue_id=issue_id,
        cohesion=min(20, int(target["cohesion"])),
        reason=f"Commit command attention to resolving {target['playerText']['title']}.",
    )
    if not reserved.applied:
        return {
            "applied": False,
            "reason_code": reserved.reason_code,
            "command_bearing": project_bearing(reserved.value),
        }
    next_bearing = reserved.value
    latest_turn_id = _latest_turn_id(api, chat_id)
    if latest_turn_id is not None:
        next_bearing["spends"][spend_id]["reserved_after_turn_id"] = str(latest_turn_id)
    frame.setdefault("command", {})["bearing"] = next_bearing
    api.frame_state(chat_id).set_now(frame)
    return {
        "applied": True,
        "reason_code": None,
        "spend_id": spend_id,
        "target_issue_id": issue_id,
        "command_bearing": project_bearing(next_bearing),
    }


def bind_pending_edge_to_generation(payload: dict[str, Any], info, api) -> dict[str, Any]:
    """Colour a later generation without mutating checkpointed story state."""
    chat_id = getattr(info, "chat_id", None)
    turn_id = getattr(info, "turn_id", None)
    if chat_id is None or turn_id is None or not isinstance(payload, dict):
        return payload
    frame = copy.deepcopy(api.frame_state(chat_id).get() or {})
    bearing = (frame.get("command") or {}).get("bearing")
    projection = project_bearing(bearing)
    pending = projection.get("pending_edge") or projection.get("pending_cohesion_relief")
    if not pending or pending.get("status") not in {"reserved", "armed"}:
        return payload
    record = (bearing.get("spends") or {}).get(pending["id"]) or {}
    if str(record.get("reserved_after_turn_id") or "") == str(turn_id):
        return payload
    if record.get("armed_by_player_turn_id") and str(record["armed_by_player_turn_id"]) != str(turn_id):
        return payload
    instruction = RELIEF_INSTRUCTION if record.get("effect") == "cohesion_relief" else EDGE_INSTRUCTION
    return _inject_edge_instruction(payload, instruction)


def cancel_command_bearing_edge(api, chat_id: int) -> dict[str, Any]:
    frame = copy.deepcopy(api.frame_state(chat_id).get() or {})
    bearing = (frame.get("command") or {}).get("bearing")
    projection = project_bearing(bearing)
    pending = projection.get("pending_edge") or projection.get("pending_cohesion_relief")
    if not pending:
        return {"applied": False, "reason_code": "no-pending-edge", "command_bearing": projection}
    refunded = refund_spend(
        bearing,
        spend_id=pending["id"],
        reason="The player cancelled the reserved edge before it was used.",
    )
    frame.setdefault("command", {})["bearing"] = refunded.value
    api.frame_state(chat_id).set_now(frame)
    restore_edge_context(api, chat_id)
    return {
        "applied": refunded.applied,
        "reason_code": refunded.reason_code,
        "spend_id": pending["id"],
        "command_bearing": project_bearing(refunded.value),
    }


def commit_pending_edge(api, chat_id: int, frame: dict[str, Any], *, turn_id: Any, source_hash: str) -> tuple[dict[str, Any], bool]:
    next_frame = copy.deepcopy(frame)
    bearing = (next_frame.get("command") or {}).get("bearing")
    projection = project_bearing(bearing)
    pending = projection.get("pending_edge") or projection.get("pending_cohesion_relief")
    if not pending or pending.get("status") not in {"reserved", "armed"}:
        return next_frame, False
    record = (bearing.get("spends") or {}).get(pending["id"]) or {}
    if str(record.get("reserved_after_turn_id") or "") == str(turn_id):
        return next_frame, False
    if record.get("armed_by_player_turn_id") and str(record["armed_by_player_turn_id"]) != str(turn_id):
        return next_frame, False
    if record.get("effect") == "cohesion_relief":
        source = load_ashes_source()
        branch_id = str((next_frame.get("mission") or {}).get("branchId") or "")
        ship = derive_ship_state(
            source.ship, source.cohesion,
            (next_frame.get("ship") or {}).get("effects") or (),
            branch_id=branch_id,
        )
        target = next(
            (item for item in ship["cohesion"]["visibleTasks"] if item["id"] == record.get("target_issue_id")),
            None,
        )
        if target is None:
            refunded = refund_spend(
                bearing, spend_id=pending["id"],
                reason="The targeted Cohesion issue was no longer visible when the result settled.",
            )
            next_frame.setdefault("command", {})["bearing"] = refunded.value
            restore_edge_context(api, chat_id)
            return next_frame, False
    committed = commit_edge(
        bearing,
        spend_id=pending["id"],
        source_turn_id=str(turn_id),
        source_hash=source_hash,
        accepted_by_turn_id=str(turn_id),
    )
    next_frame.setdefault("command", {})["bearing"] = committed.value
    if committed.applied:
        if record.get("effect") == "cohesion_relief":
            effects = list((next_frame.get("ship") or {}).get("effects") or ())
            effects.append(create_cohesion_relief_effect(
                spend_id=pending["id"],
                target_issue_id=record["target_issue_id"],
                cohesion=int(record["cohesion"]),
                source_turn_id=str(turn_id),
                source_hash=source_hash,
            ))
            next_frame.setdefault("ship", {})["effects"] = effects
        restore_edge_context(api, chat_id)
    return next_frame, committed.applied


def _install_edge_context(api, chat_id: int, instruction: str) -> None:
    docs = api.documents(chat_id)
    if docs.get(CONTEXT_PATH) is not None:
        return
    director = api.director_context(chat_id)
    narration = api.narration_context(chat_id)
    resolve_record = director.get("resolve") or {}
    previous_resolve = str(resolve_record.get("text") or "")
    previous_narration = str(narration.text or "")
    docs.put_now(CONTEXT_PATH, {
        "kind": "directive.commandBearingContext.v1",
        "resolve": previous_resolve,
        "narration": previous_narration,
    })
    director.set(resolve=_joined(previous_resolve, instruction))
    narration.set(_joined(previous_narration, instruction))


def restore_edge_context(api, chat_id: int) -> None:
    docs = api.documents(chat_id)
    backup = docs.get(CONTEXT_PATH)
    if not isinstance(backup, dict):
        return
    api.director_context(chat_id).set(resolve=str(backup.get("resolve") or ""))
    narration = api.narration_context(chat_id)
    previous_narration = str(backup.get("narration") or "")
    if previous_narration:
        narration.set(previous_narration)
    else:
        narration.clear()
    docs.delete_now(CONTEXT_PATH)


def _joined(base: str, instruction: str) -> str:
    return f"{base.strip()}\n\n{instruction}".strip()


def _latest_turn_id(api, chat_id: int):
    try:
        turns = api.chats.turns(chat_id, limit=1)
    except Exception:
        return None
    return turns[-1].get("turn_id") if turns else None


def _inject_edge_instruction(payload: dict[str, Any], instruction: str) -> dict[str, Any]:
    next_payload = copy.deepcopy(payload)
    blocks = list(next_payload.get("extension_context") or ())
    if not any(
        item.get("source") == "directive" and item.get("text") == instruction
        for item in blocks if isinstance(item, dict)
    ):
        blocks.append({"source": "directive", "text": instruction, "revision": 0})
    next_payload["extension_context"] = blocks
    return next_payload
