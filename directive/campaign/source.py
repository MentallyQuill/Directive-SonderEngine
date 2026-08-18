"""Validated, immutable access to the authored Ashes of Peace package."""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any

from ..state.contracts import PACKAGE_ID, PACKAGE_VERSION, StateContractError


MISSION_ORDER = (
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

_FORBIDDEN_KEYS = {
    "missionclock",
    "countdown",
    "timeadvanced",
    "deadlinewindow",
    "deadlineminutes",
    "remainingminutes",
}


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({str(key): _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _load(path: Path) -> Mapping[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StateContractError(f"cannot load authored package file {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise StateContractError(f"authored package file {path} must contain an object")
    return _freeze(value)


def _keys(value: Any) -> Iterator[str]:
    if isinstance(value, Mapping):
        for key, item in value.items():
            yield str(key)
            yield from _keys(item)
    elif isinstance(value, tuple):
        for item in value:
            yield from _keys(item)


def _unique(items: Any, label: str) -> set[str]:
    ids = [str(item.get("id") or "") for item in items]
    if not ids or any(not item for item in ids):
        raise StateContractError(f"{label} contains an item without an id")
    if len(ids) != len(set(ids)):
        raise StateContractError(f"{label} contains duplicate ids")
    return set(ids)


@dataclass(frozen=True)
class AshesSource:
    root: Path
    campaign: Mapping[str, Any]
    missions: tuple[Mapping[str, Any], ...]
    ship: Mapping[str, Any]
    crew: Mapping[str, Any]
    cohesion: Mapping[str, Any]

    def documents(self) -> tuple[Mapping[str, Any], ...]:
        return (self.campaign, *self.missions, self.ship, self.crew, self.cohesion)

    def validate(self) -> None:
        manifest = self.campaign.get("manifest") or {}
        if manifest.get("id") != PACKAGE_ID:
            raise StateContractError("campaign manifest id does not match Ashes")
        if manifest.get("version") != PACKAGE_VERSION:
            raise StateContractError("campaign manifest version does not match Ashes")
        if manifest.get("openingMissionId") != MISSION_ORDER[0]:
            raise StateContractError("campaign opening mission is not the authored prelude")

        source_ids = tuple(
            str((mission.get("packageBinding") or {}).get("sourceId") or "")
            for mission in self.missions
        )
        if source_ids != MISSION_ORDER:
            raise StateContractError("mission files do not match the authored journey order")

        for mission in self.missions:
            binding = mission.get("packageBinding") or {}
            if binding.get("packageId") != PACKAGE_ID:
                raise StateContractError(f"mission {mission.get('id')} has the wrong package id")
            if binding.get("packageVersion") != PACKAGE_VERSION:
                raise StateContractError(f"mission {mission.get('id')} has the wrong package version")
            targets: set[str] = set()
            for field in ("facts", "events", "outcomes", "objectives"):
                values = mission.get(field) or ()
                if values:
                    targets.update(_unique(values, f"{mission.get('id')} {field}"))
            policies = mission.get("evidencePolicies") or ()
            if policies:
                _unique(policies, f"{mission.get('id')} evidencePolicies")
            for policy in policies:
                if policy.get("targetId") not in targets:
                    raise StateContractError(
                        f"evidence policy {policy.get('id')} targets an unknown semantic id"
                    )

        officers = self.crew.get("officers") or ()
        if len(_unique(officers, "crew officers")) != 7:
            raise StateContractError("Ashes must contain the seven authored senior officers")
        for label, document in (
            ("ship", self.ship),
            ("crew", self.crew),
        ):
            if (document.get("manifest") or {}).get("packageId") != PACKAGE_ID:
                raise StateContractError(f"{label} dataset has the wrong package id")
        if self.cohesion.get("packageId") != PACKAGE_ID:
            raise StateContractError("cohesion catalog has the wrong package id")

        normalized = {
            key.casefold().replace("_", "").replace("-", "")
            for document in self.documents()
            for key in _keys(document)
        }
        retired = sorted(normalized & _FORBIDDEN_KEYS)
        if retired:
            raise StateContractError(
                f"authored package retains retired countdown keys: {', '.join(retired)}"
            )


def load_ashes_source(root: Path | None = None) -> AshesSource:
    package_root = (
        Path(root)
        if root is not None
        else Path(__file__).resolve().parents[2] / "packages" / "ashes-of-peace"
    )
    missions = tuple(
        _load(package_root / "missions" / f"{mission_id}.mission-v1.json")
        for mission_id in MISSION_ORDER
    )
    source = AshesSource(
        root=package_root,
        campaign=_load(package_root / "campaign.json"),
        missions=missions,
        ship=_load(package_root / "ship.json"),
        crew=_load(package_root / "crew.json"),
        cohesion=_load(package_root / "cohesion.json"),
    )
    source.validate()
    return source
