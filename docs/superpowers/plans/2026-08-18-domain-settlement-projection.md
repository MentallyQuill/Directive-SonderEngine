# Directive Domain, Settlement, and Projection Plan

**Goal:** Move Directive's deterministic gameplay authority onto Sonder's
frame state and committed-turn transaction without recreating SillyTavern's
timeline or provider layers.

**Behavioral oracle:** current Directive source/tests at
`06b7e3160a6c1fefe2134e5cac926843b5a0c1ee`. **Host boundary:** current Sonder
extension API at `a79443b10a0872c1a3ffb3e9840232b1fd622209`.

## Task 1: Command Bearing and authoritative time

- Port the strict Command Bearing state machine as immutable Python reducers.
- Derive ship clock and Stardate from Sonder's simulation clock and the Ashes
  epoch; never parse narration as authority.
- Provide omission-safe player projections.
- Port representative current vectors and rejection cases before implementation.

## Task 2: Mission definition index and predicate evaluator

- Build a strict index over authored facts, events, outcomes, objectives,
  transitions, entry capabilities, evidence policies, and dimensions.
- Support only the current closed predicate vocabulary.
- Validate all 13 bundled missions and reject retired clock/model-owned
  operators.
- Preserve short-circuiting, reference collection, and input immutability.

## Task 3: Mission state and deterministic evidence reduction

- Create exact initial mission state from authored initial facts/outcomes and
  objective predicates.
- Accept only prevalidated closed-candidate claims carrying stable evidence
  keys and committed Sonder source ids.
- Apply claims in deterministic order, recompute objective/dimension fixpoints,
  select terminal disposition/transition by authored priority, and make replay
  idempotent.
- Store source turn/contribution ids; no prose becomes evidence by itself.

## Task 4: Sonder settlement seam and validators

- Register a fail-closed `settlement` commit domain that reads final committed
  step content, validates exact chat/frame/turn/package/revision binding, and
  writes only Directive frame state.
- Register post-floor player-authority and hidden-truth validators with
  `on_error="fail"` and structured correction evidence.
- Prove exactly one correction and still-invalid no-commit behavior against the
  current host.

## Task 5: Player-safe aggregate projection and routes

- Assemble Campaign, Mission, People, Ship, Command Bearing, and Time DTOs from
  `player_view` plus explicit Directive allowlists.
- Join crew only by stable Sonder character id; preserve opaque observed
  people and omit absent fields.
- Expose projection and action routes without returning canonical private
  state.

## Task 6: Checkpoint, reroll, branch, and archive proof

- Exercise a committed Directive effect through checkpoint, native reroll,
  branch, export, and import.
- Assert frame state, character joins, documents, provenance, source bindings,
  and Command Bearing rebuild semantics follow retained Sonder lineage.
- Update the responsibility matrix only for executable verified coverage.
