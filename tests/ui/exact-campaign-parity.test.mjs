import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createDirectiveView } from "../../ui/app.js";

const PACKAGE_TITLES = [
  "Ashes of Peace",
  "Drowned Constellation",
  "Black Current",
  "Broken Accord",
  "Unseen Border",
  "Enemy's Garden",
];

test("opening Directive without a story shows the official Campaign browser before commissioning", async () => {
  const fixture = installDomFixture();
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  const sonder = {
    state: () => ({ chatId: null }),
    api: async () => { throw new Error("no story must not request a projection"); },
    chats: { open: async () => {} },
    refresh: async () => {},
    closeView: () => {},
  };

  await createDirectiveView(sonder).render(container);

  assert.ok(container.querySelector('.directive-expanded-shell[data-active-route="campaign"]'));
  assert.ok(container.querySelector('.campaign-browser[data-campaign-view="browser"]'));
  assert.equal(container.querySelector(".directive-creator-form"), null);
  assert.deepEqual(
    [...container.querySelectorAll('.campaign-desktop-master [data-campaign-record-key^="package:"] strong')]
      .map((node) => node.textContent),
    PACKAGE_TITLES,
  );
  const ashesHero = container.querySelector(".campaign-desktop-detail .campaign-library-hero");
  assert.equal(ashesHero?.dataset.heroOrbitBound, "true");
  assert.equal(ashesHero?.querySelectorAll("[data-hero-scene-layer]").length, 6);
  assert.equal(ashesHero?.querySelectorAll("[data-hero-ship-layer]").length, 3);
  const mobileTriggers = [...container.querySelectorAll(".campaign-mobile-trigger")];
  const firstPanel = container.querySelector(`#${mobileTriggers[0]?.getAttribute("aria-controls")}`);
  assert.equal(mobileTriggers[0]?.getAttribute("aria-expanded"), "true");
  assert.ok(firstPanel?.id);
  mobileTriggers[0]?.click();
  assert.equal(mobileTriggers[0]?.getAttribute("aria-expanded"), "false");
  assert.equal(firstPanel?.hidden, true);
  mobileTriggers[1]?.click();
  assert.equal(container.querySelectorAll('.campaign-mobile-trigger[aria-expanded="true"]').length, 1);

  const drowned = [...container.querySelectorAll(".campaign-row")]
    .find((row) => row.querySelector("strong")?.textContent === "Drowned Constellation");
  assert.ok(drowned);
  drowned.click();
  const detail = container.querySelector(".campaign-desktop-detail");
  assert.match(detail?.textContent || "", /Coming later/);
  assert.match(detail?.textContent || "", /unmapped currents of the Nerine Reef/);
  assert.equal(detail?.querySelector(".campaign-library-hero")?.classList.contains("is-coming-later"), true);
  assert.equal(detail?.querySelector(".campaign-library-hero")?.dataset.heroOrbitBound, undefined);
  assert.equal(detail?.querySelector("button")?.textContent, "New campaign");
  assert.equal(detail?.querySelector("button")?.disabled, true);
  fixture.window.close();
});

test("the playable Ashes package enters commissioning only after Start campaign", async () => {
  const fixture = installDomFixture();
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  const sonder = {
    state: () => ({ chatId: null }),
    chats: { open: async () => {} },
    refresh: async () => {},
    closeView: () => {},
  };

  await createDirectiveView(sonder).render(container);
  const start = [...container.querySelectorAll("button")]
    .find((button) => button.textContent === "Start campaign");
  assert.ok(start);
  start.click();

  assert.ok(container.querySelector(".directive-creator-form"));
  assert.equal(container.querySelector(".campaign-browser"), null);
  fixture.window.close();
});

test("reopening the same Directive view resets the active route to Campaign", async () => {
  const fixture = installDomFixture();
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  const sonder = {
    state: () => ({ chatId: 27 }),
    api: async () => activeProjection(),
    chats: { open: async () => {} },
    refresh: async () => {},
    closeView: () => {},
  };
  const view = createDirectiveView(sonder);
  await view.render(container);
  container.querySelector('[data-route-id="mission"]').click();
  assert.equal(container.querySelector(".directive-expanded-shell")?.dataset.activeRoute, "mission");

  await view.render(container);

  assert.equal(container.querySelector(".directive-expanded-shell")?.dataset.activeRoute, "campaign");
  assert.ok(container.querySelector(".campaign-dashboard"));
  assert.equal(container.querySelector(".campaign-dashboard-hero .directive-hero-scene")?.dataset.mediaVariant, "hero-scene");
  assert.match(container.querySelector(".campaign-dashboard-hero")?.textContent || "", /Sam Vickers \/ Executive Officer \/ U\.S\.S\. Breckenridge/);
  assert.match(container.querySelector(".campaign-dashboard-hero")?.textContent || "", /Take command aboard a newly refitted starship/);
  assert.equal(container.querySelector(".directive-ship-chronometer-campaign")?.textContent, "Ship time08:48:12Stardate 53068.4");
  fixture.window.close();
});

function activeProjection() {
  return {
    chat_id: 27,
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace", premise: "Take command aboard a newly refitted starship.", simulation_mode: "Exploration" },
    viewer: { name: "Sam Vickers", role: "Executive Officer" },
    player: { name: "Sam Vickers", billet: "Executive Officer" },
    ship: { name: "U.S.S. Breckenridge", class_name: "Intrepid-class", registry: "NCC-74656" },
    mission: { id: "prelude-a-ship-underway", title: "Prelude: A Ship Underway", status: "active", objectives: [] },
    time: { kind: "directive.timePlayerProjection.v1", stardate: 53068.4, stardate_display: "53068.4", clock_display: "08:48:12" },
    journey: {},
    people: [],
  };
}

function installDomFixture() {
  const window = new Window();
  globalThis.document = window.document;
  return { window, document: window.document };
}
