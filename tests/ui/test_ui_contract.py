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

    portrait_icon_hashes = {
        "upload-pc-image.svg": "c1d169f60bc1f76403a9daadf4453869924b4b8a23a98f36951627b96f202bcf",
        "remove-pc-image.svg": "dbac2fd668b119120c90917d9cd9693269f60b4d4d6a8b1662013c3a2ebc4c9b",
    }
    for name, expected_hash in portrait_icon_hashes.items():
        assert _sha256(ROOT / "assets" / "icons" / name) == expected_hash
        assert f'/api/extensions/directive/asset/assets/icons/{name}' in css


def test_campaign_library_uses_exact_official_teaser_media():
    expected = {
        "aster-vale/images/ship/uss-aster-vale.card.webp": "10b458d402e641a905ba40f7763b296760fd0dbeea3cd7462db908132f61249f",
        "aster-vale/images/ship/uss-aster-vale.hero.webp": "378cdfdb195a636dc252eaad46684e423d69108d292e520b49e692608155e47c",
        "aster-vale/images/ship/uss-aster-vale.thumb.webp": "bfd549f3955e9cfbc2057b1acb5d4fb03160eb1d17212b70008392616d503341",
        "celandine/images/ship/uss-celandine.card.webp": "c8e4d7e756da66c142d25634211dcd6061dec644657a63a8f0ee48336be3f694",
        "celandine/images/ship/uss-celandine.hero.webp": "07ee852516a85f55d346553e1f64878385cce2a9d8863c909ef621d5e42eb6e3",
        "celandine/images/ship/uss-celandine.thumb.webp": "af4dbb2ec5646dcb943847161756e14303b5cae4f07fad95e4d8a14662f0efac",
        "eudora-vale/images/ship/uss-eudora-vale.card.webp": "96ec9ea7e10219d2e0273fbf23a607e2da4d1204cf089ba7d21fe070bf1977c2",
        "eudora-vale/images/ship/uss-eudora-vale.hero.webp": "010f4766ba0567590c04bea1207334c3b10f24a3e2ca7127c1d1e9092cb85a85",
        "eudora-vale/images/ship/uss-eudora-vale.thumb.webp": "0deb76060746a0bbe0e027d06d7b10b4137fea69fee646301f090d92f77b75b5",
        "glass-harbor/images/ship/uss-glass-harbor.card.webp": "f530123525b85f67c955d2d8329605cd8a78a0688004c2780afc70a02126aa99",
        "glass-harbor/images/ship/uss-glass-harbor.hero.webp": "90ae9cd43221a804edba36d099c694d1cf27bbd1dc7eec81064f5e793d7cfe67",
        "glass-harbor/images/ship/uss-glass-harbor.thumb.webp": "d68a776c7d81dfb14341c5d3bdd05181863ca016e5d5275f2ecdc8fff46bc3d1",
        "serein/images/ship/uss-serein.card.webp": "1d1768df6df75152dc2853b296cddbc00aaf02253714c08187e9c084751b19ba",
        "serein/images/ship/uss-serein.hero.webp": "8c49ba70d91965e56e90e1c1b9d5d78cf2824164a4f3976a9360ae4e7ed5d9c7",
        "serein/images/ship/uss-serein.thumb.webp": "fe2a0ef05ed387db31d7b82012d56d073c1e50d513e1cfe9e0351dac10dd8e6a",
    }
    packages = ROOT / "assets" / "packages"
    for relative, expected_hash in expected.items():
        assert _sha256(packages / Path(relative)) == expected_hash


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
