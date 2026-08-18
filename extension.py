"""Sonder Engine entry point for Directive."""

from .directive import routes


def register(api):
    """Register Directive through supported Sonder extension surfaces."""
    routes.register(api)

