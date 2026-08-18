import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_every_authored_ashes_asset_reference_is_installed():
    campaign = (ROOT / "packages" / "ashes-of-peace" / "campaign.json").read_text(
        encoding="utf-8"
    )
    references = set(re.findall(r'assets/packages/breckenridge/images/[^" ]+', campaign))

    assert len(references) == 37
    missing = [path for path in sorted(references) if not (ROOT / path).is_file()]
    assert missing == []
