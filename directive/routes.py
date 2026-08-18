"""Directive's supported Sonder route registrations."""

from .campaign.compiler import PlayerSetup, ProvisioningError, compile_ashes_archive
from .campaign.source import load_ashes_source
from .state.contracts import PACKAGE_ID, PACKAGE_VERSION


def register(api):
    """Register Directive only through the public Sonder extension facade."""
    api.add_route("/start", lambda request: _start(api, request), methods=("POST",))


def _start(api, request):
    body = request.body
    if not isinstance(body, dict):
        raise ProvisioningError("player setup must be an object")
    player = PlayerSetup.from_dict(body)
    bundle = compile_ashes_archive(load_ashes_source(), player)
    result = api.provision_story(
        bundle.archive,
        **bundle.provision_kwargs(),
    )
    return {
        **result,
        "directive": {
            "package_id": PACKAGE_ID,
            "package_version": PACKAGE_VERSION,
        },
    }
