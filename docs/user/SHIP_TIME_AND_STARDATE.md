# Ship Time and Stardate

Directive uses host simulation time as base truth.
Sonder’s clock drives ship-time and Stardate projection.

## The rule of one clock

Do not rely on narrated footer text to become law.
The clock and stardate shown in Mission are derived from committed game state and host timeline.

## What each time field means

Ship clock:

- your local progression display in story view
- useful for pace and sequence checks

Stardate:

- campaign canonical date marker
- displayed as an easy-facing timeline value
- mapped through campaign-defined starting values and step rules

## Why this matters

Mission logic uses the same deterministic clock used by settlement.
This avoids drift between narration wording and rules.

