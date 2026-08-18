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
    ship: { kind: "ship.hero", alt: "U.S.S. Breckenridge underway", variants: { hero: "/breckenridge.webp" } },
    location: { kind: "location.hero", alt: "Asterion Station", variants: { card: "/asterion.webp" } },
  },
  viewer: { id: "player", name: "Avery Quill", kind: "player" },
  mission: {
    kind: "directive.missionPlayerProjection.v1",
    id: "mission.prelude-a-ship-underway",
    version: 1,
    revision: 4,
    status: "active",
    objectives: [
      {
        id: "objective.prelude.command-handover",
        state: "terminal",
        visibility: "visible",
        title: "Settle the command handover",
        summary: "Establish the terms of command with Captain Whitaker.",
        disposition: "completed",
        terminal_text: "The command handover terms were settled.",
      },
      {
        id: "objective.prelude.staff-readiness",
        state: "available",
        visibility: "visible",
        title: "Review senior staff readiness",
        summary: "Meet the senior staff and establish the ship's readiness.",
      },
    ],
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
        level: 2,
        cohesion: 10,
        player_text: {
          title: "Restore sensor confidence",
          situation: "The sensor team needs a clean calibration result.",
          commandImpact: "Reliable readings improve bridge coordination.",
          courseOfAction: "Complete the calibration and verification sweep.",
          operationalRisk: "Uncertain contacts may consume response time.",
          resolutionCriteria: "Record a verified long-range calibration.",
        },
        computer_help: "Review the sensor work orders.",
        phases: [{ id: "phase.calibrate", status: "available", label: "Calibration", summary: "Calibrate the array." }],
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
        crew_id: "mara-whitaker",
        rank: "Captain",
        role: "Commanding Officer",
        department: "command",
        public_record: { birthplace: "Kingston, Ontario, Earth" },
        operational_summary: "Retains final legal command during the handover.",
        media: { kind: "crew.portrait.formal", alt: "Captain Mara Whitaker", variants: { detail: "/mara-detail.webp", thumb: "/mara-thumb.webp" } },
      },
    },
    {
      id: "18",
      kind: "character",
      display_name: "Priya Nayar",
      identity_status: "recognized",
      directive: {
        crew_id: "priya-nayar",
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

test("Mission renders the literal active record, objectives, transition, outcome, and Command Bearing", () => {
  const fixture = installDomFixture();
  const view = renderMissionView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-v1-mission\b/);
  assert.match(view.textContent, /mission\.prelude-a-ship-underway/);
  assert.match(view.textContent, /Revision 4/);
  assert.match(view.textContent, /Settle the command handover/);
  assert.match(view.textContent, /The command handover terms were settled\./);
  assert.match(view.textContent, /Review senior staff readiness/);
  assert.equal(view.querySelectorAll(".directive-v1-objective").length, 2);
  assert.match(view.textContent, /ready-with-limitation/);
  assert.match(view.textContent, /The new command team begins its readiness review\./);
  assert.match(view.textContent, /Command Bearing/);
  assert.match(view.textContent, /2 of 3 available/);
  assert.equal(view.querySelectorAll(".directive-v1-command-bearing-pips span").length, 3);
  assert.equal(view.querySelectorAll(".directive-v1-command-bearing-pips .is-filled").length, 2);
  fixture.window.close();
});

test("People orders recognized Directive crew before observed contacts and selects literal detail", () => {
  const fixture = installDomFixture();
  const state = {};
  const view = renderPeopleView(PROJECTION, state);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-expanded-people\b/);
  const controls = [...view.querySelectorAll("[data-person-id]")];
  assert.deepEqual(controls.map((control) => control.textContent.trim()), [
    "Mara WhitakerCaptain · Commanding Officer",
    "Priya NayarLieutenant Commander · Chief Science Officer",
    "an unfamiliar ensignObserved contact",
  ]);
  assert.equal(state.selectedPersonId, "11");
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Retains final legal command/);
  assert.match(view.querySelector(".people-detail")?.textContent || "", /Kingston, Ontario, Earth/);

  controls[2].click();
  assert.equal(state.selectedPersonId, "body:unknown-1");
  assert.match(view.querySelector(".people-detail")?.textContent || "", /No additional public details are available\./);
  assert.doesNotMatch(view.textContent, /secret|psychology|personality|private history/i);
  assert.doesNotMatch(view.querySelector(".people-detail")?.textContent || "", /Starfleet|assignment|duty/i);
  fixture.window.close();
});

test("Ship renders literal vessel readiness, systems, work orders, and cohesion disclosures", () => {
  const fixture = installDomFixture();
  const view = renderShipView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-v1-ship\b/);
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

  const priority = view.querySelector('details[data-cohesion-issue-id="cohesion.sensor-calibration"]');
  assert.ok(priority);
  assert.match(priority.textContent, /Restore sensor confidence/);
  assert.match(priority.textContent, /Command Impact/);
  assert.match(priority.textContent, /Reliable readings improve bridge coordination\./);
  assert.match(view.textContent, /1 additional assignment queued/);
  assert.match(view.textContent, /Stabilize power transfer/);
  fixture.window.close();
});

test("Settings is a branded in-product authority record without Sonder-owned provider controls", () => {
  const fixture = installDomFixture();
  const view = renderSettingsView(PROJECTION);
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-v1-settings\b/);
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

  const routes = [...container.querySelectorAll("[data-route-id]")];
  assert.deepEqual(routes.map((button) => button.textContent), ["Campaign", "Mission", "People", "Ship", "Settings"]);
  for (const [routeId, selector] of [
    ["mission", ".directive-v1-mission"],
    ["people", ".directive-expanded-people"],
    ["ship", ".directive-v1-ship"],
    ["settings", ".directive-v1-settings"],
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
