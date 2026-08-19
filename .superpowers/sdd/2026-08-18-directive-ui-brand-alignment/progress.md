# SDD ledger — plan: docs/superpowers/plans/2026-08-18-directive-ui-brand-alignment.md

Workspace note: the bundled bash helpers could not start under the Windows sandbox, so the controller created equivalent plan-scoped artifacts directly.

## Preflight interface scan

| Task(s) | Producer / consumer or internal check | Finding |
| --- | --- | --- |
| 1 | Shell tests specify `DIRECTIVE_ROUTES`, `createDirectiveShell`, `setShellRoute`, then implementation produces them | Consistent |
| 1 -> 2 | Task 1 produces shell and DOM helpers; Task 2 consumes both | Consistent |
| 1 -> 3 | Task 1 produces shell route body and helpers; Task 3 consumes both | Consistent |
| 1 -> 4 | Task 1 establishes authoritative CSS; Task 4 adjusts only the Sonder bridge and portable route selectors | Consistent; final visual assertions may require scoped CSS edits |
| 2 | Campaign tests cover mode switching, creator state, and host lifecycle; production modules expose both renderers | Consistent |
| 2 -> 3 | Task 2 rewrites `ui/app.js`; Task 3 extends that controller for remaining routes | Sequential ownership is explicit |
| 2 -> 4 | Campaign and creator DOM become Playwright onboarding/Campaign inputs | Consistent |
| 3 | One literal projection covers four route renderers and omission safety | Consistent |
| 3 -> 4 | Route workspaces become Playwright Mission/People/Ship/Settings inputs | Consistent |
| 4 | Browser tests precede final responsive CSS and documents are updated only after evidence | Consistent |

Preflight result: no task conflict or spec contradiction found.

Task 1: fix round 1/5 (2 addressed, 1 new open — standards DOM and automatic route activation fixed; same-index Home/End divergence found; commits f5b7aa2..4135463)
Task 1: fix round 2/5 (1 addressed, 0 open — same-index Home/End now authoritative no-ops; commits 4135463..b112bbf)
Task 1: complete (commits b0a82b0..b112bbf, review clean)
Task 2: Ruling: project bundled ship identity through `directive/projection/player.py` rather than inferring it in the browser — preserves player-safe source authority — if wrong, the projection contract gains two unnecessary public fields.
Task 2: fix round 1/5 (8 addressed, 1 open — retry safety, authoritative ship identity, Continue, Review gate, media fallback, dataset, null metrics, and coverage fixed; Campaign tab semantics remained; commits 2178ba4..6c22493)
Task 2: fix round 2/5 (1 addressed, 0 open — Campaign tabs and panel now fully related; commits 6c22493..fb07950)
Task 2: complete (commits b112bbf..fb07950, review clean)
Task 3: fix round 1/5 (7 addressed, 0 open — production projection shapes, People structure/selection, Ship disclosure, Bearing absence, and deduplication corrected; commits 94bb6d0..2333a2c)
Task 3: complete (commits fb07950..2333a2c, review clean)
Task 4: corrective review round 1/5 (5 addressed, 0 open — source layered Campaign hero, effective Mission objective class/public facts/support, Ship mobile orbit callouts/disclosure, authoritative image comparisons, and onboarding evidence identity; commit d12f501)
Task 4: corrective review round 2/5 (2 addressed, 0 open — Ship disclosure ARIA synchronization and shipboardLife icon mapping; commit 8469bcf)
Whole branch: corrective review round 1/5 (3 addressed, 0 open — delayed-projection focus entry, modal focus containment, and source-final design/plan/report reconciliation)
