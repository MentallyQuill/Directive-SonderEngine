from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pytest


@pytest.fixture
def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


@dataclass
class FakeAPI:
    routes: dict[tuple[str, str], object] = field(default_factory=dict)

    def add_route(self, path, fn, methods=("GET",)):
        for method in methods:
            self.routes[(str(method).upper(), path)] = fn


@pytest.fixture
def fake_api() -> FakeAPI:
    return FakeAPI()

