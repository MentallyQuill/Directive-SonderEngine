import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createDirectiveView } from "../../ui/app.js";
import { renderMissionView } from "../../ui/views/mission.js";
import { renderPeopleView } from "../../ui/views/people.js";
import { renderSettingsView } from "../../ui/views/settings.js";
import { renderShipView } from "../../ui/views/ship.js";

const PROJECTION = Object.freeze({
  kind: "directive.playerProjection.v1",
  schema: 1,
  chat_id: 27,
  campaign: { id: "ashes-of-peace", title: "Ashes of Peace", simulation_mode: "Exploration" },
  media: {
    ship: { kind: "ship.hero", alt: "U.S.S. Breckenridge underway", variants: { hero: "/breckenridge.webp", cohesion: "/breckenridge-cohesion.png" } },
    location: { kind: "location.hero", alt: "Asterion Station", variants: { card: "/asterion.webp" } },
  },
  viewer: { id: "player", name: "Avery Quill", kind: "player" },
  player: {
    id: "player",
    name: "Avery Quill",
    pronouns_or_address: "they/them",
    species: "Human",
    age_band: "mid-career",
    appearance: "Close-cropped dark hair and a crisp command uniform.",
    service: {
      organization: "starfleet",
      department: "command",
      rank_code: "commander",
      rank_label: "Commander",
    },
    billet: "Executive Officer",
    role: "Principal mission commander and coordinator of shipboard operations.",
  },
  mission: {
    kind: "directive.missionPlayerProjection.v1",
    id: "mission.prelude-a-ship-underway",
    version: 1,
    revision: 4,
    status: "active",
    objectives: [
      {
        id: "objective.prelude.command-handover",
        class: "required",
        state: "terminal",
        visibility: "visible",
        title: "Settle the command handover",
        summary: "Establish the terms of command with Captain Whitaker.",
        disposition: "completed",
        terminal_text: "The command handover terms were settled.",
      },
      {
        id: "objective.prelude.staff-readiness",
        class: "optional",
        state: "available",
        visibility: "visible",
        title: "Review senior staff readiness",
        summary: "Meet the senior staff and establish the ship's readiness.",
      },
    ],
    facts: [{ id: "fact.invitation", summary: "Lieutenant Vale invited the new XO to a junior-officer poker game." }],
    capabilities: [{ id: "capability.delegation", label: "Senior staff", summary: "Delegate specialized shipboard work." }],
    outcome_dimensions: { "dimension.prelude.command-readiness": "ready-with-limitation" },
    terminal_disposition: null,
    outcome_summary: [],
    optional_outcome_summaries: [],
  },
  journey: {
    completed_count: 1,
    completed_mission_ids: ["mission.prologue"],
    last_transition: {
      source_mission_id: "mission.prologue",
      source_disposition: "primarySuccess",
      outcome_summary: ["The Breckenridge departed spacedock."],
      optional_outcome_summaries: [],
      next: {
        kind: "mission",
        id: "mission.prelude-a-ship-underway",
        player_safe_setup: "The new command team begins its readiness review.",
      },
    },
    campaign_conclusion: null,
  },
  ship: {
    kind: "directive.shipPlayerProjection.v1",
    name: "U.S.S. Breckenridge",
    class_name: "Intrepid-class",
    systems: [
      {
        id: "system.sensors",
        label: "Sensor suite",
        summary: "Long-range calibration remains incomplete.",
        state: { id: "limited", label: "Limited", mechanicalEffect: "Long-range resolution is reduced." },
        state_ladder: [{ id: "limited", label: "Limited" }, { id: "ready", label: "Ready" }],
        work_orders: [
          { id: "work.sensors.calibrate", label: "Calibrate long-range array", summary: "Complete a full-spectrum calibration.", status: "known" },
          { id: "work.sensors.verify", label: "Verify calibration", summary: "Run the verification sweep.", status: "unknown" },
        ],
      },
      {
        id: "system.integration",
        label: "Systems integration",
        summary: "Core integrations are stable.",
        state: { id: "ready", label: "Ready", mechanicalEffect: "No integration limitation is recorded." },
        state_ladder: [{ id: "ready", label: "Ready" }],
        work_orders: [],
      },
    ],
    capabilities: [{ id: "capability.medical", label: "Medical support", summary: "Sickbay can receive multiple casualties." }],
    constraints: [{ id: "constraint.sensors", label: "Sensor limitation", summary: "Long-range resolution remains reduced." }],
    cohesion: {
      total: 75,
      debt: 25,
      band: { id: "ready", label: "Ready" },
      segments: [
        { index: 0, filled: false, issueId: "cohesion.sensor-calibration", visible: true, level: 2 },
        { index: 1, filled: true, issueId: null, visible: false, level: null },
      ],
      issues: [{
        id: "cohesion.sensor-calibration",
        primary_family: "shipboardLife",
        level: 2,
        cohesion: 10,
        player_text: {
          title: "Restore sensor confidence",
          situation: "The sensor team needs a clean calibration result.",
          objective: "Complete the calibration and verification sweep.",
          whyItMatters: "Reliable readings improve bridge coordination.",
          operationalEffect: "Uncertain contacts may consume response time.",
        },
        computer_help: "Review the sensor work orders.",
        phases: [
          { id: "phase.calibrate", status: "available", label: "Calibration", summary: "Calibrate the array." },
          { id: "phase.verify", status: "available", label: "Verification", summary: "Verify the calibration result." },
        ],
        current_phase: { id: "phase.calibrate", status: "available", label: "Calibration", summary: "Calibrate the array." },
      }],
      queued_count: 1,
      completed: [{ id: "cohesion.power", title: "Stabilize power transfer", cohesionRestored: 5, method: "authored-system" }],
    },
  },
  command_bearing: {
    kind: "directive.commandBearingPlayerProjection.v1",
    balance: 2,
    capacity: 3,
    latest_award_reason: "You carried a command decision to a responsible disposition.",
    pending_edge: null,
    pending_cohesion_relief: null,
    latest_spend: null,
  },
  time: { kind: "directive.timePlayerProjection.v1", elapsed_seconds: 31320, clock_display: "08:42:00", stardate: 57300.4 },
  people: [
    { id: "body:unknown-1", kind: "presence", display_name: "an unfamiliar ensign", identity_status: "observed" },
    {
      id: "11",
      kind: "character",
      display_name: "Mara Whitaker",
      identity_status: "recognized",
      facts: { public_history: "Captain Whitaker commands the Breckenridge." },
      directive: {
        rank: "Captain",
        role: "Commanding Officer",
        department: "command",
        public_record: {
          birthplace: "Kingston, Ontario, Earth",
          serviceBackground: "Science operations, diplomacy, executive command",
          assignmentHistory: "Commanding officer since the Breckenridge's 2372 commission",
        },
        operational_summary: "Captain Whitaker commands the Breckenridge.",
        media: { kind: "crew.portrait.formal", alt: "Captain Mara Whitaker", variants: { detail: "/mara-detail.webp", thumb: "/mara-thumb.webp" } },
      },
    },
    {
      id: "18",
      kind: "character",
      display_name: "Priya Nayar",
      identity_status: "recognized",
      directive: {
        rank: "Lieutenant Commander",
        role: "Chief Science Officer",
        department: "science",
        duty_status: "On duty",
      },
    },
  ],
  turn: { id: 14, idx: 6 },
  location: { room_id: "ready-room", name: "Captain's Ready Room" },
  perception: { summary: "The senior staff are assembling." },
  knows: ["Mara Whitaker commands the Breckenridge."],
});

test("Mission renders the literal active record, objectives, transition, and outcome", () => {
  const fixture = installDomFixture();
  const view = renderMissionView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-expanded-mission\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".mission-index-panel .mission-row.active"));
  assert.ok(view.querySelector(".mission-detail .mission-hero"));
  assert.equal(view.querySelectorAll(".mission-desktop-detail .mission-objective-list .mission-objective-row").length, 2);
  assert.equal(view.querySelectorAll(".mission-desktop-detail .mission-detail-section")[0]?.querySelector("h3")?.textContent, "Primary objectives");
  assert.equal(view.querySelectorAll(".mission-desktop-detail .mission-detail-section")[1]?.querySelector("h3")?.textContent, "Optional objectives");
  assert.match(view.textContent, /Shapes the outcome; not required to finish/);
  assert.match(view.textContent, /Known information.*Lieutenant Vale invited/s);
  assert.match(view.textContent, /Available support.*Senior staff: Delegate specialized shipboard work\./s);
  assert.match(view.textContent, /mission\.prelude-a-ship-underway/);
  assert.match(view.textContent, /Revision 4/);
  assert.match(view.textContent, /Settle the command handover/);
  assert.match(view.textContent, /The command handover terms were settled\./);
  assert.match(view.textContent, /Review senior staff readiness/);
  assert.equal(view.querySelectorAll(".mission-desktop-detail .mission-objective-row").length, 2);
  assert.match(view.textContent, /ready-with-limitation/);
  assert.match(view.textContent, /The new command team begins its readiness review\./);
  assert.equal(view.querySelector(".directive-command-bearing-strip"), null);
  const mobileTrigger = view.querySelector(".mission-mobile-trigger");
  const mobilePanel = view.querySelector(`#${mobileTrigger?.getAttribute("aria-controls")}`);
  assert.equal(mobileTrigger?.getAttribute("aria-expanded"), "true");
  assert.equal(mobilePanel?.hidden, false);
  mobileTrigger?.click();
  assert.equal(mobileTrigger?.getAttribute("aria-expanded"), "false");
  assert.equal(mobilePanel?.hidden, true);
  fixture.window.close();
});

test("Mission does not duplicate People's Command Bearing strip", () => {
  const fixture = installDomFixture();
  const view = renderMissionView({ ...PROJECTION, command_bearing: undefined });
  fixture.document.body.append(view);

  assert.equal(view.querySelector(".directive-command-bearing-strip"), null);
  fixture.window.close();
});

test("People reproduces Directive's player-first Ships Company journal and literal detail", () => {
  const fixture = installDomFixture();
  const state = {};
  const view = renderPeopleView(PROJECTION, state);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-expanded-people\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".people-journal-host > .people-desktop-journal"));
  assert.ok(view.querySelector(".people-desktop-journal > .people-roster"));
  assert.ok(view.querySelector(".people-desktop-journal > .people-detail"));
  assert.ok(view.querySelector(".mobile-crew-accordion"));
  assert.equal(view.querySelector(".people-collection-toolbar strong")?.textContent, "Personnel records");
  assert.equal(view.querySelector(".people-add-category")?.textContent, "+ Category");
  assert.equal(view.querySelector('[data-category-id="ships-company"] .collection-category-copy strong')?.textContent, "Ship's Company");
  assert.equal(view.querySelector('[data-category-id="ships-company"] .collection-category-copy small')?.textContent, "3 people");
  const controls = [...view.querySelectorAll('.people-desktop-journal [data-category-id="ships-company"] button.people-row')];
  assert.equal(view.querySelectorAll('.people-desktop-journal [data-category-id="ships-company"] .people-row > .people-row-copy').length, 3);
  assert.deepEqual(controls.map((control) => control.textContent.trim()), [
    "AQAvery QuillExecutive Officer",
    "Mara WhitakerCommanding Officer",
    "PNPriya NayarChief Science Officer",
  ]);
  assert.equal(state.selectedPersonId, "player");
  const portraitControls = [...view.querySelectorAll(".directive-crew-player-portrait-control")];
  assert.deepEqual(portraitControls.map((control) => control.getAttribute("aria-label")), [
    "Add player image",
    "No player image to remove",
    "Add player image",
    "No player image to remove",
  ]);
  assert.equal(portraitControls.every((control) => control.disabled), true);
  controls[1].click();
  assert.equal(state.selectedPersonId, "11");
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Personnel record/);
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Science operations, diplomacy, executive command/);
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Commanding officer since the Breckenridge's 2372 commission/);
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Kingston, Ontario, Earth/);
  assert.equal(occurrences(view.querySelector(".people-detail")?.textContent || "", "Captain Whitaker commands the Breckenridge."), 1);

  assert.equal(view.querySelectorAll('.people-desktop-journal [aria-label^="Reorder "]').length, 6);
  assert.equal(view.querySelectorAll(".people-desktop-journal .people-roster .people-pip").length, 10);
  const contacts = view.querySelector('[data-category-id="contacts"]');
  assert.equal(contacts?.querySelector(".collection-category-copy small")?.textContent, "1 person");

  const stranger = view.querySelector('.people-desktop-journal button.people-row[data-person-id="body:unknown-1"]');
  stranger.click();
  assert.equal(state.selectedPersonId, "body:unknown-1");
  assert.match(view.querySelector(".people-detail")?.textContent || "", /No additional public details are available\./);
  assert.doesNotMatch(view.textContent, /secret|psychology|personality|private history/i);
  assert.doesNotMatch(view.querySelector(".people-detail")?.textContent || "", /Starfleet|assignment|duty/i);

  const rerendered = renderPeopleView(PROJECTION, state);
  assert.equal(rerendered.querySelector('.people-desktop-journal button.people-row[data-person-id="body:unknown-1"]')?.getAttribute("aria-pressed"), "true");
  assert.match(rerendered.querySelector(".people-detail")?.textContent || "", /an unfamiliar ensign/);
  assert.match(rerendered.querySelector(".people-detail")?.textContent || "", /No additional public details are available\./);
  fixture.window.close();
});

test("People category, mobile disclosure, and Command Bearing controls are functional", () => {
  const fixture = installDomFixture();
  const state = {};
  let reserved = 0;
  const view = renderPeopleView(PROJECTION, state, { reserveCommandBearingEdge: () => { reserved += 1; } });
  fixture.document.body.append(view);

  const bearing = view.querySelector(".directive-command-bearing-strip");
  assert.equal(bearing?.querySelectorAll(".directive-command-bearing-pips span").length, 3);
  bearing?.querySelector(".people-command-primary")?.click();
  assert.equal(reserved, 1);

  const disclosure = view.querySelector('.people-desktop-journal [data-category-id="contacts"] .collection-disclosure');
  disclosure?.click();
  assert.equal(view.querySelector('.people-desktop-journal [data-category-id="contacts"] .collection-person-list'), null);

  view.querySelector(".people-desktop-journal .people-add-category")?.click();
  const input = view.querySelector('.people-desktop-journal .collection-category-input');
  assert.ok(input);
  input.value = "Diplomatic contacts";
  input.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.match(view.querySelector(".people-desktop-journal")?.textContent || "", /Diplomatic contacts/i);

  const toggles = [...view.querySelectorAll(".mobile-accordion-toggle")];
  toggles[0]?.click();
  toggles[1]?.click();
  assert.equal(view.querySelectorAll(".mobile-accordion-item.is-open").length, 1);
  assert.equal(toggles[0]?.getAttribute("aria-expanded"), "false");
  assert.equal(toggles[1]?.getAttribute("aria-expanded"), "true");
  fixture.window.close();
});

test("People pointer reordering persists within the Directive campaign story scope", () => {
  const fixture = installDomFixture();
  const first = renderPeopleView(PROJECTION, {});
  fixture.document.body.append(first);
  const rows = [...first.querySelectorAll('.people-desktop-journal [data-category-id="ships-company"] .collection-person-row')];
  const movingId = rows[0].dataset.personId;
  const targetId = rows[1].dataset.personId;
  const handle = rows[0].querySelector(".collection-person-drag-handle");
  fixture.document.elementFromPoint = () => rows[1];
  handle.dispatchEvent(new fixture.window.PointerEvent("pointerdown", {
    bubbles: true, pointerId: 1, pointerType: "mouse", button: 0, clientX: 4, clientY: 4,
  }));
  fixture.document.dispatchEvent(new fixture.window.PointerEvent("pointermove", {
    bubbles: true, pointerId: 1, pointerType: "mouse", clientX: 4, clientY: 20,
  }));
  fixture.document.dispatchEvent(new fixture.window.PointerEvent("pointerup", {
    bubbles: true, pointerId: 1, pointerType: "mouse", clientX: 4, clientY: 20,
  }));

  const restored = renderPeopleView(PROJECTION, {});
  first.replaceWith(restored);
  const restoredIds = [...restored.querySelectorAll('.people-desktop-journal [data-category-id="ships-company"] .collection-person-row')]
    .map((row) => row.dataset.personId);
  assert.equal(restoredIds.indexOf(movingId), restoredIds.indexOf(targetId) + 1);
  fixture.window.close();
});

test("People mobile category and person reordering uses the visible accordion and restores handle focus", async () => {
  const fixture = installDomFixture();
  const view = renderPeopleView(PROJECTION, {});
  fixture.document.body.append(view);
  const mobile = view.querySelector(".mobile-crew-accordion");
  const categories = [...mobile.querySelectorAll(":scope > .collection-category")];
  const categoryHandle = categories[0].querySelector(":scope > .collection-category-head > .collection-drag-handle");
  fixture.document.elementFromPoint = () => categories[1];
  categoryHandle.dispatchEvent(new fixture.window.PointerEvent("pointerdown", {
    bubbles: true, pointerId: 7, pointerType: "touch", button: 0, clientX: 4, clientY: 4,
  }));
  fixture.document.dispatchEvent(new fixture.window.PointerEvent("pointerup", {
    bubbles: true, pointerId: 7, pointerType: "touch", clientX: 4, clientY: 20,
  }));
  assert.equal(view.querySelector(".mobile-crew-accordion > .collection-category")?.dataset.categoryId, "contacts");

  const personHandle = view.querySelector('.mobile-crew-accordion [data-category-id="ships-company"] .collection-person-drag-handle');
  personHandle.focus();
  personHandle.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  await new Promise((resolve) => fixture.window.requestAnimationFrame(resolve));
  const active = fixture.document.activeElement;
  assert.equal(active?.getAttribute("aria-label"), "Reorder Avery Quill");
  assert.ok(active?.closest(".mobile-crew-accordion"));
  fixture.window.close();
});

test("Ship renders literal vessel readiness, systems, work orders, and cohesion disclosures", () => {
  const fixture = installDomFixture();
  const view = renderShipView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-expanded-ship\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".ship-cohesion-workspace .ship-cohesion-orbit"));
  assert.ok(view.querySelector(".ship-cohesion-workspace .ship-task-nav"));
  assert.equal(view.querySelectorAll(".ship-task-mobile-callouts .ship-task-mobile-callout").length, 1);
  assert.equal(view.querySelector(".ship-cohesion-visual .directive-media-image")?.getAttribute("src"), "/breckenridge-cohesion.png");
  assert.match(view.textContent, /U\.S\.S\. Breckenridge/);
  assert.match(view.textContent, /Intrepid-class/);
  assert.match(view.textContent, /Cohesion 75/);
  assert.match(view.textContent, /Ready/);
  assert.equal(view.querySelector('[aria-label="Cohesion 75 out of 100"]')?.children.length, 2);

  const systems = [...view.querySelectorAll("details[data-system-id]")];
  assert.equal(systems.length, 2);
  assert.match(systems[0].querySelector("summary")?.textContent || "", /Sensor suite.*Limited/);
  assert.match(systems[0].textContent, /Calibrate long-range array/);
  assert.doesNotMatch(systems[0].textContent, /Verify calibration/, "unknown work must remain omitted");
  assert.match(view.textContent, /Medical support/);
  assert.match(view.textContent, /Sensor limitation/);

  const priority = view.querySelector(".ship-task-detail > .ship-task-detail-content");
  assert.ok(priority);
  assert.match(priority.className, /\bship-task-detail-content\b/);
  assert.match(priority.textContent, /Restore sensor confidence/);
  assert.match(priority.textContent, /Objective/);
  assert.match(priority.textContent, /Complete the calibration and verification sweep\./);
  assert.match(priority.textContent, /Command Impact/);
  assert.match(priority.textContent, /Reliable readings improve bridge coordination\./);
  assert.match(priority.textContent, /Operational Risk/);
  assert.match(priority.textContent, /Uncertain contacts may consume response time\./);
  assert.match(priority.textContent, /Next: Calibration/);
  assert.match(priority.textContent, /Review the sensor work orders\./);
  assert.match(view.textContent, /1 additional assignment queued/);
  assert.match(view.textContent, /Stabilize power transfer/);

  const taskButton = view.querySelector(".ship-task-button");
  const mobilePanel = view.querySelector(".ship-task-mobile-panel");
  assert.equal(taskButton?.querySelector(".ship-task-category-icon")?.dataset.icon, "life");
  assert.equal(taskButton?.getAttribute("aria-controls"), `ship-task-detail ${mobilePanel?.id}`);
  assert.equal(taskButton?.getAttribute("aria-expanded"), "false");
  assert.equal(mobilePanel?.hidden, true);
  taskButton?.click();
  assert.equal(taskButton?.getAttribute("aria-expanded"), "true");
  assert.equal(mobilePanel?.hidden, false);
  assert.match(mobilePanel?.textContent || "", /Complete the calibration and verification sweep\./);
  fixture.window.close();
});

test("Ship offers source-equivalent Command Bearing relief for the selected visible issue", async () => {
  const fixture = installDomFixture();
  const calls = [];
  let refreshed = 0;
  const data = structuredClone(PROJECTION);
  data.command_bearing = { balance: 1, capacity: 3, pending_cohesion_relief: null };
  const view = renderShipView(data, {
    reserveCohesionRelief: async ({ issueId }) => {
      calls.push(issueId);
      return { applied: true };
    },
    refresh: async () => { refreshed += 1; },
  });
  fixture.document.body.append(view);

  const button = view.querySelector(".ship-command-relief-button");
  assert.match(button?.textContent || "", /Spend 1 Command Bearing/);
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [data.ship.cohesion.issues[0].id]);
  assert.equal(refreshed, 1);
  assert.equal(button?.textContent, "Command Bearing relief reserved");
  fixture.window.close();
});

test("Ship Command Bearing actions recover from host errors with an accessible message", async () => {
  const fixture = installDomFixture();
  const data = structuredClone(PROJECTION);
  data.command_bearing = { balance: 1, capacity: 3, pending_cohesion_relief: null };
  const view = renderShipView(data, {
    reserveCohesionRelief: async () => { throw new Error("Cohesion service unavailable."); },
  });
  fixture.document.body.append(view);

  const button = view.querySelector(".ship-command-relief-button");
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const error = view.querySelector(".ship-command-relief-error");
  assert.equal(button.disabled, false);
  assert.equal(error?.hidden, false);
  assert.equal(error?.getAttribute("role"), "alert");
  assert.match(error?.textContent || "", /Cohesion service unavailable/);
  fixture.window.close();
});

test("Ship degrades absent literal task fields without inventing phase detail", () => {
  const fixture = installDomFixture();
  const data = structuredClone(PROJECTION);
  delete data.ship.cohesion.issues[0].current_phase;
  delete data.ship.cohesion.issues[0].phases;
  delete data.ship.cohesion.issues[0].computer_help;
  const view = renderShipView(data);
  fixture.document.body.append(view);

  const priority = view.querySelector(".ship-task-detail > .ship-task-detail-content");
  assert.match(priority?.textContent || "", /This assignment is ready for resolution/);
  assert.doesNotMatch(priority?.textContent || "", /Calibration · available|Verification · available|Review the sensor work orders/i);
  fixture.window.close();
});

test("Settings is a branded in-product authority record without Sonder-owned provider controls", () => {
  const fixture = installDomFixture();
  const view = renderSettingsView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-expanded-settings\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.equal(view.querySelectorAll(".settings-content > .settings-section").length, 2);
  assert.match(view.textContent, /Directive campaign authority/);
  assert.match(view.textContent, /Exploration/);
  assert.match(view.textContent, /Sonder owns model and provider configuration\./);
  assert.match(view.textContent, /Player dialogue remains player-authored\./);
  assert.match(view.textContent, /Committed story lineage/);
  assert.equal(view.querySelectorAll("input, select, textarea").length, 0);
  assert.doesNotMatch(view.textContent, /API key|Connection Profile|Utility lane|Reasoning lane/i);
  fixture.window.close();
});

test("Directive exposes exactly the five branded routes and renders every non-Campaign workspace", async () => {
  const fixture = installDomFixture();
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  const sonder = {
    state: () => ({ chatId: 27 }),
    api: async () => PROJECTION,
    chats: { open: async () => {} },
    closeView: () => {},
    refresh: async () => {},
  };
  await createDirectiveView(sonder).render(container);

  const overlay = container.querySelector(".directive-runtime-overlay.directive-runtime-overlay-open");
  assert.ok(overlay?.querySelector(":scope > .directive-runtime-backdrop"));
  assert.ok(overlay?.querySelector(":scope > .directive-runtime-panel-host > .directive-expanded-shell"));

  const routes = [...container.querySelectorAll("[data-route-id]")];
  assert.deepEqual(routes.map((button) => button.textContent), ["Campaign", "Mission", "People", "Ship", "Settings"]);
  for (const [routeId, selector] of [
    ["mission", ".directive-expanded-mission"],
    ["people", ".directive-expanded-people"],
    ["ship", ".directive-expanded-ship"],
    ["settings", ".directive-expanded-settings"],
  ]) {
    routes.find((button) => button.dataset.routeId === routeId).click();
    assert.ok(container.querySelector(selector), `${routeId} must use its branded workspace`);
  }
  assert.equal(container.querySelector('[data-route-id="crew"]'), null);
  fixture.window.close();
});

function installDomFixture() {
  const window = new Window();
  globalThis.document = window.document;
  return { window, document: window.document };
}

function occurrences(value, needle) {
  return String(value).split(needle).length - 1;
}
