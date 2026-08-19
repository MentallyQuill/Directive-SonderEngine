"""Strict, immutable contracts for Directive's Sonder namespaces."""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping


CAMPAIGN_ID = "ashes-of-peace"
PACKAGE_ID = "directive:campaign-package:breckenridge-ashes-of-peace"
PACKAGE_VERSION = "0.3.0-pre-alpha.2"


class StateContractError(ValueError):
    """A persisted Directive value does not match its exact contract."""


def _object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise StateContractError(f"{label} must be an object")
    return value


def _roots(
    value: dict[str, Any],
    *,
    required: set[str],
    optional: set[str] | None = None,
) -> None:
    optional = optional or set()
    missing = sorted(required - value.keys())
    if missing:
        raise StateContractError(f"missing root: {', '.join(missing)}")
    unknown = sorted(value.keys() - required - optional)
    if unknown:
        raise StateContractError(f"unknown root: {', '.join(unknown)}")


def _exact(value: Any, expected: Any, field: str) -> None:
    if value != expected:
        raise StateContractError(
            f"{field} must be {expected!r}, got {value!r}"
        )


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise StateContractError(f"{field} must be non-empty text")
    return value.strip()


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze(item) for item in value)
    return value


def _thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _thaw(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw(item) for item in value]
    return value


@dataclass(frozen=True)
class CampaignConfig:
    package: Mapping[str, Any]
    settings: Mapping[str, Any]

    @classmethod
    def from_dict(cls, raw: Any) -> "CampaignConfig":
        value = _object(raw, "campaign config")
        _roots(
            value,
            required={"kind", "schema", "campaign_id", "package", "settings"},
        )
        _exact(value["kind"], "directive.campaignConfig.v1", "kind")
        _exact(value["schema"], 1, "schema")
        _exact(value["campaign_id"], CAMPAIGN_ID, "campaign_id")

        package = _object(value["package"], "package")
        _roots(package, required={"id", "version"})
        _exact(package["id"], PACKAGE_ID, "package.id")
        _exact(package["version"], PACKAGE_VERSION, "package.version")
        settings = _object(value["settings"], "settings")
        return cls(package=_freeze(package), settings=_freeze(settings))

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "directive.campaignConfig.v1",
            "schema": 1,
            "campaign_id": CAMPAIGN_ID,
            "package": _thaw(self.package),
            "settings": _thaw(self.settings),
        }


@dataclass(frozen=True)
class FrameState:
    mission: Mapping[str, Any]
    settlement: Mapping[str, Any]
    ship: Mapping[str, Any]
    command: Mapping[str, Any]
    time: Mapping[str, Any]

    @classmethod
    def from_dict(cls, raw: Any) -> "FrameState":
        value = _object(raw, "frame state")
        roots = {
            "kind",
            "schema",
            "campaign_id",
            "package_version",
            "mission",
            "settlement",
            "ship",
            "command",
            "time",
        }
        _roots(value, required=roots)
        _exact(value["kind"], "directive.frameState.v1", "kind")
        _exact(value["schema"], 1, "schema")
        _exact(value["campaign_id"], CAMPAIGN_ID, "campaign_id")
        _exact(value["package_version"], PACKAGE_VERSION, "package_version")
        domains = {
            key: _freeze(_object(value[key], key))
            for key in ("mission", "settlement", "ship", "command", "time")
        }
        return cls(**domains)

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "directive.frameState.v1",
            "schema": 1,
            "campaign_id": CAMPAIGN_ID,
            "package_version": PACKAGE_VERSION,
            "mission": _thaw(self.mission),
            "settlement": _thaw(self.settlement),
            "ship": _thaw(self.ship),
            "command": _thaw(self.command),
            "time": _thaw(self.time),
        }


_CREW_OPTIONAL_FIELDS = {
    "assignment",
    "duty_status",
    "public_record",
    "operational_summary",
}


@dataclass(frozen=True)
class PackageActorBinding:
    package_id: str
    package_version: str
    actor_ref: str

    @classmethod
    def from_dict(cls, raw: Any) -> "PackageActorBinding":
        value = _object(raw, "package actor binding")
        _roots(
            value,
            required={
                "kind",
                "package_id",
                "package_version",
                "actor_ref",
            },
        )
        _exact(
            value["kind"],
            "directive.packageActorBinding.v1",
            "binding.kind",
        )
        _exact(value["package_id"], PACKAGE_ID, "binding.package_id")
        _exact(
            value["package_version"],
            PACKAGE_VERSION,
            "binding.package_version",
        )
        return cls(
            package_id=PACKAGE_ID,
            package_version=PACKAGE_VERSION,
            actor_ref=_text(value["actor_ref"], "binding.actor_ref"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "directive.packageActorBinding.v1",
            "package_id": self.package_id,
            "package_version": self.package_version,
            "actor_ref": self.actor_ref,
        }


@dataclass(frozen=True)
class CrewProfile:
    binding: PackageActorBinding
    rank: str
    role: str
    department: str
    assignment: str | None = None
    duty_status: str | None = None
    public_record: Mapping[str, Any] | None = None
    operational_summary: str | None = None

    @classmethod
    def from_dict(cls, raw: Any) -> "CrewProfile":
        value = _object(raw, "crew profile")
        required = {
            "kind",
            "schema",
            "binding",
            "rank",
            "role",
            "department",
        }
        _roots(value, required=required, optional=_CREW_OPTIONAL_FIELDS)
        _exact(value["kind"], "directive.crewProfile.v2", "kind")
        _exact(value["schema"], 2, "schema")

        kwargs: dict[str, Any] = {
            "binding": PackageActorBinding.from_dict(value["binding"]),
            "rank": _text(value["rank"], "rank"),
            "role": _text(value["role"], "role"),
            "department": _text(value["department"], "department"),
        }
        for field in ("assignment", "duty_status", "operational_summary"):
            if field in value:
                kwargs[field] = _text(value[field], field)
        if "public_record" in value:
            kwargs["public_record"] = _freeze(
                _object(value["public_record"], "public_record")
            )
        return cls(**kwargs)

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "kind": "directive.crewProfile.v2",
            "schema": 2,
            "binding": self.binding.to_dict(),
            "rank": self.rank,
            "role": self.role,
            "department": self.department,
        }
        for field in ("assignment", "duty_status", "operational_summary"):
            item = getattr(self, field)
            if item is not None:
                value[field] = item
        if self.public_record is not None:
            value["public_record"] = _thaw(self.public_record)
        return value

    def to_public_dict(self) -> dict[str, Any]:
        value = self.to_dict()
        return {
            key: item
            for key, item in value.items()
            if key not in {"kind", "schema", "binding"}
        }


def migrate_crew_profile(raw: Any) -> dict[str, Any]:
    value = _object(raw, "crew profile")
    if (
        value.get("kind") == "directive.crewProfile.v2"
        and value.get("schema") == 2
    ):
        return CrewProfile.from_dict(value).to_dict()

    if (
        value.get("kind") == "directive.crewDomain.v1"
        and value.get("schema") == 1
    ):
        required = {
            "kind",
            "schema",
            "crew_id",
            "rank",
            "role",
            "department",
        }
        _roots(value, required=required, optional=_CREW_OPTIONAL_FIELDS)
        migrated = {
            "kind": "directive.crewProfile.v2",
            "schema": 2,
            "binding": {
                "kind": "directive.packageActorBinding.v1",
                "package_id": PACKAGE_ID,
                "package_version": PACKAGE_VERSION,
                "actor_ref": _text(value["crew_id"], "crew_id"),
            },
            "rank": value["rank"],
            "role": value["role"],
            "department": value["department"],
        }
        migrated.update({
            field: value[field]
            for field in _CREW_OPTIONAL_FIELDS
            if field in value
        })
        return CrewProfile.from_dict(migrated).to_dict()

    raise StateContractError(
        "unsupported crew profile kind/schema: "
        f"{value.get('kind')!r}/{value.get('schema')!r}"
    )
