"""Derive Directive ship time exclusively from Sonder's simulation clock."""

from __future__ import annotations

import math
from typing import Any


DAY_SECONDS = 86_400


class TimeError(ValueError):
    pass


def _integer(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise TimeError(f"{field} must be a finite integer")
    rounded = round(value)
    if rounded != value:
        raise TimeError(f"{field} must be a finite integer")
    return rounded


def format_clock(second_of_day: int) -> str:
    second = second_of_day % DAY_SECONDS
    return f"{second // 3600:02d}:{(second % 3600) // 60:02d}:{second % 60:02d}"


def derive_ship_time(
    host_clock: Any,
    *,
    opening_minute_of_day: int = 510,
    opening_stardate: float = 53068.4,
    stardate_per_day: float = 1,
) -> dict[str, Any]:
    if not isinstance(host_clock, dict) or "elapsed_seconds" not in host_clock:
        raise TimeError("host clock elapsed_seconds is required")
    elapsed = _integer(host_clock["elapsed_seconds"], "elapsed_seconds")
    if elapsed < 0:
        raise TimeError("elapsed_seconds must be non-negative")
    opening_minute = _integer(opening_minute_of_day, "opening_minute_of_day")
    if not 0 <= opening_minute < 1440:
        raise TimeError("opening_minute_of_day is out of range")
    if not isinstance(opening_stardate, (int, float)) or not math.isfinite(opening_stardate):
        raise TimeError("opening_stardate must be finite")
    if not isinstance(stardate_per_day, (int, float)) or not math.isfinite(stardate_per_day):
        raise TimeError("stardate_per_day must be finite")
    second_of_day = ((opening_minute * 60) + elapsed) % DAY_SECONDS
    stardate = round(opening_stardate + (elapsed / DAY_SECONDS) * stardate_per_day, 6)
    return {
        "kind": "directive.timeLedger.v1",
        "elapsed_seconds": elapsed,
        "stardate": stardate,
        "ship_clock": {
            "second_of_day": second_of_day,
            "minute_of_day": second_of_day // 60,
            "display": format_clock(second_of_day),
        },
    }


def project_time(ledger: Any) -> dict[str, Any]:
    if not isinstance(ledger, dict) or ledger.get("kind") != "directive.timeLedger.v1":
        raise TimeError("accepted Directive time ledger is required")
    clock = ledger.get("ship_clock")
    if not isinstance(clock, dict):
        raise TimeError("ship_clock is required")
    second = _integer(clock.get("second_of_day"), "ship_clock.second_of_day")
    minute = _integer(clock.get("minute_of_day"), "ship_clock.minute_of_day")
    if not 0 <= second < DAY_SECONDS or minute != second // 60:
        raise TimeError("ship_clock is inconsistent")
    stardate = ledger.get("stardate")
    if not isinstance(stardate, (int, float)) or not math.isfinite(stardate):
        raise TimeError("stardate must be finite")
    return {
        "kind": "directive.timePlayerProjection.v1",
        "stardate": stardate,
        "second_of_day": second,
        "clock_display": format_clock(second),
        "stardate_display": f"{stardate:.1f}",
    }
