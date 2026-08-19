"""Directive's supported Sonder route registrations."""

from .campaign.compiler import PlayerSetup, ProvisioningError, compile_ashes_archive
from .campaign.source import load_ashes_source
from .campaign.timeline import register_saved_game, unregister_saved_game
from .command.service import (
    bind_pending_edge_to_generation,
    cancel_command_bearing_edge,
    reserve_command_bearing_cohesion_relief,
    reserve_command_bearing_edge,
)
from .people.bindings import migrate_registered_crew_profiles
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
    api.add_route(
        "/saves",
        lambda request: _register_save(api, request),
        methods=("POST",),
    )
    api.add_route(
        "/saves",
        lambda request: _unregister_save(api, request),
        methods=("DELETE",),
    )
    api.add_route(
        "/command-bearing/edge",
        lambda request: _reserve_command_bearing(api, request),
        methods=("POST",),
    )
    api.add_route(
        "/command-bearing/edge",
        lambda request: _cancel_command_bearing(api, request),
        methods=("DELETE",),
    )
    api.add_route(
        "/command-bearing/cohesion",
        lambda request: _reserve_command_bearing_cohesion(api, request),
        methods=("POST",),
    )
    api.add_route(
        "/command-bearing/cohesion",
        lambda request: _cancel_command_bearing(api, request),
        methods=("DELETE",),
    )
    director_payload = getattr(api, "on_director_payload", None)
    if callable(director_payload):
        director_payload(
            lambda payload, info: bind_pending_edge_to_generation(payload, info, api)
        )
    settlement.register(api)
    migrate_registered_crew_profiles(api)


def _start(api, request):
    body = request.body
    if not isinstance(body, dict):
        raise ProvisioningError("player setup must be an object")
    values = dict(body)
    simulation_mode = values.pop("simulation_mode", "Command")
    player = PlayerSetup.from_dict(values)
    bundle = compile_ashes_archive(
        load_ashes_source(), player, simulation_mode=simulation_mode
    )
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


def _register_save(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return register_saved_game(api, request.chat_id, request.body)


def _unregister_save(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return unregister_saved_game(api, request.chat_id, request.query)


def _reserve_command_bearing(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return reserve_command_bearing_edge(api, request.chat_id)


def _cancel_command_bearing(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return cancel_command_bearing_edge(api, request.chat_id)


def _reserve_command_bearing_cohesion(api, request):
    if request.chat_id is None:
        raise ValueError("chat_id is required")
    return reserve_command_bearing_cohesion_relief(api, request.chat_id, request.body)
