from __future__ import annotations

import copy
from dataclasses import dataclass

import pytest

from directive import routes
from directive.state.contracts import PACKAGE_ID, PACKAGE_VERSION


class Documents:
    def __init__(self, values):
        self.values = values

    def get(self, path):
        return copy.deepcopy(self.values.get(path))

    def put_now(self, path, value):
        self.values[path] = copy.deepcopy(value)


class API:
    def __init__(self):
        self.routes = {}
        self.stores = {1: {}, 2: {}, 3: {}}
        self.provenance_values = {
            1: self._provenance("family-a"),
            2: self._provenance("family-a"),
            3: self._provenance("family-a"),
        }

    def add_route(self, path, fn, *, methods=("GET",)):
        for method in methods:
            self.routes[(method, path)] = fn

    def documents(self, chat_id):
        return Documents(self.stores[int(chat_id)])

    def provenance(self, chat_id):
        return copy.deepcopy(self.provenance_values.get(int(chat_id), {}))

    @staticmethod
    def _provenance(family):
        return {
            "package": PACKAGE_ID,
            "version": PACKAGE_VERSION,
            "extension": "directive",
            "at": family,
        }

    def add_model_lane(self, *args, **kwargs):
        return "ext:directive:test"

    def add_stage(self, *args, **kwargs):
        pass

    def add_commit_domain(self, *args, **kwargs):
        pass

    def on_director_result(self, *args, **kwargs):
        pass


@dataclass
class Request:
    chat_id: int
    body: object
    query: object | None = None


def save(chat_id=2, name="Before the briefing"):
    return {
        "id": f"save-{chat_id}",
        "chat_id": chat_id,
        "name": name,
        "createdAt": "2026-08-18T12:34:56.000Z",
        "chapter": "Prelude: A Ship Underway",
        "stardate": 53068.4,
    }


def test_save_registry_is_synchronized_to_current_and_saved_timelines():
    api = API()
    routes.register(api)

    result = api.routes[("POST", "/saves")](Request(1, save()))

    assert result == {"ok": True, "saved_games": [save()]}
    assert api.stores[1]["timeline/saves"] == {
        "kind": "directive.timelineRegistry.v1",
        "schema": 1,
        "saved_games": [save()],
    }
    assert api.stores[2]["timeline/saves"] == api.stores[1]["timeline/saves"]

    result = api.routes[("POST", "/saves")](Request(1, save(3, "After the briefing")))
    assert [item["chat_id"] for item in result["saved_games"]] == [2, 3]
    assert api.stores[2]["timeline/saves"] == api.stores[3]["timeline/saves"]


def test_delete_save_removes_it_and_resynchronizes_remaining_timelines():
    api = API()
    routes.register(api)
    api.routes[("POST", "/saves")](Request(1, save()))
    api.routes[("POST", "/saves")](Request(1, save(3, "After the briefing")))

    result = api.routes[("DELETE", "/saves")](
        Request(1, None, {"saved_game_id": "save-2"})
    )

    assert result == {"ok": True, "saved_games": [save(3, "After the briefing")]}
    assert api.stores[1]["timeline/saves"] == api.stores[3]["timeline/saves"]


def test_save_route_rejects_non_directive_clone_ids():
    api = API()
    api.stores[9] = {}
    api.provenance_values[9] = {}
    routes.register(api)

    with pytest.raises(ValueError, match="Directive story"):
        api.routes[("POST", "/saves")](Request(1, save(9)))


def test_save_route_rejects_self_registration_and_unrelated_directive_stories():
    api = API()
    api.stores[9] = {}
    api.provenance_values[9] = api._provenance("family-b")
    routes.register(api)

    with pytest.raises(ValueError, match="cannot register itself"):
        api.routes[("POST", "/saves")](Request(1, save(1)))
    with pytest.raises(ValueError, match="same provisioned timeline family"):
        api.routes[("POST", "/saves")](Request(1, save(9)))
