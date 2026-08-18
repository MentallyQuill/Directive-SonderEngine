from pathlib import Path
import hashlib
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def test_focus_management_behavior():
    subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "ui" / "focus-management.test.mjs")],
        cwd=ROOT,
        check=True,
    )


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

    assert "@media (max-width: 640px)" in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert ":focus-visible" in css
    assert ".directive-lcars-rail-segment" in css
    assert "--directive-orange: #e56f24" in css


def test_directive_shell_uses_authoritative_css_and_exact_route_glyphs():
    css = (ROOT / "ui" / "directive.css").read_text(encoding="utf-8")

    assert ".directive-expanded-shell" in css
    assert ".directive-lcars-rail" in css
    assert ".directive-workspace" in css
    assert ".directive-route-bar" in css
    assert ".directive-app" in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert ":focus-visible" in css

    icon_hashes = {
        "route-campaign.svg": "80d61a9a629c66cea1008209ec0b2aa69689771bbf97b43da01c5eda775fcb6e",
        "route-mission.svg": "0f440d132d78305c25d12b1ffcffe73ea7a0860090c47ebc0cd8291bde7f8195",
        "route-crew.svg": "bb9728005e9f468f8ffa3605fe44d2c18ef967605739fef4ab82f1af664b4fe7",
        "route-ship.svg": "ea019aa4eea710d31523c65e032a3db975e77a0c241e996e9908a7904d4234d1",
        "route-settings.svg": "b3a11a805790217566677d62abafc8ec8266c20b19d6630e2da3d30c65947a7a",
    }
    target_icons = ROOT / "assets" / "icons" / "directive-vector-glyphs-v1" / "icons"
    for name, expected_hash in icon_hashes.items():
        assert _sha256(target_icons / name) == expected_hash


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
