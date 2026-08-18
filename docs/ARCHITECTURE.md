# Directive on Sonder Engine Architecture

## Reference baseline

This migration is based on these exact, remotely verified revisions:

- Directive: `06b7e3160a6c1fefe2134e5cac926843b5a0c1ee` (`main`, `MentallyQuill/Directive`)
- Sonder Engine design baseline: `a79443b10a0872c1a3ffb3e9840232b1fd622209` (`main`, `N0819/Sonder_Engine`)
- Sonder Engine final verification revision: `ba621a8211b24a5a516c3ac2b1ddbce0ebe93a53`, a direct descendant of the design baseline that arrived concurrently during the migration run
- Directive-SonderEngine: empty `main` repository before this migration

The Directive reference checkout had a pre-existing modified `debug.log` and an untracked `.codex-remote-attachments/` directory. The Sonder checkout had an untracked `docs/design/DIRECTIVE_HARDENING_REPORT.md`. They are read-only inputs and are not part of this migration. No migration commit was made in either reference repository; the final host regression ran again after Sonder advanced from the baseline to `ba621a82`.

## Product shape

Directive-SonderEngine is an installable Sonder extension, not a Sonder fork and not a SillyTavern compatibility host. It uses Sonder extension API 1 and is organized as:

```text
manifest.json                 Sonder extension manifest
extension.py                  registration and supported host seams only
directive/                    deterministic Directive domain package
  campaign/                   package compilation and campaign library
  settlement/                 closed-candidate interpretation and commitment
  mission/                    missions, evidence, objectives, consequences
  ship/                       ship systems, constraints, work and cohesion
  people/                     crew joins and Directive public projections
  command/                    Command Bearing
  time/                       Stardate and ship-time derivation
  projection/                 aggregate player-safe DTOs
packages/                     authored Ashes of Peace source data
schemas/                      Directive-owned input and state schemas
ui/                           ES-module LCARS application and CSS
assets/                       licensed product media served by Sonder
tests/                        unit, host-integration, contract and browser tests
docs/                         migration evidence and product documentation
```

No target runtime module imports SillyTavern or reaches into a SillyTavern installation.

## One owner per state concept

| Concept | Canonical owner | Directive use |
|---|---|---|
| Server, authentication, lifecycle, extension loading | Sonder | Supported manifest, registration and routes |
| Story, turns, variants, branches, checkpoints, transactions | Sonder | Read-only facades and transactional extension seams |
| Provider calls, retries, samplers and generic orchestration | Sonder | Named Directive model lanes only for bounded semantic work |
| Objective world, movement, perception, identity and disclosure | Sonder | `story_view` for rules; `player_view` for player-facing data |
| Campaign/package provenance and product rules | Directive | `api.state` plus provisioned documents |
| What happened in one era: mission, settlement, ship, time mapping | Directive | `api.frame_state`, written by fail-closed commit domains |
| Directive data attached to a person | Directive joined to Sonder identity | `api.char_state` seeded on archive participants and keyed by Sonder character id |
| UI preferences and campaign library | Directive install scope | `api.settings` and install-scoped documents |

Directive does not maintain a transcript, identity ledger, perception ledger, provider registry, checkpoint store or parallel world timeline.

## Campaign provisioning

Campaign start compiles an authored Directive package into Sonder's portable chat-archive format, including the persona, cast, rooms, scene, lore, initial clock and participant state. One `api.provision_story` call atomically creates:

- the complete Sonder story;
- `actor_only` player authority;
- Directive chat-global configuration and provenance;
- Directive frame-scoped initial campaign state;
- Director context for establish, interpret and resolve;
- narration context;
- opening Directive JSON documents;
- host characters carrying Directive crew state under `ext:directive`.

All inputs are validated before provisioning. There is no post-creation bootstrap or repair step.

## Turn and settlement flow

```text
player declaration
  -> Sonder director_interpret + player-authority floor
  -> Sonder character/perception/orchestration
  -> Sonder director_resolve + deterministic host floors
  -> Directive on_director_result validators
       -> valid: continue
       -> repairable: exactly one host-owned re-resolution
       -> still invalid under fail policy: abort before commit
  -> Directive settlement stage selects only closed authored candidates
  -> Sonder narration and perception
  -> Sonder commit transaction
       -> host state commits
       -> Directive fail-closed commit domain validates exact turn/source
       -> Directive frame state and documents commit atomically
  -> player-safe Directive projection rendered from player_view + Directive state
```

Sonder's committed turn replaces SillyTavern's accepted-pair boundary. A Sonder turn is provisional until commit. Once committed, its turn id and active lineage are the source binding. A reroll restores the pre-turn checkpoint and replays the beat; branches, deletion and rollback carry or remove Directive frame state through Sonder's native namespaced storage. Directive never implements a second accepted-message timeline.

## Evidence and model authority

The optional Directive settlement stage may call one separately configurable model lane. It receives a closed set of authored candidate ids and the final resolved event/state diff, returns structured selections, and has no state handle. Deterministic code validates package identity, mission revision, candidate id, predicates, source turn, limits and dependencies before a commit domain writes anything. Malformed or failed interpretation commits no semantic proposal.

Narration is never evidence or time authority. The final Director result and Sonder committed lineage are the source. Model output can propose an interpretation; it cannot write Directive state.

## Player authority

All Directive campaigns provision `actor_only`. Sonder deterministically downgrades player-authored effects on the world and other characters to contestable attempts without deleting the player's words.

Directive additionally registers a fail-closed post-floor validator for any surviving player dialogue. The host's `actor_only` policy remains authoritative for player action, thought, emotion, reaction, intention, and choice. The validator receives a deep-copied merged result, returns a structured correction, never mutates output, and leaves the single bounded retry to Sonder. Further campaign-secret adversarial coverage remains migration work; it is not represented here as already implemented.

## People and crew

Sonder owns identity, recognition, aliases, renamed characters, duplicate names, perception and public disclosure. Directive-owned rank, role, department, assignment, duty, command responsibility and operational summaries are stored in the corresponding participant's `ext:directive` character state.

The Crew projection begins with `api.player_view(...)["people"]`. Recognized character entries are joined by their stable Sonder `id` to `api.char_state`; observed-but-unrecognized bodies remain opaque and receive no crew join. Only explicit Directive allowlist fields are emitted. Missing values stay absent. Private history, psychology, goals, narration guidance, secrets, hidden relationships and other minds' memories are never read for the player projection.

## Time

Sonder's simulation clock is the sole generic time authority. Directive owns the deterministic mapping from that clock and the campaign epoch to ship date, clock display and Stardate, plus campaign-specific rules that constrain time-dependent mission semantics. Directive projections never parse narration footers or display strings. If a model proposes elapsed time for a Directive semantic operation, deterministic code may only validate it against the host clock; it cannot overwrite the clock.

## UI

Directive uses a Sonder ES-module entry and registered full-window view, toolbar launcher, settings section, and settlement step renderer. The LCARS application currently provides Campaign, Mission, Ship, Crew, and People routes. Campaign creation opens the resulting story through Sonder's declared chat lifecycle. Sonder retains its native controls for branching, rerolling, and narration variants rather than Directive duplicating them.

All gameplay data is fetched from Directive routes that assemble player-safe DTOs. Presentation state never writes campaign truth. The implemented surface has native button focus rings, reduced-motion rules, and mobile/desktop layouts. Live browser geometry and focus-restoration proof remains outstanding because the available browser-control runtime failed before browser binding during this migration run.

## Legacy data

Normal runtime is Sonder-native only. A SillyTavern save importer is outside the runtime architecture and cannot become a compatibility storage layer. It may be added later only as an explicit, versioned, one-way operation that reads a copied export, validates it, provisions a new Sonder story atomically and never mutates the source save. It is not required for the native migration path.

## Rejected architectures

1. **Fork Sonder Engine.** Rejected because current extension surfaces provide provisioning, transactions, validators, identity projections, documents and UI mounts; a fork would duplicate ownership and make updates expensive.
2. **Port Directive's browser runtime unchanged.** Rejected because its accepted-pair, storage, provider and host layers exist to compensate for SillyTavern and would create parallel authorities.
3. **Treat Directive as lore only.** Rejected because deterministic mission, ship, Command Bearing, settlement and player-safety rules require validated namespaced state and transactional writes.
