# Campaign Package and Asset Guide

This repository ships one active package in:

- `packages/ashes-of-peace/campaign.json`
- `packages/ashes-of-peace/crew.json`
- `packages/ashes-of-peace/cohesion.json`
- `packages/ashes-of-peace/mission/*.mission-v1.json`
- campaign media under `assets/packages/breckenridge`

## Package layout in plain terms

`campaign.json` is the source of truth for:

- package manifest
- campaign metadata
- opening context
- ship identity
- crew roster
- character-creation schema options
- world setup
- guardrails and simulation modes
- asset references

`crew.json` contains crew profile and public records by ID.

`cohesion.json` contains assignment ladders and readiness segments.

Mission files define:

- objective definitions
- evidence triggers
- outcome dimensions
- transitions

## IDs and versioning

Each campaign package is immutable by version at runtime.

Do not mix package versions inside one active campaign.
Projection and acceptance checks require package and version alignment.

## Asset references

Asset records are package-relative.

Use resolved and local paths under `assets/packages/...`.
Do not reference external files directly for gameplay-critical mission assets.

## Adding new assets

For new campaign work:

- add files under `assets/packages/<campaign-id>/...`
- keep alt text and fallback variants where practical
- ensure shipped media is available in the package path

## Validation habits

Before ship:

- validate JSON schemas
- validate mission IDs and transitions
- validate image paths
- run the project’s local validation and narrative contract tests

## Packaging discipline

Keep source references and runtime package data aligned.
If campaign docs change, campaign data must be updated intentionally and atomically.
