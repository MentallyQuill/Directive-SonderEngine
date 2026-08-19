# Campaign Authoring Guide

Authoring for Directive should describe what the story must know, not how to prose it.

## Start with durable design

Before writing scenes, define:

- story premise
- mission sequence
- recurring cast and roles
- world limitations

Mission flow should be state-safe: visible fact, discoverable fact, hidden fact, and outcome consequences.

## Author mission logic

Use these authoring blocks per mission:

1. player-facing mission statement
2. required/optional/conditional objectives
3. evidence triggers for each objective
4. terminal outcomes and partial progress outcomes
5. transition map and next mission target
6. support routes through people and ship systems
7. outcome text that is human-readable and deterministic

## Keep evidence concrete

Do not rely on keywords to infer hidden outcomes.
Express acceptance intent as scenario-level meaning:

- what must be accepted in prose
- what is a near miss
- what is invalid for this story state

## People and mission fairness

Optional objectives should never punish unaware players.
If a critical truth matters, ensure at least one contact or mission path can present it.

## Ship and operations

For each mission, define:

- assignment constraints
- work phases
- cohesion impact
- capability gains and risks

## Command Bearing authoring

Awarding Command Bearing should be explicit:

- linked objective path
- terminal conditions
- short reason text
- maximum one point per optional objective

## Authoring quality bar

A campaign package is ready for play when it has:

- schema compliance
- objective graph consistency
- transition coverage
- negative case coverage for key failure and informed-failure paths

This migration currently ships one playable package; additional packages should follow the same structure and test checks.

