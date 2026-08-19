from __future__ import annotations

import importlib
import json
import sys
import tomllib
import types


def _load_as_sonder_package(repo_root, monkeypatch):
    package = types.ModuleType("sonder_ext_directive")
    package.__path__ = [str(repo_root)]
    monkeypatch.setitem(sys.modules, "sonder_ext_directive", package)
    return importlib.import_module("sonder_ext_directive.extension")


def test_manifest_declares_a_native_sonder_extension(repo_root):
    manifest = json.loads(
        (repo_root / "manifest.json").read_text(encoding="utf-8")
    )

    assert manifest["id"] == "directive"
    assert manifest["version"] == "0.2.0"
    assert manifest["ext_api"] == 1
    assert manifest["capabilities"]["python"] == "extension.py"
    assert manifest["capabilities"]["ui"] == {
        "module": "ui/index.js",
        "css": "ui/directive.css",
    }
    assert (repo_root / "ui" / "index.js").is_file()
    assert (repo_root / "ui" / "directive.css").is_file()
    assert {route["path"] for route in manifest["capabilities"]["routes"]} >= {
        "/start", "/creator-assist", "/projection",
    }


def test_register_delegates_to_supported_routes(repo_root, fake_api, monkeypatch):
    extension = _load_as_sonder_package(repo_root, monkeypatch)
    called = []
    monkeypatch.setattr(
        extension.routes,
        "register",
        lambda api: called.append(api),
    )

    extension.register(fake_api)

    assert called == [fake_api]


def test_directive_package_exposes_its_version(repo_root, monkeypatch):
    _load_as_sonder_package(repo_root, monkeypatch)
    directive = importlib.import_module("sonder_ext_directive.directive")

    assert directive.__version__ == "0.2.0"


def test_python_package_version_matches_extension_manifest(repo_root):
    manifest = json.loads((repo_root / "manifest.json").read_text(encoding="utf-8"))
    project = tomllib.loads((repo_root / "pyproject.toml").read_text(encoding="utf-8"))

    assert project["project"]["version"] == manifest["version"]
