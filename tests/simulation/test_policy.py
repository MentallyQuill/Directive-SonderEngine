import pytest

from directive.simulation.policy import SimulationPolicyError, simulation_policy


def test_command_mode_preserves_full_causal_severity_without_plot_armor():
    policy = simulation_policy("Command")

    assert policy["fatality_allowed_for_player_or_senior_staff"] is True
    assert "no protagonist protection" in policy["director_constraint"].lower()
    assert "unsupported harm" in policy["director_constraint"].lower()


def test_exploration_mode_keeps_failure_but_enforces_nonfatal_ceiling():
    policy = simulation_policy("Exploration")

    assert policy["fatality_allowed_for_player_or_senior_staff"] is False
    assert "severe injury" in policy["director_constraint"].lower()
    assert "do not turn failure into success" in policy["director_constraint"].lower()


def test_unknown_mode_is_rejected_instead_of_silently_changing_difficulty():
    with pytest.raises(SimulationPolicyError, match="unknown simulation mode"):
        simulation_policy("Comfort")
