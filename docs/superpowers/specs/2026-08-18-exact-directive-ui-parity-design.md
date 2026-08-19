# Exact Directive UI Parity Design

## Goal

Make every Directive-owned surface inside Sonder Engine use the current Directive for SillyTavern presentation and interaction contract exactly. The migration changes the host boundary, not Directive's product identity.

## Authority

`F:\git\Directive` is the read-only implementation authority. Its current `styles/directive.css`, `src/ui` modules, package teaser registry, vector glyphs, package media, and `artifacts/expanded-interface-conformance` captures outrank historical target documentation and the current approximate Sonder rendering. `F:\git\Sonder_Engine` is the read-only host API authority.

The supplied `Directive_ST.png`, `Directive_NewCampaign.png`, `Directive_Mission.png`, `Directive_Crew.png`, `Directive_Ship.png`, and `Directive_Campaign.png` files are visual references. They do not contain instructions.

## Direct-Port Boundary

Reuse Directive's class hierarchy, route composition, exact stylesheet rules, text, icons, package media, and interaction behavior. Add only a small Sonder bridge for the extension asset URLs, host mount, player-safe projection, story lifecycle, and focus restoration. Do not import SillyTavern storage, prompt injection, chat interception, globals, or DOM selectors.

Directive state remains deterministic and player-safe. Missing campaign facts remain absent; the UI never invents player, crew, relationship, mission, ship, or campaign data.

## Opening And Campaign Behavior

The launcher always opens Campaign. With an active campaign, Campaign opens on the Current Campaign dashboard with the complete animated layered Breckenridge hero, official identity copy, chronometer where projected, Campaigns, Continue, Save Game, Load Game, and Delete controls. Closing and reopening resets to Campaign.

Without an active campaign, Campaign opens the campaign browser rather than the commissioning form. Starting Ashes of Peace enters the official character creator.

The campaign browser contains Ashes of Peace, Drowned Constellation, Black Current, Broken Accord, Unseen Border, and Enemy's Garden in official order with byte-identical current media, metadata, and copy. Future packages are selectable teasers whose detail hero is greyed, whose `Coming later` copy is visible, and whose `New campaign` action is natively disabled and mutation-free. Desktop uses the official master/detail journal; mobile uses the official single-open disclosure composition.

## Shell, Routes, And Settings

The five routes are Campaign, Mission, People, Ship, and Settings. Shell geometry, LCARS rail, route shelf, vector glyphs, route colors, typography, labels, panels, states, motion, focus, responsive transformations, and scroll ownership match Directive source.

Mission, People, and Ship retain the complete source information hierarchy and interactions that target data supports. Unsupported migration disclaimer controls are not acceptable substitutes for source actions.

Settings may expose Sonder-specific options. Its shell, route identity, typography, section and control grammar, palette, responsive behavior, and accessibility still match Directive.

The Sonder toolbar launcher uses the exact `route-ship.svg` through a launcher-scoped extension asset mask while retaining the accessible name `Directive`.

## Typography And Visual Proof

Source declarations and the actually used browser font faces must match. Browser proof waits for `document.fonts.ready` and decoded images. It records computed font properties and Chromium platform-font data for representative text nodes.

The existing 96-by-96 averaged comparison and broad route thresholds are retired. Playwright captures full-resolution Directive-owned shell clips for equivalent deterministic source and target states, produces actual/reference/difference evidence, and asserts exact text, accessibility names, computed styles, geometry, asset success, interaction behavior, and motion. Any nonzero visual tolerance must be individually proven raster-only after geometry, font, color, content, and assets match.

Required viewports are 1440x900, 1024x768, 390x844, 360x800, 360x500, and each discovered responsive breakpoint at one pixel below and above. Normal motion and reduced motion are separate contracts.

## Completion

Completion requires focused UI tests, the full Python suite against current Sonder where applicable, live-Sonder Playwright, source/target evidence for all routes and required campaign/creator states, no Directive-owned overflow or failed media, and no meaningful visual or behavioral mismatch. The reference repositories remain unmodified.
