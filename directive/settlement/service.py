"""Bounded interpretation and fail-closed transactional mission settlement."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from ..campaign.source import load_ashes_source
from ..command.bearing import award
from ..mission.journey import advance_journey
from ..mission.reducer import MissionReductionError, reduce_evidence
from ..ship.mechanics import (
    SHIP_CLAIM_TYPE,
    ShipReductionError,
    derive_ship_state,
    reduce_ship_evidence,
    ship_interpretation_candidates,
)
from ..time.clock import derive_ship_time


PROPOSAL_KIND = "directive.settlementProposal.v1"
_MODEL_CLAIM_KEYS = {"policyId", "claimType", "targetId", "value"}


def _hash(value: Any) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _definition(definition_id: str):
    return next(
        (mission for mission in load_ashes_source().missions if mission.get("id") == definition_id),
        None,
    )


def _candidates(definition) -> list[dict[str, Any]]:
    return [
        {
            "policyId": policy["id"],
            "claimType": policy["claimType"],
            "targetId": policy["targetId"],
            "evidenceStandard": (policy.get("interpretation") or {}).get("evidenceStandard"),
            "guidance": (policy.get("interpretation") or {}).get("guidance"),
            "exclusions": list((policy.get("interpretation") or {}).get("exclusions") or ()),
        }
        for policy in definition.get("evidencePolicies") or ()
    ]


def _empty(reason: str) -> dict[str, Any]:
    return {"kind": PROPOSAL_KIND, "claims": [], "rejected": [reason]}


def interpret_settlement(view, api, role: str) -> dict[str, Any]:
    frame = api.frame_state(view.chat_id).get() or {}
    mission = frame.get("mission") or {}
    definition = _definition(str(mission.get("definitionId") or ""))
    if definition is None or mission.get("status") != "active":
        return _empty("no active Directive mission")
    source = load_ashes_source()
    ship = derive_ship_state(
        source.ship,
        source.cohesion,
        (frame.get("ship") or {}).get("effects") or (),
        branch_id=str(mission.get("branchId") or ""),
    )
    resolve = view.resolve if isinstance(view.resolve, dict) else {}
    source_hash = _hash(resolve)
    payload = {
        "mission": {
            "id": definition["id"],
            "version": definition["version"],
            "revision": mission["revision"],
        },
        "resolved_event": view.resolved_event,
        "state_diff": view.state_diff,
        "candidates": [
            *_candidates(definition),
            *ship_interpretation_candidates(source.ship, ship),
        ],
    }
    raw = api.llm_json(
        (
            "Select only candidate policy effects explicitly established by the final "
            "resolved event. Return {claims:[{policyId,claimType,targetId,value?}]}. "
            "Never infer from narration style, player intent, or facts outside this payload."
        ),
        payload,
        role=role,
        temperature=0,
        max_tokens=4000,
    )
    raw_claims = raw.get("claims") if isinstance(raw, dict) else None
    if not isinstance(raw_claims, list):
        return _empty("settlement model did not return a claims array")
    policies = {item["id"]: item for item in definition.get("evidencePolicies") or ()}
    ship_candidates = {
        item["policyId"]: item for item in ship_interpretation_candidates(source.ship, ship)
    }
    claims = []
    for position, item in enumerate(raw_claims):
        if not isinstance(item, dict) or set(item) - _MODEL_CLAIM_KEYS:
            return _empty(f"claim {position} has an invalid shape")
        policy = policies.get(item.get("policyId")) or ship_candidates.get(item.get("policyId"))
        if (
            policy is None
            or item.get("claimType") != policy.get("claimType")
            or item.get("targetId") != policy.get("targetId")
        ):
            return _empty(f"claim {position} is outside the closed candidate set")
        candidate_id = str(policy.get("id") or policy.get("policyId"))
        signature = f"{view.turn_id}|{source_hash}|{candidate_id}|{position}"
        claim_id = "claim." + hashlib.sha256(signature.encode("utf-8")).hexdigest()[:24]
        evidence_key = "|".join((
            mission["branchId"], str(view.turn_id), source_hash,
            policy["claimType"], policy["targetId"],
        ))
        claim = {
            "claimId": claim_id,
            "policyId": candidate_id,
            "claimType": policy["claimType"],
            "targetId": policy["targetId"],
            "evidenceKey": evidence_key,
            "sourceTurnId": str(view.turn_id),
            "sourceHash": source_hash,
            "sourceRole": "adjudicator",
        }
        if "value" in item:
            claim["value"] = item["value"]
        claims.append(claim)
    try:
        ship_claims = [item for item in claims if item["claimType"] == SHIP_CLAIM_TYPE]
        mission_claims = [item for item in claims if item["claimType"] != SHIP_CLAIM_TYPE]
        ship_reduction = reduce_ship_evidence(
            source.ship,
            source.cohesion,
            ship["effects"],
            ship_claims,
            branch_id=str(mission.get("branchId") or ""),
        )
        reduce_evidence(
            definition,
            mission,
            mission_claims,
            ship_capabilities={item["id"] for item in ship_reduction.state["capabilities"]},
        )
    except (MissionReductionError, ShipReductionError, ValueError) as exc:
        return _empty(str(exc))
    return {"kind": PROPOSAL_KIND, "claims": claims, "rejected": []}


def commit_settlement(view, api) -> dict[str, Any]:
    proposal = view.step_content("ext:directive:settlement") or {}
    if proposal.get("kind") != PROPOSAL_KIND:
        return {"applied": 0, "reason": "no validated proposal"}
    claims = proposal.get("claims") or []
    if not isinstance(claims, list) or not claims:
        return {"applied": 0, "reason": "no accepted claims"}
    expected_turn = str(view.turn_id)
    expected_hash = _hash(view.step_content("director_resolve") or {})
    if any(
        not isinstance(claim, Mapping)
        or claim.get("sourceTurnId") != expected_turn
        or claim.get("sourceHash") != expected_hash
        for claim in claims
    ):
        raise MissionReductionError("settlement proposal source does not match the committing Sonder turn")
    frame = view.frame_state.get() or {}
    mission = frame.get("mission") or {}
    definition = _definition(str(mission.get("definitionId") or ""))
    if definition is None:
        raise MissionReductionError("frame references an unknown mission definition")
    source = load_ashes_source()
    ship_claims = [item for item in claims if item.get("claimType") == SHIP_CLAIM_TYPE]
    mission_claims = [item for item in claims if item.get("claimType") != SHIP_CLAIM_TYPE]
    ship_reduction = reduce_ship_evidence(
        source.ship,
        source.cohesion,
        (frame.get("ship") or {}).get("effects") or (),
        ship_claims,
        branch_id=str(mission.get("branchId") or ""),
    )
    reduction = reduce_evidence(
        definition,
        mission,
        mission_claims,
        ship_capabilities={item["id"] for item in ship_reduction.state["capabilities"]},
    )
    next_frame = json.loads(json.dumps(frame))
    previous_settlement = frame.get("settlement") or {}
    journey = advance_journey(
        source.missions,
        reduction.state,
        previous_settlement.get("mission_history") or (),
    )
    next_frame["mission"] = journey.current
    next_frame["ship"] = {"effects": list(ship_reduction.effects)}
    next_frame["settlement"] = {
        "status": "campaign-complete" if journey.conclusion else "committed",
        "source_turn_id": expected_turn,
        "source_hash": expected_hash,
        "applied_effect_ids": [effect["id"] for effect in reduction.effects],
        "last_transition": reduction.transition_packet,
        "mission_history": list(journey.history),
        "campaign_conclusion": journey.conclusion,
    }
    bearing = (next_frame.get("command") or {}).get("bearing")
    for item in reduction.command_bearing_awards:
        awarded = award(
            bearing,
            award_id=item["id"],
            source_id=item["sourceObjectiveId"],
            reason=item["reason"],
        )
        bearing = awarded.value
    next_frame.setdefault("command", {})["bearing"] = bearing
    story = api.story_view(view.chat_id)
    campaign = load_ashes_source().campaign.get("campaign") or {}
    layout = (load_ashes_source().campaign.get("world") or {}).get("layout") or {}
    next_frame.setdefault("time", {})["ledger"] = derive_ship_time(
        story.get("clock") or {},
        opening_minute_of_day=510,
        opening_stardate=float(campaign.get("openingStardate") or 53068.4),
        stardate_per_day=float(layout.get("stardatePerDay") or 1),
    )
    view.frame_state.set(next_frame)
    return {
        "applied": len(reduction.effects) + len(ship_reduction.applied),
        "mission_revision": reduction.state["revision"],
        "transition": reduction.transition_packet,
        "advanced_to": journey.current["definitionId"] if journey.advanced else None,
    }


def player_authority_violation(result, api):
    player = (result.story_view().get("player") or {}).get("name")
    if not player:
        return None
    for line in result.resolve.get("dialogue_log") or ():
        if not isinstance(line, dict):
            continue
        speaker = str(line.get("speaker") or line.get("name") or "").strip()
        if speaker.casefold() == str(player).casefold():
            return api.correction(
                "invented-player-dialogue",
                "Remove every player dialogue line. The player alone authors their words; "
                "resolve only world and non-player response.",
                evidence={"speaker": speaker},
            )
    return None


def register(api) -> None:
    role = api.add_model_lane(
        "settlement",
        label="Directive · Settlement",
        description="Selects closed authored mission evidence from final resolved events.",
    )
    api.add_stage(
        "settlement",
        anchor="after:director_resolve",
        label="Directive · Settlement",
        handler=lambda view, live_api, nonce: interpret_settlement(view, live_api, role),
        on_error="warn",
    )
    api.add_commit_domain(
        "settlement",
        lambda view: commit_settlement(view, api),
        on_error="fail",
    )
    api.on_director_result(
        lambda result, info: player_authority_violation(result, api),
        on_error="fail",
    )
