# Moving from Directive for SillyTavern to Directive for Sonder

This is a hard migration.

## What changes at a high level

SillyTavern-specific layers are replaced by native Sonder ownership.
That means:

- no SillyTavern preset install path inside Directive
- no SillyTavern draft-until-next-message save boundary
- host-native checkpoints, branches, variants, and model settings
- native projection and committed-turn authority in lieu of SillyTavern accepted-pair only

## What does not convert

There is no complete legacy-save importer in the native core yet.
Existing SillyTavern campaign data is not guaranteed to resume here.

## Migration workflow

Use this path during transition:

- keep your old SillyTavern Directive install untouched
- export or finish old campaigns in their original host
- begin a fresh Directive-on-Sonder campaign for each new play path

Do not rename or hand-copy old save artifacts.
Use host export/import only if a tested one-way path exists for your version.

