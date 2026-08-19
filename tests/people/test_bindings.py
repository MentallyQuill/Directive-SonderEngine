from __future__ import annotations

import logging

import pytest

from directive.people.bindings import (
    PackageActorResolutionError,
    migrate_registered_crew_profiles,
    resolve_package_actors,
)
from directive.state.contracts import PACKAGE_ID, PACKAGE_VERSION


def v1(actor_ref="mara-whitaker"):
    return {
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": actor_ref,
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }


def v2(actor_ref="mara-whitaker"):
    return {
        "kind": "directive.crewProfile.v2",
        "schema": 2,
        "binding": {
            "kind": "directive.packageActorBinding.v1",
            "package_id": PACKAGE_ID,
            "package_version": PACKAGE_VERSION,
            "actor_ref": actor_ref,
        },
        "rank": "Captain",
        "role": "Commanding Officer",
        "department": "command",
    }


class State:
    def __init__(self, value):
        self.value = value
        self.writes = []

    def get(self, default=None):
        return self.value if self.value is not None else default

    def set_now(self, value):
        self.value = value
        self.writes.append(value)


class Handle:
    def __init__(self, char_id, value):
        self.char_id = char_id
        self.state = State(value)

    def binding(self):
        value = self.state.get({}) or {}
        return value.get("binding")


class Characters:
    def __init__(self, by_chat):
        self.by_chat = by_chat

    def in_chat(self, chat_id):
        return list(self.by_chat.get(chat_id, ()))


class Chats:
    def __init__(self, chat_ids):
        self.chat_ids = chat_ids

    def mine(self):
        return [{"chat_id": chat_id, "name": f"Story {chat_id}"}
                for chat_id in self.chat_ids]


class API:
    def __init__(self, by_chat):
        self.characters = Characters(by_chat)
        self.chats = Chats(tuple(by_chat))
        self.log = logging.getLogger("test.directive.bindings")


def test_package_actor_resolution_uses_sonder_character_handles():
    api = API({7: [Handle(41, v2()), Handle(52, v2("priya-nayar"))]})

    assert resolve_package_actors(api, 7) == {
        "mara-whitaker": 41,
        "priya-nayar": 52,
    }


def test_duplicate_package_actor_bindings_are_rejected_instead_of_guessed():
    api = API({7: [Handle(41, v2()), Handle(52, v2())]})

    with pytest.raises(
        PackageActorResolutionError,
        match="actor_ref 'mara-whitaker'.*characters 41 and 52",
    ):
        resolve_package_actors(api, 7)


def test_registered_story_migration_is_lossless_and_isolates_corrupt_records(caplog):
    legacy = Handle(41, {**v1(), "duty_status": "On duty"})
    current = Handle(52, v2("priya-nayar"))
    corrupt_value = {**v1("rowan-saye"), "private_secret": "must survive untouched"}
    corrupt = Handle(63, corrupt_value)
    api = API({7: [legacy, current, corrupt]})

    with caplog.at_level(logging.WARNING):
        result = migrate_registered_crew_profiles(api)

    assert result == {"migrated": 1, "current": 1, "failed": 1}
    assert legacy.state.value == {**v2(), "duty_status": "On duty"}
    assert len(legacy.state.writes) == 1
    assert current.state.writes == []
    assert corrupt.state.value == corrupt_value
    assert corrupt.state.writes == []
    assert "character 63" in caplog.text


def test_migration_without_host_character_access_is_a_noop():
    class MinimalAPI:
        log = logging.getLogger("test.directive.minimal")

    assert migrate_registered_crew_profiles(MinimalAPI()) == {
        "migrated": 0,
        "current": 0,
        "failed": 0,
    }
