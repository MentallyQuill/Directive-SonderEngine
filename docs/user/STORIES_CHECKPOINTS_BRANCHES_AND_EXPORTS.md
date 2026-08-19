# Stories, Checkpoints, Branches, and Exports

Directive delegates these lifecycle controls to the host, but tracks what each branch carries.

## Checkpoints

A checkpoint stores a stable, accepted snapshot with a lineage link.
It is useful as a rollback anchor.

Loading from checkpoint behavior:

- creates a cloned continuation
- preserves your original progression
- gives a fresh active continuation

## Branches and rerolls

Branching and rerolls are host-native.
In this runtime they operate on committed turns and replay through the same lineage-aware flow.

When a branch is made from an active campaign:

- Directive state and documents travel with the new branch
- old and new lineages remain distinguishable

## Export and import

Portable export/import works with matching campaign package versions.
For import:

- use host-supported one-way import flows
- verify package and version compatibility first
- do not import a file from an unknown runtime

## Export safety

State exports are snapshots of player-safe state.
Private campaign internals are not exposed as readable narrative payload in normal exports.

