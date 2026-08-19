import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createDirectiveView } from "../../ui/app.js";
import { renderCampaignView } from "../../ui/views/campaign.js";
import { renderCreatorView } from "../../ui/views/creator.js";

const PLAYER_VALUES = Object.freeze({
  name: "Avery Quill",
  pronouns_or_address: "Commander Quill",
  species: "Human",
  age_band: "mid-career",
  appearance: "Close-cropped dark hair and a composed bearing.",
  career_background: "Starfleet operations and logistics",
  formative_experience: "Fleet service during the Dominion War",
  assignment_reason: "Requested by Captain Whitaker",
  insight_trait: "Analytical",
  connection_trait: "Candid",
  execution_trait: "Decisive",
  flaw: "Guarded",
});

test("Campaign switches Command, Library, and Records without inventing missing facts", () => {
  const fixture = installDomFixture();
  const data = campaignProjection();
  const state = { mode: "command" };
  const view = renderCampaignView(data, state, {});
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-campaign-workspace\b/);
  assert.match(view.className, /\bdirective-expanded-campaign\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-heading"));
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-hero"));
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-actions"));
  assert.equal(view.querySelector('[role="tablist"]')?.classList.contains("directive-campaign-command-bar"), true);
  assert.deepEqual(
    [...view.querySelectorAll("[data-campaign-mode]")].map((button) => button.textContent),
    ["Command", "Library", "Records"],
  );
  assert.match(view.textContent, /Ashes of Peace/);
  assert.match(view.textContent, /Avery Quill/);
  assert.match(view.textContent, /U\.S\.S\. Breckenridge/);
  assert.match(view.textContent, /Intrepid-class/);
  assert.match(view.textContent, /prelude-a-ship-underway/);
  assert.match(view.textContent, /57300\.4/);
  assert.doesNotMatch(view.textContent, /Asterion Station/);

  const modeButtons = [...view.querySelectorAll("[data-campaign-mode]")];
  const modePanel = view.querySelector(".directive-campaign-mode-panel");
  assert.ok(modeButtons.every((button) => button.id));
  assert.ok(modeButtons.every((button) => button.getAttribute("aria-controls") === modePanel?.id));
  assert.equal(modePanel?.getAttribute("role"), "tabpanel");
  assert.ok(modePanel?.id);
  assert.equal(modePanel?.getAttribute("aria-labelledby"), modeButtons[0].id);
  dispatchKeyboard(fixture.window, modeButtons[0], "ArrowRight");
  assert.equal(state.mode, "library");
  assert.equal(fixture.document.activeElement, modeButtons[1]);
  assert.equal(modePanel?.getAttribute("aria-labelledby"), modeButtons[1].id);
  assert.match(view.querySelector(".directive-package-card")?.className || "", /\bdirective-package-card\b/);
  assert.match(view.textContent, /Installed campaign package/);

  click(view, '[data-campaign-mode="records"]');
  assert.equal(state.mode, "records");
  assert.match(view.textContent, /Story 27/);
  assert.match(view.textContent, /Current record/);

  const absent = renderCampaignView({ campaign: {}, mission: {}, viewer: {}, ship: {} }, { mode: "command" }, {});
  assert.match(absent.textContent, /Campaign title unavailable\./);
  assert.match(absent.textContent, /Player identity unavailable\./);
  assert.match(absent.textContent, /Current mission unavailable\./);
  assert.doesNotMatch(absent.textContent, /Ashes of Peace/);

  const unprojectedShip = renderCampaignView({ campaign: { id: "ashes-of-peace" }, ship: {} }, { mode: "command" }, {});
  assert.match(unprojectedShip.textContent, /Ship identity unavailable\./);
  assert.match(unprojectedShip.textContent, /Ship class unavailable\./);
  fixture.window.close();
});

test("Campaign media fails to a framed placeholder and null metrics stay unavailable", () => {
  const fixture = installDomFixture();
  const data = campaignProjection();
  data.time.stardate = null;
  data.journey.completed_count = null;
  const view = renderCampaignView(data, { mode: "command" }, {});
  fixture.document.body.append(view);

  assert.match(view.textContent, /Stardate unavailable/);
  const frame = view.querySelector(".campaign-hero-media");
  const image = frame?.querySelector("img");
  const placeholder = frame?.querySelector(".directive-media-placeholder");
  assert.ok(frame);
  assert.match(frame.className, /\bdirective-hero-scene\b/);
  assert.equal(frame.querySelectorAll('[data-hero-scene-layer]').length, 6);
  assert.equal(frame.querySelectorAll('[data-hero-ship-layer]').length, 3);
  assert.ok(image);
  assert.ok(placeholder);
  image.dispatchEvent(new fixture.window.Event("error"));
  assert.equal(image.hidden, true);
  assert.equal(placeholder.hidden, false);
  assert.match(placeholder.textContent, /Campaign media unavailable/);
  fixture.window.close();
});

test("Creator keeps required fields across four steps, blocks early submit, and renders a literal review", async () => {
  const fixture = installDomFixture();
  const state = { step: "identity", input: {}, status: "" };
  const submitted = [];
  const view = renderCreatorView(state, {
    startCampaign: async (payload) => { submitted.push(payload); },
  });
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-creator-workspace\b/);
  assert.equal(view.noValidate, true);
  assert.deepEqual(
    [...view.querySelectorAll("[data-creator-step]")]
      .filter((element) => element.matches("button"))
      .map((button) => button.textContent),
    ["Identity", "Service", "Command Profile", "Review"],
  );
  assert.equal([...view.querySelectorAll("[name]")].filter((control) => control.required).length, 13);
  assert.equal(view.dataset.creatorActiveStep, "identity");
  const stepButtons = [...view.querySelectorAll('button[data-creator-step]')];
  const stepPanels = [...view.querySelectorAll('[role="tabpanel"]')];
  assert.ok(stepButtons.every((button) => button.getAttribute("aria-controls")));
  assert.ok(stepPanels.every((panel) => panel.getAttribute("aria-labelledby")));
  assert.deepEqual(
    stepButtons.map((button) => button.getAttribute("aria-controls")),
    stepPanels.map((panel) => panel.id),
  );

  dispatchKeyboard(fixture.window, stepButtons[0], "ArrowRight");
  assert.equal(state.step, "service");
  assert.equal(view.dataset.creatorActiveStep, "service");
  assert.equal(fixture.document.activeElement, stepButtons[1]);

  setValue(fixture.window, view.querySelector('[name="name"]'), PLAYER_VALUES.name);
  click(view, '[data-creator-step="identity"]');
  assert.equal(view.querySelector('[name="name"]').value, PLAYER_VALUES.name);

  for (const [name, value] of Object.entries(PLAYER_VALUES)) {
    setValue(fixture.window, view.querySelector(`[name="${name}"]`), value);
  }
  setValue(fixture.window, view.querySelector('[name="simulation_mode"]'), "Exploration", "change");
  await submit(fixture.window, view);
  assert.equal(state.step, "review");
  assert.equal(view.dataset.creatorActiveStep, "review");
  assert.equal(fixture.document.activeElement, stepButtons[3]);
  assert.match(view.querySelector("[data-creator-review]")?.textContent || "", /Avery Quill/);
  assert.match(view.querySelector("[data-creator-review]")?.textContent || "", /Commander Quill/);
  assert.match(view.querySelector("[data-creator-review]")?.textContent || "", /Exploration/);
  assert.equal(submitted.length, 0, "ephemeral step changes must not call the host");
  fixture.window.close();
});

test("Directive provisions once at final review, opens the chat, reports progress, and permits retry", async () => {
  const fixture = installDomFixture();
  const calls = [];
  const opened = [];
  let attempts = 0;
  let refreshes = 0;
  const sonder = {
    state: () => ({ chatId: null }),
    api: async (method, path, body) => {
      calls.push({ method, path, body });
      attempts += 1;
      if (attempts === 1) throw new Error("provisioning rejected");
      return { chat_id: 91 };
    },
    chats: { open: async (chatId) => { opened.push(chatId); } },
    refresh: () => { refreshes += 1; },
    closeView: () => {},
  };
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  await createDirectiveView(sonder).render(container);

  assert.equal(container.querySelector(".directive-expanded-shell")?.dataset.activeRoute, "campaign");
  assert.ok(container.querySelector(".directive-creator-workspace"));
  for (const [name, value] of Object.entries(PLAYER_VALUES)) {
    setValue(fixture.window, container.querySelector(`[name="${name}"]`), value);
  }
  setValue(fixture.window, container.querySelector('[name="simulation_mode"]'), "Exploration", "change");
  click(container, '[data-creator-step="review"]');

  await submit(fixture.window, container.querySelector("form"));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    method: "POST",
    path: "/api/extensions/directive/x/start",
    body: { ...PLAYER_VALUES, simulation_mode: "Exploration" },
  });
  assert.deepEqual(opened, []);
  assert.equal(refreshes, 0);
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /could not be created/i);
  assert.equal(container.querySelector('[type="submit"]')?.disabled, false);

  await submit(fixture.window, container.querySelector("form"));
  assert.equal(calls.length, 2);
  assert.deepEqual(opened, [91]);
  assert.equal(refreshes, 1);
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /Campaign opened.*Refreshing/i);
  fixture.window.close();
});

test("A failed chat open retries only open and never provisions a second story", async () => {
  const fixture = installDomFixture();
  let posts = 0;
  let opens = 0;
  let refreshes = 0;
  const sonder = {
    state: () => ({ chatId: null }),
    api: async () => { posts += 1; return { chat_id: 92 }; },
    chats: { open: async () => { opens += 1; if (opens === 1) throw new Error("open rejected"); } },
    refresh: async () => { refreshes += 1; },
    closeView: () => {},
  };
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  await createDirectiveView(sonder).render(container);
  fillCreator(fixture.window, container);
  click(container, '[data-creator-step="review"]');

  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 1, 0]);
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /created.*retry opening/i);
  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 2, 1]);
  fixture.window.close();
});

test("A failed refresh retries only refresh after the created story was opened", async () => {
  const fixture = installDomFixture();
  let posts = 0;
  let opens = 0;
  let refreshes = 0;
  const sonder = {
    state: () => ({ chatId: null }),
    api: async () => { posts += 1; return { chat_id: 93 }; },
    chats: { open: async () => { opens += 1; } },
    refresh: async () => { refreshes += 1; if (refreshes === 1) throw new Error("refresh rejected"); },
    closeView: () => {},
  };
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  await createDirectiveView(sonder).render(container);
  fillCreator(fixture.window, container);
  click(container, '[data-creator-step="review"]');

  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 1, 1]);
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /opened.*retry refresh/i);
  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 1, 2]);
  fixture.window.close();
});

test("Campaign Continue opens the active Sonder story and returns to story", async () => {
  const fixture = installDomFixture();
  const opened = [];
  let closed = 0;
  const sonder = {
    state: () => ({ chatId: 27 }),
    api: async () => campaignProjection(),
    chats: { open: async (chatId) => { opened.push(chatId); } },
    refresh: () => {},
    closeView: () => {},
  };
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  await createDirectiveView(sonder, { onClose: () => { closed += 1; } }).render(container);

  click(container, '[data-campaign-action="continue"]');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(opened, [27]);
  assert.equal(closed, 1);
  fixture.window.close();
});

function campaignProjection() {
  return {
    chat_id: 27,
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace", simulation_mode: "Exploration" },
    viewer: { name: "Avery Quill" },
    ship: { name: "U.S.S. Breckenridge", class_name: "Intrepid-class" },
    mission: { id: "prelude-a-ship-underway", status: "active" },
    time: { stardate: 57300.4, clock_display: "16:42:00" },
    journey: { completed_count: 3 },
    media: {
      ship: {
        alt: "U.S.S. Breckenridge",
        variants: { hero: "/breckenridge.webp" },
        scene: {
          layers: { background: "/background.webp", stars: "/stars.webp", foreground: "/ship.webp" },
          cruise: { farStars: "/far.svg", nearStars: "/near.svg", sunlight: "/sunlight.svg" },
          emissive: { windows: "/windows.png", nacelles: "/nacelles.png", windowNoise: "/noise.webp" },
        },
      },
    },
  };
}

function installDomFixture() {
  const window = new Window();
  globalThis.document = window.document;
  return { window, document: window.document };
}

function click(root, selector) {
  const target = root.querySelector(selector);
  assert.ok(target, `missing click target ${selector}`);
  target.click();
}

function setValue(window, control, value, eventType = "input") {
  assert.ok(control, "missing form control");
  control.value = value;
  control.dispatchEvent(new window.Event(eventType, { bubbles: true }));
}

function fillCreator(window, root) {
  for (const [name, value] of Object.entries(PLAYER_VALUES)) {
    setValue(window, root.querySelector(`[name="${name}"]`), value);
  }
  setValue(window, root.querySelector('[name="simulation_mode"]'), "Exploration", "change");
}

function dispatchKeyboard(window, target, key) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function submit(window, form) {
  assert.ok(form, "missing form");
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
