"""Durable, player-safe registry for full Sonder story-clone saves."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from typing import Any

from ..state.contracts import PACKAGE_ID, PACKAGE_VERSION

REGISTRY_PATH = "timeline/saves"
REGISTRY_KIND = "directive.timelineRegistry.v1"


def project_saved_games(api, chat_id: int) -> list[dict[str, Any]]:
    documents = getattr(api, "documents", None)
    if not callable(documents):
        return []
    registry = documents(int(chat_id)).get(REGISTRY_PATH)
    if not isinstance(registry, Mapping):
        return []
    records = []
    for raw in registry.get("saved_games") or ():
        try:
            records.append(_record(raw))
        except ValueError:
            continue
    return records


def register_saved_game(api, chat_id: int, raw: Any) -> dict[str, Any]:
    current_id = _story_id(chat_id)
    current_provenance = _require_directive_story(api, current_id)
    record = _record(raw)
    if record["chat_id"] == current_id:
        raise ValueError("a Directive story cannot register itself as a saved game")
    saved_provenance = _require_directive_story(api, record["chat_id"])
    if _timeline_lineage(saved_provenance) != _timeline_lineage(current_provenance):
        raise ValueError("saved game must belong to the same provisioned timeline family")
    records = project_saved_games(api, current_id)
    records = [
        item for item in records
        if item["id"] != record["id"] and item["chat_id"] != record["chat_id"]
    ]
    records.append(record)
    _synchronize(api, current_id, records)
    return {"ok": True, "saved_games": copy.deepcopy(records)}


def unregister_saved_game(api, chat_id: int, raw: Any) -> dict[str, Any]:
    current_id = _story_id(chat_id)
    _require_directive_story(api, current_id)
    if not isinstance(raw, Mapping):
        raise ValueError("saved game deletion must be an object")
    saved_game_id = _text(raw.get("saved_game_id"), "saved_game_id", 128)
    records = [
        item for item in project_saved_games(api, current_id)
        if item["id"] != saved_game_id
    ]
    _synchronize(api, current_id, records)
    return {"ok": True, "saved_games": copy.deepcopy(records)}


def _synchronize(api, current_id: int, records: list[dict[str, Any]]) -> None:
    registry = {
        "kind": REGISTRY_KIND,
        "schema": 1,
        "saved_games": copy.deepcopy(records),
    }
    target_ids = [current_id, *(item["chat_id"] for item in records)]
    for target_id in dict.fromkeys(target_ids):
        if target_id != current_id:
            try:
                _require_directive_story(api, target_id)
            except ValueError:
                continue
        api.documents(target_id).put_now(REGISTRY_PATH, copy.deepcopy(registry))


def _require_directive_story(api, chat_id: int) -> dict[str, Any]:
    provenance = getattr(api, "provenance", None)
    if not callable(provenance):
        raise ValueError("saved game lineage is unavailable")
    value = provenance(chat_id) or {}
    if (
        value.get("package") != PACKAGE_ID
        or value.get("version") != PACKAGE_VERSION
        or value.get("extension") != "directive"
    ):
        raise ValueError("saved game must be a Directive story")
    if value.get("at") is None:
        raise ValueError("saved game lineage is unavailable")
    return dict(value)


def _timeline_lineage(provenance: Mapping[str, Any]) -> tuple[Any, ...]:
    """Use host-written provisioning provenance, preserved by story clones."""
    return (
        provenance.get("extension"),
        provenance.get("package"),
        provenance.get("version"),
        provenance.get("at"),
    )


def _record(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, Mapping):
        raise ValueError("saved game must be an object")
    record = {
        "id": _text(raw.get("id"), "id", 128),
        "chat_id": _story_id(raw.get("chat_id")),
        "name": _text(raw.get("name"), "name", 120),
        "createdAt": _text(raw.get("createdAt"), "createdAt", 64),
    }
    for field, limit in (("chapter", 180),):
        value = raw.get(field)
        if value is not None and str(value).strip():
            record[field] = _text(value, field, limit)
    stardate = raw.get("stardate")
    if isinstance(stardate, (int, float)) and not isinstance(stardate, bool):
        record["stardate"] = stardate
    elif stardate is not None and str(stardate).strip():
        record["stardate"] = _text(stardate, "stardate", 40)
    return record


def _story_id(value: Any) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("chat_id must be a positive integer") from exc
    if result <= 0:
        raise ValueError("chat_id must be a positive integer")
    return result


def _text(value: Any, field: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be non-empty text")
    result = value.strip()
    if len(result) > limit:
        raise ValueError(f"{field} exceeds {limit} characters")
    return result
