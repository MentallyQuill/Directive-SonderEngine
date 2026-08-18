from __future__ import annotations

import copy

import pytest

from directive.campaign.source import load_ashes_source
from directive.mission.predicates import (
    MissionDefinitionError,
    collect_predicate_refs,
    evaluate_predicate,
    index_definition,
    validate_definition,
    validate_predicate,
)


def reference_definition():
    return {
        "id": "mission.reference",
        "facts": [{"id": "fact.known"}],
        "events": [{"id": "event.done"}],
        "outcomes": [{"id": "outcome.result", "allowedValues": ["unknown", "yes"]}],
        "objectives": [{"id": "objective.main", "supportedDispositions": ["completed"]}],
        "entryCapabilities": [{"id": "capability.entry"}],
        "evidencePolicies": [],
        "outcomeDimensions": [],
        "terminalDispositions": [],
        "transitions": [],
    }


def context(index):
    return {
        "index": index,
        "entry_capabilities": {"capability.entry"},
        "ship_capabilities": {"ship-capability.segmented-isolation"},
        "known_facts": {"fact.known"},
        "world_facts": {"fact.known"},
        "events": {"event.done"},
        "outcomes": {"outcome.result": "yes"},
        "objectives": {"objective.main": {"state": "terminal", "disposition": "completed"}},
        "mission_status": "active",
    }


def test_all_thirteen_authored_missions_pass_the_closed_definition_contract():
    source = load_ashes_source()
    validations = [validate_definition(mission) for mission in source.missions]

    assert all(item.ok for item in validations), [item.errors for item in validations if not item.ok]
    assert sum(len(index_definition(item).evidence_policies) for item in source.missions) > 100


@pytest.mark.parametrize(
    ("predicate", "expected"),
    [
        (True, True),
        ({"not": False}, True),
        ({"factKnown": "fact.known"}, True),
        ({"worldFact": "fact.known"}, True),
        ({"eventOccurred": "event.done"}, True),
        ({"outcomeIs": {"id": "outcome.result", "equals": "yes"}}, True),
        ({"objectiveState": {"id": "objective.main", "in": ["terminal"]}}, True),
        ({"objectiveDisposition": {"id": "objective.main", "equals": "completed"}}, True),
        ({"missionStatus": {"in": ["active", "terminal"]}}, True),
        ({"capabilityAvailable": "capability.entry"}, True),
        ({"shipCapabilityAvailable": "ship-capability.segmented-isolation"}, True),
        ({"all": [True, False]}, False),
    ],
)
def test_evaluates_only_the_current_closed_predicate_vocabulary(predicate, expected):
    index = index_definition(reference_definition())
    result = evaluate_predicate(predicate, context(index))
    assert result.ok
    assert result.value is expected


@pytest.mark.parametrize(
    ("predicate", "message"),
    [
        ({"modelDecides": "anything"}, "unknown predicate operator"),
        ({"clockState": {"equals": "running"}}, "unknown predicate operator"),
        ({"all": []}, "non-empty array"),
        ({"factKnown": "fact.unknown"}, "unknown fact"),
        ({"eventOccurred": "event.unknown"}, "unknown event"),
        ({"outcomeIs": {"id": "outcome.result", "equals": "no"}}, "unknown value"),
        ({"missionStatus": {"id": "invented", "equals": "active"}}, "unknown match field"),
        ({"shipCapabilityAvailable": "spaces are invalid"}, "stable id"),
    ],
)
def test_invalid_or_retired_predicates_fail_closed(predicate, message):
    result = validate_predicate(predicate, index_definition(reference_definition()))
    assert not result.ok
    assert message in "\n".join(result.errors)
    assert evaluate_predicate(predicate, context(index_definition(reference_definition()))).value is False


def test_predicates_short_circuit_collect_refs_and_never_mutate_context():
    index = index_definition(reference_definition())
    state = context(index)
    before = copy.deepcopy({key: value for key, value in state.items() if key != "index"})
    predicate = {
        "all": [
            {"eventOccurred": "event.done"},
            {"any": [True, {"factKnown": "fact.known"}]},
        ]
    }
    result = evaluate_predicate(predicate, state)
    refs = collect_predicate_refs(predicate)

    assert result.value is True
    assert refs.events == frozenset({"event.done"})
    assert refs.facts == frozenset({"fact.known"})
    assert {key: value for key, value in state.items() if key != "index"} == before


def test_duplicate_definition_ids_are_refused_before_indexing():
    definition = reference_definition()
    definition["facts"].append({"id": "fact.known"})
    with pytest.raises(MissionDefinitionError, match="duplicate"):
        index_definition(definition)
