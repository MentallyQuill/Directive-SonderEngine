"""Resolve portable Directive actor references through Sonder characters."""

from __future__ import annotations

from typing import Any

from ..state.contracts import (
    CrewProfile,
    PackageActorBinding,
    migrate_crew_profile,
)


class PackageActorResolutionError(ValueError):
    """A portable actor reference cannot resolve to one Sonder character."""


def resolve_package_actors(api, chat_id: int) -> dict[str, int]:
    """Map package actor references to the current Sonder character ids."""
    resolved: dict[str, int] = {}
    for handle in api.characters.in_chat(int(chat_id)):
        raw_binding = handle.binding()
        if raw_binding is None:
            continue
        binding = PackageActorBinding.from_dict(raw_binding)
        previous = resolved.get(binding.actor_ref)
        if previous is not None:
            raise PackageActorResolutionError(
                f"actor_ref {binding.actor_ref!r} is bound to Sonder "
                f"characters {previous} and {handle.char_id}"
            )
        resolved[binding.actor_ref] = int(handle.char_id)
    return resolved


def migrate_registered_crew_profiles(api) -> dict[str, int]:
    """Persist exact v1 profiles through supported Sonder character handles.

    Migration is deliberately per record and best-effort: a damaged extension
    value stays byte-for-byte untouched and cannot prevent another story or the
    extension itself from loading.
    """
    counts = {"migrated": 0, "current": 0, "failed": 0}
    chats = getattr(api, "chats", None)
    characters = getattr(api, "characters", None)
    if not callable(getattr(chats, "mine", None)) or not callable(
        getattr(characters, "in_chat", None)
    ):
        return counts

    for story in chats.mine():
        chat_id = int(story["chat_id"])
        for handle in characters.in_chat(chat_id):
            raw: Any = handle.state.get(None)
            if raw is None:
                continue
            try:
                migrated = migrate_crew_profile(raw)
                profile = CrewProfile.from_dict(migrated)
                if raw.get("kind") == "directive.crewProfile.v2":
                    counts["current"] += 1
                    continue
                handle.state.set_now(profile.to_dict())
                counts["migrated"] += 1
            except Exception as exc:
                counts["failed"] += 1
                api.log.warning(
                    "Directive crew profile migration left character %s in "
                    "story %s untouched: %s",
                    handle.char_id,
                    chat_id,
                    exc,
                )
    return counts
