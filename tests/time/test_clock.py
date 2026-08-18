from __future__ import annotations

import pytest

from directive.time.clock import TimeError, derive_ship_time, project_time


def test_sonder_elapsed_seconds_are_the_only_generic_time_authority():
    ledger = derive_ship_time(
        {"elapsed_seconds": 459, "display": "host-owned", "time_scale": "scene"},
        opening_minute_of_day=510,
        opening_stardate=53068.4,
        stardate_per_day=1,
    )

    assert ledger == {
        "kind": "directive.timeLedger.v1",
        "elapsed_seconds": 459,
        "stardate": 53068.405312,
        "ship_clock": {
            "second_of_day": 31059,
            "minute_of_day": 517,
            "display": "08:37:39",
        },
    }
    assert project_time(ledger) == {
        "kind": "directive.timePlayerProjection.v1",
        "stardate": 53068.405312,
        "second_of_day": 31059,
        "clock_display": "08:37:39",
        "stardate_display": "53068.4",
    }


def test_clock_rolls_over_but_stardate_and_elapsed_time_do_not():
    ledger = derive_ship_time(
        {"elapsed_seconds": 86490},
        opening_minute_of_day=1439,
        opening_stardate=53068.4,
    )
    assert ledger["elapsed_seconds"] == 86490
    assert ledger["ship_clock"]["display"] == "00:00:30"
    assert ledger["stardate"] == 53069.401042


def test_invalid_host_clock_is_refused_without_reading_narration():
    with pytest.raises(TimeError, match="elapsed_seconds"):
        derive_ship_time({"display": "*Stardate 99999.9 | 23:59:59 hours*"})
    with pytest.raises(TimeError, match="non-negative"):
        derive_ship_time({"elapsed_seconds": -1})
