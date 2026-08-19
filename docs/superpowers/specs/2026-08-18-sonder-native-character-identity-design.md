# Sonder-Native Character Identity Design

## Goal

Make Sonder Engine the sole owner of runtime person identity while retaining
only the Directive metadata that Sonder does not model: authored campaign actor
references and Starfleet service information.

## Current problem

Directive already receives stable character ids from
`api.player_view(chat_id, viewer)["people"]` and stores its character-specific
data in `api.char_state(chat_id, char_id)`. That is the correct host boundary.

The current `directive.crewDomain.v1` nevertheless requires `crew_id`, exposes
it in the player projection, and uses it to find package media. The same package
slug is also present in the authored crew dataset, character `identity.uid`,
archive `resource_uid`, and source provenance. This makes a portable authored
reference look like a second runtime identity system.

The distinction must become explicit:

- Sonder `char_id` is the sole runtime identity.
- Directive package actor references are portable source bindings, not person
  identities.
- Directive service data is campaign metadata attached to a Sonder character.

## State contract

Newly provisioned character state uses this shape:

```json
{
  "kind": "directive.crewProfile.v2",
  "schema": 2,
  "binding": {
    "kind": "directive.packageActorBinding.v1",
    "package_id": "directive:campaign-package:breckenridge-ashes-of-peace",
    "package_version": "0.3.0-pre-alpha.2",
    "actor_ref": "mara-whitaker"
  },
  "rank": "Captain",
  "role": "Commanding Officer",
  "department": "command",
  "public_record": {},
  "operational_summary": "..."
}
```

`binding.actor_ref` is private extension configuration. It connects portable
package references such as `preferredActorIds` to the Sonder character created
for that story. It must never be emitted by the player projection or used as a
DOM selection key.

`rank`, `role`, `department`, `assignment`, `duty_status`, `public_record`, and
`operational_summary` remain Directive-owned. Sonder has no generic Starfleet
service model, and moving these values into identity or public-history fields
would blur campaign semantics with person identity.

## Provisioning and host identity

The package compiler continues supplying `resource_uid` and character-sheet
`identity.uid`. Those are inputs to Sonder's own import/matching system, not a
Directive runtime registry. Sonder assigns or reuses the numeric character id
and remaps archive participant state onto it.

The compiler seeds `directive.crewProfile.v2` directly into each participant's
`ext:directive` character state. No Directive-owned map of numeric ids is stored.

## Existing-state migration

The migration is lossless and versioned:

- Exact `directive.crewDomain.v1` values convert `crew_id` into
  `binding.actor_ref` and retain every service field.
- Exact v2 values validate and normalize without changing meaning.
- Unknown kinds, schemas, roots, duplicate actor bindings, or invalid values are
  rejected rather than guessed.
- Registration performs a best-effort migration over stories returned by
  `api.chats.mine()` and characters returned by `api.characters.in_chat()`.
  One corrupt value is logged and left untouched; it cannot prevent the
  extension or unrelated stories from loading.
- Projection remains able to read and normalize v1 state during the transition,
  so a failed persistence migration does not make a crew member disappear.

Migration changes only the extension namespace already attached to a Sonder
character. It never changes, recreates, or attempts to infer a host character.

## Package actor resolution

Authored mission documents must stay portable and therefore continue using
package actor references such as `mara-whitaker`. Numeric Sonder ids do not
exist until provisioning and may differ between installations.

A single resolver builds the runtime map:

```text
api.characters.in_chat(chat_id)
  -> CharacterHandle.char_id
  -> CharacterHandle.binding()
  -> binding.actor_ref
  -> {actor_ref: char_id}
```

The resolver rejects duplicate actor references. Callers may then translate
`preferredActorIds`, `fallbackActorIds`, command structure, media subjects, and
future assignment data at the boundary where authored content enters runtime.
No caller may join by display name.

## Player projection and UI

`create_player_projection` continues to start from Sonder's player-safe people
projection. A recognized character is joined to Directive state only by its
numeric `people[].id` through `api.char_state(chat_id, char_id)`.

The emitted `directive` object contains service fields and player-safe media,
but never `crew_id`, `actor_ref`, package ids, resource uids, or character-sheet
uids. Media is selected internally through the validated package binding.

The People UI keys selection only on `people[].id`. A `directive` object means
"Directive service profile"; absence means an observed or non-Directive person.
No label or behavior depends on `crew_id`.

## Compatibility and security

- Anonymous `body:` ids remain entirely Sonder-owned and opaque.
- Recognized identities remain Sonder numeric ids.
- Package bindings never enter player-safe DTOs.
- Missing public fields remain omitted; migration does not create defaults.
- Private character fields, psychology, secrets, and narration guidance remain
  unread by the projection.
- Branches, checkpoints, exports, imports, and character remapping continue to
  work because the profile remains in Sonder's per-character extension state.

## Verification

Tests must prove:

- strict v2 parsing and exact v1-to-v2 migration;
- migration preserves every optional service field;
- registration migrates owned stories through Sonder character handles and
  isolates corrupt records;
- duplicate package actor bindings fail deterministically;
- package actor references resolve to current Sonder numeric ids after import;
- projection contains no `crew_id`, `actor_ref`, package id, resource uid, or
  identity uid;
- duplicate display names and renamed characters still join correctly by id;
- the People UI renders Directive profiles without `crew_id`;
- current-Sonder integration, archive/branch/checkpoint tests, and the full live
  Playwright route suite remain green.

