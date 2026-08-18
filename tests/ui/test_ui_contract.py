from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_ui_uses_only_sonder_mounts_and_extension_routes():
    index = (ROOT / "ui" / "index.js").read_text(encoding="utf-8")
    app = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")

    for contract in (
        "registerView", "registerTopBarButton", "registerSettingsSection",
        "registerStepRenderer",
    ):
        assert contract in index
    assert "/api/extensions/directive/x/projection" in app
    assert "/api/extensions/directive/x/start" in app
    assert "sonder.chats.open" in app
    assert "innerHTML" not in index + app
    assert "fetch(" not in index + app


def test_creator_collects_every_authoritative_player_field():
    app = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
    for field in (
        "name", "pronouns_or_address", "species", "age_band", "appearance",
        "career_background", "formative_experience", "assignment_reason",
        "insight_trait", "connection_trait", "execution_trait", "flaw",
    ):
        assert f'["{field}"' in app
    assert 'name: "simulation_mode"' in app
    assert 'value: "Command"' in app
    assert 'value: "Exploration"' in app


def test_lcars_surface_has_mobile_focus_and_reduced_motion_contracts():
    css = (ROOT / "ui" / "directive.css").read_text(encoding="utf-8")

    assert "@media (max-width: 720px)" in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert ":focus-visible" in css
    assert ".directive-segments" in css
    assert "--directive-orange: #f2a126" in css
