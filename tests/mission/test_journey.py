from directive.campaign.source import load_ashes_source
from directive.mission.journey import advance_journey, entry_capabilities
from directive.mission.state import create_mission_state, plain


def terminal_state(definition, target):
    state = create_mission_state(definition, branch_id="frame.root")
    state["status"] = "terminal"
    state["terminalDisposition"] = next(iter(item["id"] for item in definition["terminalDispositions"]))
    state["transitionReceipt"] = {
        "kind": "directive.missionTransitionReceipt.v1",
        "transitionId": "test.transition",
        "committedAtRevision": 1,
        "target": plain(target),
        "packet": {"kind": "directive.missionTransitionNarration.v1"},
    }
    state["revision"] = 1
    return state


def test_terminal_mission_archives_and_enters_authored_target():
    source = load_ashes_source()
    prelude = source.missions[0]
    target = prelude["transitions"][0]["target"]
    terminal = terminal_state(prelude, target)

    result = advance_journey(source.missions, terminal, [])

    assert result.advanced is True
    assert result.current["definitionId"] == "mission.chapter-1-the-empty-convoy"
    assert result.current["revision"] == 0
    assert len(result.history) == 1
    assert result.history[0]["state"]["definitionId"] == prelude["id"]


def test_entry_capabilities_derive_only_from_archived_authored_dimensions():
    source = load_ashes_source()
    chapter1 = next(item for item in source.missions if item["id"] == "mission.chapter-1-the-empty-convoy")
    chapter2 = next(item for item in source.missions if item["id"] == "mission.chapter-2-false-colors")
    prior = create_mission_state(chapter1, branch_id="frame.root")
    prior["outcomeDimensions"] = {"dimension.chapter1.cooperation": "joint-record"}
    history = [{"state": prior}]

    granted = entry_capabilities(chapter2, history)

    assert [item["id"] for item in granted] == ["capability.chapter2.shared-convoy-record"]
    prior["outcomeDimensions"]["dimension.chapter1.cooperation"] = "independent-records"
    assert entry_capabilities(chapter2, [{"state": prior}]) == []


def test_final_phase_target_keeps_terminal_mission_and_records_conclusion():
    source = load_ashes_source()
    epilogue = source.missions[-1]
    target = epilogue["transitions"][0]["target"]
    terminal = terminal_state(epilogue, target)

    result = advance_journey(source.missions, terminal, [])

    assert result.advanced is False
    assert result.current == terminal
    assert result.conclusion["id"] == "ashes-authored-conclusion"
    assert len(result.history) == 1
