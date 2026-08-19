"""Bounded, player-triggered drafting for one Character Creator section."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .campaign.source import load_ashes_source


_SECTIONS = {
    "identity": (
        "identity.name", "identity.pronounsOrAddress", "identity.speciesId",
        "identity.ageBandId", "identity.appearance",
    ),
    "service": (
        "service.careerBackgroundId", "service.formativeExperienceId",
        "service.assignmentReasonId", "dossier.serviceSummary",
    ),
    "personality": (
        "personality.traits.insight", "personality.traits.connection",
        "personality.traits.execution", "personality.flawId", "dossier.traits",
    ),
    "review": ("dossier.briefBiography", "dossier.publicReputation"),
}
_INPUT_PATHS = {
    "name": "identity.name",
    "pronouns_or_address": "identity.pronounsOrAddress",
    "species": "identity.speciesId",
    "age_band": "identity.ageBandId",
    "appearance": "identity.appearance",
    "career_background": "service.careerBackgroundId",
    "formative_experience": "service.formativeExperienceId",
    "assignment_reason": "service.assignmentReasonId",
    "insight_trait": "personality.traits.insight",
    "connection_trait": "personality.traits.connection",
    "execution_trait": "personality.traits.execution",
    "flaw": "personality.flawId",
    "service_summary": "dossier.serviceSummary",
    "command_style": "dossier.traits",
    "brief_biography": "dossier.briefBiography",
    "public_reputation": "dossier.publicReputation",
}
_OPTION_PATHS = {
    "identity.speciesId": "allowedSpecies",
    "identity.ageBandId": "ageBands",
    "service.careerBackgroundId": "careerBackgrounds",
    "service.formativeExperienceId": "formativeExperiences",
    "service.assignmentReasonId": "assignmentReasons",
}
_TRAIT_PATHS = {
    "personality.traits.insight": "insight",
    "personality.traits.connection": "connection",
    "personality.traits.execution": "execution",
}


def creator_assist(api, request, role: str) -> dict[str, Any]:
    body = request.body
    if not isinstance(body, dict):
        raise ValueError("creator assist request must be an object")
    section_id = str(body.get("section_id") or "")
    if section_id not in _SECTIONS:
        raise ValueError("section_id must be identity, service, personality, or review")
    raw_input = body.get("input") or {}
    if not isinstance(raw_input, dict):
        raise ValueError("creator assist input must be an object")

    source = load_ashes_source()
    creation = (source.campaign.get("characterCreation") or {})
    current = _normalize_input(raw_input)
    mode = "refine" if any(current.get(path) for path in _SECTIONS[section_id]) else "create"
    payload = {
        "section": section_id,
        "mode": mode,
        "current_input": current,
        "campaign_context": creation.get("campaignContext") or {},
        "locked_role": creation.get("lockedRole") or {},
        "allowed_options": _allowed_options(creation, section_id),
        "generation_rules": creation.get("generationRules") or {},
    }
    try:
        raw = api.llm_json(
            (
                "Draft only the requested Directive player Character Creator section. "
                "Return {fields:{path:value},notes:[text]}. Use only paths and option ids "
                "in the payload. Treat current_input as player-authored authority. Do not "
                "invent secrets, campaign knowledge, current-crew relationships, player "
                "dialogue, or facts outside the supplied campaign context."
            ),
            payload,
            role=role,
            temperature=0.2,
            max_tokens=1200,
        )
        fields = _sanitize_fields(raw, creation, section_id)
        if fields:
            return {
                "ok": True,
                "source": "provider",
                "mode": mode,
                "fields": fields,
                "notes": _notes(raw),
                "warnings": [],
            }
        warning = "The provider returned no usable fields; a local package draft was used."
    except Exception:
        warning = "The provider was unavailable; a local package draft was used."

    return {
        "ok": True,
        "source": "local-fallback",
        "mode": mode,
        "fields": _fallback(creation, section_id, current),
        "notes": ["Review every suggested field before applying it."],
        "warnings": [warning],
    }


def _normalize_input(raw: Mapping[str, Any]) -> dict[str, str]:
    result = {}
    allowed = {path for paths in _SECTIONS.values() for path in paths}
    for key, value in raw.items():
        path = _INPUT_PATHS.get(str(key), str(key))
        if path in allowed and isinstance(value, str) and value.strip():
            result[path] = value.strip()[:1500]
    return result


def _allowed_options(creation: Mapping[str, Any], section_id: str) -> dict[str, list[dict]]:
    result = {}
    for path in _SECTIONS[section_id]:
        if path in _OPTION_PATHS:
            result[path] = list(creation.get(_OPTION_PATHS[path]) or ())
        elif path in _TRAIT_PATHS:
            category = next(
                (item for item in creation.get("traitCategories") or () if item.get("id") == _TRAIT_PATHS[path]),
                {},
            )
            result[path] = list(category.get("options") or ())
        elif path == "personality.flawId":
            result[path] = list((creation.get("flaws") or {}).get("options") or ())
    return result


def _sanitize_fields(raw: Any, creation: Mapping[str, Any], section_id: str) -> dict[str, str]:
    values = raw.get("fields") if isinstance(raw, Mapping) else None
    if not isinstance(values, Mapping):
        return {}
    allowed = set(_SECTIONS[section_id])
    options = {
        path: {str(item.get("id")) for item in records if isinstance(item, Mapping)}
        for path, records in _allowed_options(creation, section_id).items()
    }
    result = {}
    for path, value in values.items():
        path = str(path)
        if path not in allowed or not isinstance(value, str) or not value.strip():
            continue
        cleaned = value.strip()[:1500]
        if path in options and cleaned not in options[path]:
            continue
        result[path] = cleaned
    return result


def _notes(raw: Any) -> list[str]:
    values = raw.get("notes") if isinstance(raw, Mapping) else None
    if not isinstance(values, list):
        return []
    return [item.strip()[:240] for item in values if isinstance(item, str) and item.strip()][:3]


def _fallback(creation: Mapping[str, Any], section_id: str, current: Mapping[str, str]) -> dict[str, str]:
    if section_id == "identity":
        return {
            "identity.speciesId": current.get("identity.speciesId") or "human",
            "identity.ageBandId": current.get("identity.ageBandId") or "mid-career",
        }
    if section_id == "service":
        career = current.get("service.careerBackgroundId") or "operations-logistics"
        formative = current.get("service.formativeExperienceId") or "dominion-war-fleet-service"
        assignment = current.get("service.assignmentReasonId") or "requested-by-captain"
        labels = _labels(creation)
        return {
            "service.careerBackgroundId": career,
            "service.formativeExperienceId": formative,
            "service.assignmentReasonId": assignment,
            "dossier.serviceSummary": f"{labels.get(career, career)}; shaped by {labels.get(formative, formative)}.",
        }
    if section_id == "personality":
        insight = current.get("personality.traits.insight") or "analytical"
        connection = current.get("personality.traits.connection") or "candid"
        execution = current.get("personality.traits.execution") or "decisive"
        flaw = current.get("personality.flawId") or "guarded"
        labels = _labels(creation)
        return {
            "personality.traits.insight": insight,
            "personality.traits.connection": connection,
            "personality.traits.execution": execution,
            "personality.flawId": flaw,
            "dossier.traits": (
                f"{labels.get(insight, insight)}, {labels.get(connection, connection)}, and "
                f"{labels.get(execution, execution)}; {labels.get(flaw, flaw)} remains a pressure point."
            ),
        }
    name = current.get("identity.name")
    species = current.get("identity.speciesId")
    career = current.get("service.careerBackgroundId")
    formative = current.get("service.formativeExperienceId")
    insight = current.get("personality.traits.insight")
    connection = current.get("personality.traits.connection")
    execution = current.get("personality.traits.execution")
    flaw = current.get("personality.flawId")
    if not all((name, species, career, formative, insight, connection, execution, flaw)):
        return {}
    labels = _labels(creation)
    template = str((creation.get("localFallback") or {}).get("biographyTemplate") or "")
    reputation = str((creation.get("localFallback") or {}).get("publicReputationTemplate") or "")
    replacements = {
        "name": name, "species": labels.get(species, species),
        "careerBackground": labels.get(career, career),
        "formativeExperience": labels.get(formative, formative),
        "insightTrait": labels.get(insight, insight),
        "connectionTrait": labels.get(connection, connection),
        "executionTrait": labels.get(execution, execution),
        "flaw": labels.get(flaw, flaw),
    }
    for key, value in replacements.items():
        template = template.replace("{{" + key + "}}", value)
        reputation = reputation.replace("{{" + key + "}}", value)
    return {"dossier.briefBiography": template, "dossier.publicReputation": reputation}


def _labels(creation: Mapping[str, Any]) -> dict[str, str]:
    records = [
        *(creation.get("allowedSpecies") or ()), *(creation.get("ageBands") or ()),
        *(creation.get("careerBackgrounds") or ()), *(creation.get("formativeExperiences") or ()),
        *(creation.get("assignmentReasons") or ()), *((creation.get("flaws") or {}).get("options") or ()),
    ]
    for category in creation.get("traitCategories") or ():
        records.extend(category.get("options") or ())
    return {
        str(item.get("id")): str(item.get("label") or item.get("id"))
        for item in records if isinstance(item, Mapping) and item.get("id")
    }
