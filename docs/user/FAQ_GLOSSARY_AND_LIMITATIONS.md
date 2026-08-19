# FAQ, Glossary, and Known Limitations

## FAQ

### Is this the same as old SillyTavern Directive?
No. This is a native Sonder runtime with new host ownership for commits and storage.

### Which campaign is live?
`Ashes of Peace` is the live playable package.

### Do I need a provider key in Directive?
No. Provider credentials stay in your host.

### Are swipes the same?
Host behavior can still present alternatives, but there is no separate second persisted turn timeline.

### Will missing information appear later automatically?
Directive shows only proven, known information from accepted state.

## Glossary

Committed turn: The point where a player message and system settlement are durably accepted.  
Sonder lineage: The identity chain that preserves active history and branch ancestry.  
Projection: The player-facing snapshot assembled for UI screens.  
Command Bearing: A bounded reserve tied to meaningful command outcomes.  
Cohesion: Mission-readiness score that shifts with resolved assignments.  
Simulation mode: Gameplay severity profile selected at commissioning.

## Known limitations

- only `Ashes of Peace` is fully playable
- campaign library actions (save/load/delete) may be partially available depending on host finish
- command-bearing spend UI actions are evolving
- manual save editing is unsupported
- legacy migration from SillyTavern is one-way or not yet implemented

