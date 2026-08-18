"""Directive's supported Sonder route registrations."""

from .campaign.compiler import PlayerSetup, ProvisioningError, compile_ashes_archive
from .campaign.source import load_ashes_source
from .projection.player import create_player_projection
from .settlement import service as settlement
from .state.contracts import PACKAGE_ID, PACKAGE_VERSION


def register(api):
    """Register Directive only through the public Sonder extension facade."""
    api.add_route("/start", lambda request: _start(api, request), methods=("POST",))
    api.add_route(
        "/projection",
        lambda request: _projection(api, request),
        methods=("GET",),
    )
    settlement.register(api)


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


def _projection(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return create_player_projection(api, request.chat_id)
