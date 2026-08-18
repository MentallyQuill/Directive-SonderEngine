"""Compact, provider-independent causal policy for Ashes of Peace."""

from __future__ import annotations


class SimulationPolicyError(ValueError):
    pass


_POLICIES = {
    "Exploration": {
        "label": "Exploration",
        "difficulty_label": "Story-forward",
        "fatality_allowed_for_player_or_senior_staff": False,
        "summary": (
            "Consequences remain causal, but the player and senior staff have a "
            "nonfatal ceiling."
        ),
        "director_constraint": (
            "EXPLORATION MODE. Preserve competent opposition, causal failure, and lasting "
            "costs, but do not kill the player or senior staff. Where death would otherwise "
            "follow, use the strongest causally adjacent nonfatal result: severe injury, "
            "incapacitation, capture, lost position, damaged trust, or lost readiness. Do not "
            "turn failure into success, erase danger, or invent a rescue unsupported by state."
        ),
    },
    "Command": {
        "label": "Command",
        "difficulty_label": "Full simulation",
        "fatality_allowed_for_player_or_senior_staff": True,
        "summary": (
            "Full causal severity applies when established risk and the committed state support it."
        ),
        "director_constraint": (
            "COMMAND MODE. Apply full causal severity with no protagonist protection. Player, "
            "senior staff, beloved characters, and future plot utility grant no survival or "
            "success privilege. Sound preparation works when it addresses the danger; unsupported "
            "harm, hidden hazards, arbitrary punishment, softened failure, miraculous rescue, and "
            "incompetent opposition are forbidden. Resolve the outcome the committed state, "
            "demonstrated competence, available resources, and established exposure support."
        ),
    },
}


def simulation_policy(mode: str) -> dict[str, object]:
    value = _POLICIES.get(str(mode or "").strip())
    if value is None:
        raise SimulationPolicyError(f"unknown simulation mode: {mode}")
    return dict(value)
