# Directive UI Brand Alignment Design

## Goal

Make Directive on Sonder feel like the same software and the same brand as the current Directive product on SillyTavern. The current Directive presentation is the authority; Sonder changes the host boundary, not the product language.

## Decision

Use a presentation-contract port. Preserve Directive's shell geometry, route identity, typography, color roles, component density, icons, responsive transformations, focus treatment, and motion language. Rebuild only the data and lifecycle adapters around Sonder's supported extension facade.

Two rejected approaches define the boundary:

- Transplanting the complete SillyTavern runtime would preserve host coupling and duplicate responsibilities that Sonder owns.
- Recoloring the simplified Sonder cards would retain the wrong information architecture and would not make the products feel related.

## Authoritative Baseline

The baseline is the current source in `F:\git\Directive`, especially:

- `src/ui/directive-expanded-shell.js`
- `src/ui/directive-routes.mjs`
- `src/ui/campaign-panel.js`
- `src/ui/mission-panel.js`
- `src/ui/crew-panel.js` and `src/ui/people-journal.js`
- `src/ui/ship-panel.js` and `src/ui/ship-journal.js`
- `src/ui/settings-panel.js`
- `src/ui/runtime-ui-kit.js`
- `styles/directive.css`
- `assets/icons/directive-vector-glyphs-v1/icons/route-*.svg`

Documentation renders are visual references, but current source wins when older renders show retired routes or behavior.

## Product Shell

Directive uses five routes in this order: Campaign, Mission, People, Ship, Settings. The Sonder-only split between Crew and People is removed because it changes the product model.

Desktop and wide layouts use the Directive expanded shell:

- a narrow segmented LCARS identifier rail;
- a top bar with DIRECTIVE identity, active route path, ship time, and close action;
- a route-colored heading cap;
- one scroll-owning route workspace;
- a five-control route shelf with vector glyphs and roving keyboard focus.

Mobile uses the same route workspace and identity, but converts navigation into the fixed bottom shelf used by Directive. Controls remain at least 44 CSS pixels tall, safe-area padding is honored, and the route body owns vertical scrolling.

Sonder's `registerView`, `registerTopBarButton`, `registerSettingsSection`, `registerStepRenderer`, `chats.open`, `api`, `state`, `refresh`, and `closeView` remain the only host seams.

## Routes and Components

### Campaign

Campaign is the command surface, not a generic hero. It provides Command, Library, and Records modes with the same tab geometry as Directive. The active campaign card shows campaign title, player identity, ship, current mission, simulation mode, stardate, completion count, and current location when known. Package media uses the layered-looking framed treatment and exact campaign assets already shipped.

With no open story, Campaign contains the character-creation workflow inside the product shell. Identity, service, command profile, and review are explicit steps. All existing authoritative player fields remain required and are submitted unchanged to `/start`. Provisioning remains atomic and opens the new Sonder story through `chats.open`.

### Mission

Mission uses Directive's command-workspace hierarchy: active mission briefing, metadata cells, objective/status list, outcome record, latest transition, and Command Bearing. It does not collapse objectives into unrelated generic cards.

### People

People combines Directive crew and observed contacts in one route. Recognized Directive crew appear first. The route uses a roster-and-detail interaction: selecting a record reveals its player-safe operational detail, media, public record, duty, and department. Unknown or non-crew observations remain explicitly distinct and never acquire invented facts.

### Ship

Ship uses the Directive vessel identity header, ship media, readiness summary, cohesion segmentation, system condition records, work orders, constraints, capabilities, and cohesion priorities. System and priority records use native disclosure controls at narrow widths.

### Settings

Settings restores an in-product Directive route. It reports Directive campaign mode, authority guarantees, and host ownership. It does not duplicate Sonder's model/provider controls or create settings that no supported host API can persist.

## Visual Contract

The implementation preserves Directive's presentation tokens and relevant CSS rules from the authoritative stylesheet. Required brand invariants are:

- canvas `#05070b` with dark blue-black secondary surfaces;
- command orange `#ff9f4a`, salmon `#ef7f72`, science blue `#91a7ff`, purple route accents, cream text, and muted warm-gray copy;
- condensed uppercase labels and headings, compact body copy, and dense information grouping;
- square/clipped LCARS corners, colored edge bars, segmented rails, route caps, and inset borders;
- exact Directive vector route glyphs;
- route-specific color identity that remains consistent between desktop rail/shelf and mobile shelf;
- visible focus rings, roving route focus, Escape close, focus restoration, and reduced-motion behavior.

The stylesheet may retain portable Directive selectors even when a target route does not yet render every legacy component. SillyTavern host selectors and launcher-specific variables must not become required for the Sonder surface.

## Data and State

The UI reads one player-safe projection from `/projection`. It may maintain only ephemeral presentation state: route, campaign subview, creator step, selected person, and open disclosures. It never writes campaign truth.

Missing optional data renders an explicit empty or unavailable state. It must not synthesize names, secrets, personality, outcomes, assignments, or operational facts.

## Error Handling

Projection failure inside a non-Directive story renders the branded empty-state workspace. Campaign creation reports progress and failure in a live status region and re-enables submission after failure. Image failures retain bordered media placeholders without breaking geometry.

## Verification

Verification has four layers:

1. Node behavior tests render the real shell and routes against a complete fake Sonder projection and exercise navigation, creator steps, People selection, and disclosure behavior.
2. Contract tests prove only supported Sonder seams and player-safe routes are used.
3. Playwright runs every route at 1440x900 and 390x844, checks route order, focus, minimum control size, overflow, media, console/page/request failures, reduced motion, and representative computed brand tokens.
4. Full-page screenshots cover onboarding and all five routes at both viewports. Review compares them side by side with the authoritative Directive renders and records any intentional host-boundary difference.

`LCARS UI and interactions` may be called verified only after the screenshots and functional checks pass. Remaining unported product behavior must stay explicitly in progress.

