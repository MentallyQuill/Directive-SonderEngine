# What is Directive on Sonder Engine

Directive on Sonder Engine is the same command-first design with a new host.

Sonder now owns conversation timeline, rerolls, branches, model routing, and auth.
Directive owns campaign rules and projections.
That split gives better story consistency and removes the duplicated SillyTavern save/overlay model.

Directive adds:

- campaign commissioning and one-time story provisioning
- mission rules, objective state, outcomes, and transition control
- ship operations, systems, cohesion, and assignment state
- people records for recognized contacts
- Command Bearing reserve tracking and outcome effects
- player-safe projections that drive the LCARS views

Sonder owns:

- host chat lifecycle
- model calls and model credentials
- commit history, branches, variants, and checkpoints
- message storage and message-level branching behavior
- user identity and permission boundaries

In this version, Directive runs as a native extension.
You should not assume any SillyTavern-only behavior exists here.

