"""Compile Directive's authored campaign into Sonder's portable story boundary.

This module deliberately imports no Sonder code.  It translates authored
Directive data into the public archive and provisioning contracts so the
translation remains deterministic, serialisable, and independently testable.
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from ..command.bearing import create_bearing
from ..mission.state import create_mission_state
from ..state.contracts import (
    CAMPAIGN_ID,
    PACKAGE_ID,
    PACKAGE_VERSION,
    CampaignConfig,
    CrewDomain,
    FrameState,
)
from ..time.clock import derive_ship_time
from .source import AshesSource, MISSION_ORDER


class ProvisioningError(ValueError):
    """Player setup or authored data cannot produce a complete story."""


_PLAYER_FIELDS = (
    "name",
    "pronouns_or_address",
    "species",
    "age_band",
    "appearance",
    "career_background",
    "formative_experience",
    "assignment_reason",
    "insight_trait",
    "connection_trait",
    "execution_trait",
    "flaw",
)


def _plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _plain(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_plain(item) for item in value]
    return copy.deepcopy(value)


def _required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProvisioningError(f"{field} must be non-empty text")
    return value.strip()


@dataclass(frozen=True)
class PlayerSetup:
    name: str
    pronouns_or_address: str
    species: str
    age_band: str
    appearance: str
    career_background: str
    formative_experience: str
    assignment_reason: str
    insight_trait: str
    connection_trait: str
    execution_trait: str
    flaw: str

    @classmethod
    def from_dict(cls, raw: Any) -> "PlayerSetup":
        if not isinstance(raw, dict):
            raise ProvisioningError("player setup must be an object")
        missing = [field for field in _PLAYER_FIELDS if field not in raw]
        if missing:
            raise ProvisioningError(f"missing player field: {', '.join(missing)}")
        unknown = sorted(set(raw) - set(_PLAYER_FIELDS))
        if unknown:
            raise ProvisioningError(f"unknown player field: {', '.join(unknown)}")
        return cls(**{
            field: _required_text(raw[field], field)
            for field in _PLAYER_FIELDS
        })

    def to_dict(self) -> dict[str, str]:
        return {field: getattr(self, field) for field in _PLAYER_FIELDS}


@dataclass(frozen=True)
class ProvisioningBundle:
    archive: dict[str, Any]
    state: dict[str, Any]
    frame_state: dict[str, Any]
    director_context: dict[str, str]
    narration_context: str
    documents: dict[str, Any]

    def provision_kwargs(self) -> dict[str, Any]:
        return copy.deepcopy({
            "state": self.state,
            "frame_state": self.frame_state,
            "package_id": PACKAGE_ID,
            "package_version": PACKAGE_VERSION,
            "player_authority": "actor_only",
            "director_context": self.director_context,
            "narration_context": self.narration_context,
            "documents": self.documents,
        })


def _resource_uid(prefix: str, value: Any) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]
    return f"directive-{prefix}-{digest}"


def _pronouns(value: str) -> dict[str, str]:
    known = {
        "they/them": {"subject": "they", "object": "them", "possessive": "their"},
        "she/her": {"subject": "she", "object": "her", "possessive": "her"},
        "he/him": {"subject": "he", "object": "him", "possessive": "his"},
    }
    return known.get(value.casefold(), {})


def _persona(player: PlayerSetup) -> dict[str, Any]:
    data = player.to_dict()
    identity: dict[str, Any] = {
        "uid": _resource_uid("persona-sheet", data),
        "name": player.name,
        "aliases": [],
    }
    parsed_pronouns = _pronouns(player.pronouns_or_address)
    if parsed_pronouns:
        identity["pronouns"] = parsed_pronouns
    return {
        "identity": identity,
        "embodiment": {"visible": {"summary": player.appearance}},
        "competence": {"abilities": []},
        "knowledge": {
            "public_history": (
                f"{player.name} is a {player.species} Starfleet Commander assigned "
                "as executive officer of the U.S.S. Breckenridge."
            ),
            "private_history": [
                {"content": player.career_background, "about": "career background", "known_by": []},
                {"content": player.formative_experience, "about": "formative experience", "known_by": []},
                {"content": player.assignment_reason, "about": "assignment reason", "known_by": []},
            ],
        },
        "narration": {"voice_setting": player.pronouns_or_address},
    }


def _campaign_roles(source: AshesSource) -> dict[str, str]:
    senior = (source.campaign.get("crew") or {}).get("senior") or ()
    return {
        str(item.get("id")): str(item.get("packageRole") or "")
        for item in senior
        if isinstance(item, Mapping)
    }


def _crew_sheet(officer: Mapping[str, Any], package_role: str) -> dict[str, Any]:
    guide = officer.get("narrationGuide") or {}
    constraints = [str(item) for item in guide.get("constraints") or ()]
    return {
        "identity": {
            "uid": f"directive-crew-{officer['id']}",
            "name": str(officer["name"]),
            "aliases": [],
        },
        # The source does not author physical appearance.  Empty is truthful;
        # the UI and player projection must omit it instead of inventing one.
        "embodiment": {"visible": {"summary": ""}},
        "psychology": {
            "traits": [],
            "values": [],
            "drive": {
                "essence": package_role,
                "expression": "",
                "taboo": "",
            },
        },
        "social": {
            "voice": {
                "register": "",
                "cadence": "",
                "verbosity": "natural",
                "markers": [],
                "notes": str(guide.get("voice") or ""),
            },
            "interaction_constraints": constraints,
        },
        "knowledge": {
            "access_tags": ["common"],
            "public_history": str(officer.get("profileSummary") or ""),
            "private_history": [],
        },
    }


def _crew_domain(officer: Mapping[str, Any]) -> dict[str, Any]:
    service = officer.get("service") or {}
    return CrewDomain.from_dict({
        "kind": "directive.crewDomain.v1",
        "schema": 1,
        "crew_id": str(officer["id"]),
        "rank": str(service.get("rankLabel") or ""),
        "role": str(officer.get("billet") or ""),
        "department": str(service.get("department") or ""),
        "public_record": _plain(officer.get("publicRecord") or {}),
        "operational_summary": str(officer.get("profileSummary") or ""),
    }).to_dict()


def _scene(player: PlayerSetup) -> dict[str, Any]:
    return {
        "location": "U.S.S. Breckenridge",
        "time": "0830",
        "rooms": {
            "ready-room-threshold": {
                "name": "Captain's Ready Room Threshold",
                "notes": "Outside Captain Whitaker's ready room.",
                "adjacent": {"ready-room": {"barrier": "closed_door"}},
            },
            "ready-room": {
                "name": "Captain's Ready Room",
                "notes": "Captain Whitaker's ready room aboard the Breckenridge.",
                "adjacent": {"ready-room-threshold": {"barrier": "closed_door"}},
            },
        },
        "positions": {
            player.name: "ready-room-threshold",
            "Mara Whitaker": "ready-room",
        },
        "entities": {},
    }


def _documents(source: AshesSource, player: PlayerSetup) -> dict[str, Any]:
    documents: dict[str, Any] = {"package/campaign": _plain(source.campaign)}
    for mission_id, mission in zip(MISSION_ORDER, source.missions, strict=True):
        documents[f"package/missions/{mission_id}"] = _plain(mission)
    documents.update({
        "package/ship": _plain(source.ship),
        "package/crew": _plain(source.crew),
        "package/cohesion": _plain(source.cohesion),
        "player/profile": player.to_dict(),
    })
    return documents


def _contexts(source: AshesSource) -> tuple[dict[str, str], str]:
    campaign = source.campaign.get("campaign") or {}
    opening = campaign.get("openingContext") or {}
    first_guidance = "\n".join(
        f"- {item}" for item in opening.get("firstSceneGuidance") or ()
    )
    director = {
        "establish": (
            "Use only facts present in the provisioned campaign documents and committed "
            "story state. Never supply a line, thought, feeling, or decision for the player."
        ),
        "interpret": (
            "Treat the player's text as their character's declared action and words only. "
            "Do not expand it into unstated intent, dialogue, knowledge, or outcomes."
        ),
        "resolve": (
            "Preserve actor-only player authority. Resolve world and non-player response "
            "without inventing player speech or ratifying unsupported campaign facts.\n"
            f"Opening scene rules:\n{first_guidance}"
        ),
    }
    narration = (
        "Narrate only the resolved world outcome. Never add player dialogue, thoughts, "
        "feelings, decisions, or actions that were not in the player's input. Omit player "
        "facts absent from authoritative campaign and player-profile documents."
    )
    return director, narration


def compile_ashes_archive(
    source: AshesSource,
    player: PlayerSetup,
) -> ProvisioningBundle:
    """Return the complete, atomic turn-zero input for ``provision_story``."""
    source.validate()
    roles = _campaign_roles(source)
    officers = source.crew.get("officers") or ()

    characters = []
    participants = []
    for old_id, officer in enumerate(officers, start=1):
        officer_id = str(officer.get("id") or "")
        if officer_id not in roles:
            raise ProvisioningError(f"crew {officer_id} has no authored campaign role")
        sheet = _crew_sheet(officer, roles[officer_id])
        characters.append({
            "old_id": old_id,
            "resource_uid": f"directive-crew-{officer_id}",
            "sheet": sheet,
            "source": {"format": "directive.campaign-package", "original": officer_id},
        })
        participants.append({
            "char_id": old_id,
            "status": "active",
            "state": json.dumps(
                {"ext:directive": _crew_domain(officer)},
                ensure_ascii=False,
                sort_keys=True,
            ),
        })

    persona = _persona(player)
    persona_uid = _resource_uid("persona", player.to_dict())
    campaign = source.campaign.get("campaign") or {}
    archive = {
        "version": 1,
        "chat": {
            "name": str(campaign.get("title") or "Ashes of Peace"),
            "scenario": str(campaign.get("highConcept") or ""),
        },
        "world": {
            "scene": _scene(player),
            "known": {
                player.name: [str(officer["name"]) for officer in officers],
            },
            "simulation_clock": {
                "elapsed_seconds": 0.0,
                "display": "08:30:00",
                "time_scale": "scene",
            },
        },
        "resources": {
            "persona": {
                "resource_uid": persona_uid,
                "sheet": persona,
                "source": {
                    "format": "directive.player-setup",
                    "original": PACKAGE_ID,
                },
            },
            "characters": characters,
            "extra_personas": [],
        },
        "participants": participants,
    }

    state = CampaignConfig.from_dict({
        "kind": "directive.campaignConfig.v1",
        "schema": 1,
        "campaign_id": CAMPAIGN_ID,
        "package": {"id": PACKAGE_ID, "version": PACKAGE_VERSION},
        "settings": {},
    }).to_dict()
    frame_state = FrameState.from_dict({
        "kind": "directive.frameState.v1",
        "schema": 1,
        "campaign_id": CAMPAIGN_ID,
        "package_version": PACKAGE_VERSION,
        "mission": create_mission_state(source.missions[0], branch_id="frame.root"),
        "settlement": {"status": "idle"},
        "ship": {"cohesion": 50},
        "command": {
            "player_billet": "Executive Officer",
            "player_rank": "Commander",
            "bearing": create_bearing(),
        },
        "time": {
            "year": 2376,
            "ledger": derive_ship_time(
                {"elapsed_seconds": 0},
                opening_minute_of_day=510,
                opening_stardate=53068.4,
                stardate_per_day=float(
                    (((source.campaign.get("world") or {}).get("layout") or {}).get("stardatePerDay") or 1)
                ),
            ),
        },
    }).to_dict()
    director, narration = _contexts(source)
    return ProvisioningBundle(
        archive=archive,
        state=state,
        frame_state=frame_state,
        director_context=director,
        narration_context=narration,
        documents=_documents(source, player),
    )
