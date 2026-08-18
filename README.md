# Directive for Sonder Engine

Directive is a native Sonder Engine extension for command-centered campaign
play. The current migration target provisions the complete authored **Ashes of
Peace** opening as one atomic Sonder story: player persona, senior staff,
opening scene, campaign/frame state, source documents, Director and narration
rules, provenance, and `actor_only` player authority.

This repository is a hard cutover. It does not embed, call, or emulate
SillyTavern, and it does not maintain a second transcript, identity system,
provider layer, checkpoint store, or world timeline beside Sonder.

## Current migration state

- Installable Sonder extension API 1 package.
- Strict Directive chat, frame, and crew-state contracts.
- Validated immutable loader for all 13 Ashes missions, ship, crew, and
  cohesion data.
- Deterministic archive compiler for one persona and seven senior officers.
- `POST /start` using exactly one `api.provision_story` call.
- Closed-candidate mission and ship settlement bound to the committing Sonder
  turn, with deterministic objectives, consequences, Command Bearing, ship
  work, capabilities, cohesion, and mission-chain transitions.
- Player-safe aggregate projection joined to Sonder identity by stable id.
- Command and Exploration simulation policies stored as campaign state and
  injected through Sonder's Director resolve context.
- Native ES-module LCARS application with creation, Campaign, Mission, Ship,
  Crew, and People views, plus the 37 package-referenced Breckenridge assets.
- Live integration proof against the pinned current Sonder checkout, including
  byte-identical database refusal for invalid turn-zero documents, extension
  UI asset serving, transactional commit-domain advancement, checkpoint rewind,
  branch carriage, and portable export/import of Directive state and documents.

Generated cohesion scheduling, people-event authoring, expanded creator assist,
adversarial secret-safety coverage, and full branch/replay round trips remain
active migration work. See
[`docs/MIGRATION_STATUS.md`](docs/MIGRATION_STATUS.md) and
[`docs/MIGRATION_RESPONSIBILITY_MATRIX.md`](docs/MIGRATION_RESPONSIBILITY_MATRIX.md).

## Development

Python 3.11 or newer and pytest 8+ are required. To exercise the live host
boundary, keep a Sonder Engine checkout beside this repository or set
`SONDER_ENGINE_ROOT` to its location.

```powershell
python -m pytest -q
python -m compileall -q directive extension.py
```

The integration suite stages this extension under a temporary directory named
`directive`; it never installs into or writes to the reference Sonder checkout.

## Reference revisions

- Directive: `06b7e3160a6c1fefe2134e5cac926843b5a0c1ee`
- Sonder Engine design baseline: `a79443b10a0872c1a3ffb3e9840232b1fd622209`
- Sonder Engine final verification: `418ab5b469ebd8682157646229ae7e5bc7aa078b`

The reference checkouts are read-only inputs. No push, publication, deployment,
or pull request is part of this migration workspace.
