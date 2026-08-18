from __future__ import annotations

from collections.abc import Mapping

import pytest

from directive.campaign.source import MISSION_ORDER, load_ashes_source


PACKAGE_ID = "directive:campaign-package:breckenridge-ashes-of-peace"
PACKAGE_VERSION = "0.3.0-pre-alpha.2"


def _walk_keys(value):
    if isinstance(value, Mapping):
        for key, item in value.items():
            yield str(key)
            yield from _walk_keys(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _walk_keys(item)


def test_loads_the_exact_ashes_package_and_all_thirteen_missions():
    source = load_ashes_source()

    assert source.campaign["manifest"]["id"] == PACKAGE_ID
    assert source.campaign["manifest"]["version"] == PACKAGE_VERSION
    assert source.campaign["manifest"]["openingMissionId"] == MISSION_ORDER[0]
    assert [mission["packageBinding"]["sourceId"] for mission in source.missions] == list(MISSION_ORDER)
    assert len(source.missions) == 13


def test_mission_order_is_the_authored_campaign_journey():
    assert MISSION_ORDER == (
        "prelude-a-ship-underway",
        "chapter-1-the-empty-convoy",
        "chapter-2-false-colors",
        "chapter-3-dead-letters",
        "chapter-4-the-colony-that-stayed",
        "chapter-5-old-lessons",
        "chapter-6-the-cost-of-knowing",
        "chapter-7-a-peace-of-their-own",
        "chapter-8-the-last-directive",
        "open-orders-1-work-worth-doing",
        "open-orders-2-what-survives",
        "open-orders-3-before-the-lamps-go-out",
        "epilogue-the-terms-we-keep",
    )


def test_every_authored_document_binds_to_the_same_package():
    source = load_ashes_source()

    assert source.ship["manifest"]["packageId"] == PACKAGE_ID
    assert source.crew["manifest"]["packageId"] == PACKAGE_ID
    assert source.cohesion["packageId"] == PACKAGE_ID
    for mission in source.missions:
        assert mission["packageBinding"] == {
            "packageId": PACKAGE_ID,
            "packageVersion": PACKAGE_VERSION,
            "sourceId": mission["packageBinding"]["sourceId"],
        }


def test_crew_ids_and_mission_local_semantic_ids_are_unique():
    source = load_ashes_source()
    crew_ids = [officer["id"] for officer in source.crew["officers"]]

    assert len(crew_ids) == len(set(crew_ids)) == 7
    for mission in source.missions:
        for field in ("facts", "evidencePolicies", "events", "outcomes", "objectives"):
            ids = [item["id"] for item in mission.get(field, ())]
            assert len(ids) == len(set(ids)), (mission["id"], field)


def test_every_evidence_policy_targets_an_authored_semantic_id():
    source = load_ashes_source()

    for mission in source.missions:
        targets = {
            item["id"]
            for field in ("facts", "events", "outcomes", "objectives")
            for item in mission.get(field, ())
        }
        for policy in mission.get("evidencePolicies", ()):
            assert policy["targetId"] in targets, (mission["id"], policy["id"])


def test_retired_mission_countdown_contracts_are_absent():
    source = load_ashes_source()
    forbidden = {
        "missionclock",
        "countdown",
        "timeadvanced",
        "deadlinewindow",
        "deadlineminutes",
        "remainingminutes",
    }

    keys = {
        key.casefold().replace("_", "").replace("-", "")
        for document in source.documents()
        for key in _walk_keys(document)
    }
    assert forbidden.isdisjoint(keys)


def test_loaded_documents_are_immutable():
    source = load_ashes_source()

    with pytest.raises(TypeError):
        source.campaign["manifest"]["version"] = "mutated"
