import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createDirectiveView } from "../../ui/app.js";
import { renderCampaignView } from "../../ui/views/campaign.js";
import { renderCreatorView } from "../../ui/views/creator.js";

const PLAYER_VALUES = Object.freeze({
  name: "Avery Quill",
  pronouns_or_address: "Commander Quill",
  species: "human",
  age_band: "mid-career",
  appearance: "Close-cropped dark hair and a composed bearing.",
  career_background: "operations-logistics",
  formative_experience: "dominion-war-fleet-service",
  assignment_reason: "requested-by-captain",
  insight_trait: "analytical",
  connection_trait: "candid",
  execution_trait: "decisive",
  flaw: "guarded",
});

const PLAYER_START_PAYLOAD = Object.freeze({
  name: "Avery Quill",
  pronouns_or_address: "Commander Quill",
  species: "Human",
  age_band: "Mid-career",
  appearance: "Close-cropped dark hair and a composed bearing.",
  career_background: "Operations and logistics",
  formative_experience: "Dominion War fleet service",
  assignment_reason: "Requested by the captain",
  insight_trait: "Analytical",
  connection_trait: "Candid",
  execution_trait: "Decisive",
  flaw: "Guarded",
});

const STEP_FIELDS = Object.freeze({
  identity: Object.freeze(["name", "pronouns_or_address", "species", "age_band", "appearance"]),
  service: Object.freeze(["career_background", "formative_experience", "assignment_reason"]),
  personality: Object.freeze(["insight_trait", "connection_trait", "execution_trait", "flaw"]),
});

test("Campaign renders Directive's dashboard without inventing missing facts", () => {
  const fixture = installDomFixture();
  const data = campaignProjection();
  const state = { mode: "command" };
  const view = renderCampaignView(data, state, {});
  fixture.document.body.append(view);

  assert.match(view.className, /\bcampaign-dashboard\b/);
  assert.match(view.className, /\bdirective-expanded-campaign\b/);
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-heading"));
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-hero"));
  assert.ok(view.querySelector(".campaign-dashboard > .campaign-dashboard-actions"));
  assert.equal(view.querySelector(".directive-campaign-command-bar"), null);
  assert.match(view.textContent, /Ashes of Peace/);
  assert.match(view.textContent, /Avery Quill/);
  assert.match(view.textContent, /prelude-a-ship-underway/);
  assert.doesNotMatch(view.textContent, /package high concept must not replace the current chapter/i);
  assert.doesNotMatch(view.textContent, /Asterion Station/);

  const absent = renderCampaignView({ campaign: {}, mission: {}, viewer: {}, ship: {} }, { mode: "command" }, {});
  assert.match(absent.textContent, /Campaign title unavailable\./);
  assert.match(absent.textContent, /Player identity unavailable\./);
  assert.match(absent.textContent, /Current mission unavailable\./);
  assert.doesNotMatch(absent.textContent, /Ashes of Peace/);

  const unprojectedShip = renderCampaignView({ campaign: { id: "ashes-of-peace" }, ship: {} }, { mode: "command" }, {});
  assert.doesNotMatch(unprojectedShip.textContent, /U\.S\.S\. Breckenridge/);
  assert.doesNotMatch(unprojectedShip.textContent, /Intrepid-class/);
  fixture.window.close();
});

test("Campaign media fails to a framed placeholder and null metrics stay unavailable", () => {
  const fixture = installDomFixture();
  const data = campaignProjection();
  data.time.stardate = null;
  data.journey.completed_count = null;
  const view = renderCampaignView(data, { mode: "command" }, {});
  fixture.document.body.append(view);

  const frame = view.querySelector(".campaign-hero-media");
  const image = frame?.querySelector("img");
  const placeholder = frame?.querySelector(".directive-media-placeholder");
  assert.ok(frame);
  assert.match(frame.className, /\bdirective-hero-scene\b/);
  assert.equal(view.querySelector(".campaign-dashboard-hero")?.dataset.heroOrbitBound, "true");
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

test("Creator renders Directive's official commissioning structure and locked progression", async () => {
  const fixture = installDomFixture();
  const state = { step: "identity", input: {}, status: "" };
  const view = renderCreatorView(state, {});
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-creator-workspace\b/);
  assert.match(view.className, /\bdirective-creator-console\b/);
  assert.match(view.className, /\bdirective-lcars-panel\b/);
  assert.equal(view.noValidate, true);
  assert.equal(view.dataset.creatorForm, "true");
  assert.equal(view.dataset.directiveScrollOwner, "true");
  assert.ok(view.querySelector(".directive-creator-overview-media-deck .directive-creator-overview-media img"));
  assert.ok(view.querySelector(".directive-creator-portrait-tile .directive-player-portrait-frame"));
  assert.deepEqual(
    [...view.querySelectorAll("[data-creator-step-button]")]
      .map((button) => button.querySelector("span:not(.directive-creator-step-state)")?.textContent),
    ["Identity", "Service", "Personality", "Review"],
  );
  assert.equal(view.dataset.creatorActiveStep, "identity");
  const stepButtons = [...view.querySelectorAll("[data-creator-step-button]")];
  assert.deepEqual(
    stepButtons.map((button) => [button.dataset.creatorStepState, button.disabled]),
    [["active", false], ["locked", true], ["locked", true], ["locked", true]],
  );
  assert.deepEqual(
    [...view.querySelectorAll(".directive-creator-command-bar .directive-button")].map((button) => button.textContent.trim()),
    ["Campaign Library", "Save Draft", "Back", "Next: Service", "Discard Character"],
  );
  assert.deepEqual(
    [...view.querySelectorAll('[data-creator-step="identity"] .directive-field-control')].map((control) => control.dataset.inputPath),
    ["identity.name", "identity.pronounsOrAddress", "identity.speciesId", "identity.ageBandId", "identity.appearance"],
  );
  assert.equal(view.querySelector('[name="species"]')?.tagName, "SELECT");
  assert.equal(view.querySelector('[name="age_band"]')?.tagName, "SELECT");
  assert.equal(view.querySelector('[data-creator-step="service"] [data-creator-section-wand="service"]')?.disabled, true);

  click(view, ".directive-creator-next-command");
  assert.equal(state.step, "identity");
  assert.match(view.querySelector('[role="status"]')?.textContent || "", /Complete Identity before continuing/);

  fillStep(fixture.window, view, "identity");
  click(view, ".directive-creator-next-command");
  assert.equal(state.step, "service");
  assert.equal(view.dataset.creatorActiveStep, "service");
  assert.equal(stepButtons[0].dataset.creatorStepState, "complete");
  assert.equal(stepButtons[1].dataset.creatorStepState, "active");
  assert.equal(stepButtons[2].disabled, true);
  fixture.window.close();
});

test("Creator completes every official section, renders difficulty cards, and submits the full dossier", async () => {
  const fixture = installDomFixture();
  const state = { step: "identity", input: {}, status: "" };
  const submitted = [];
  const view = renderCreatorView(state, {
    provisionCampaign: async (payload) => { submitted.push(payload); return 44; },
    openCampaign: async () => {},
    refreshCampaign: async () => {},
  });
  fixture.document.body.append(view);

  fillStep(fixture.window, view, "identity");
  click(view, ".directive-creator-next-command");
  fillStep(fixture.window, view, "service");
  click(view, ".directive-creator-next-command");
  fillStep(fixture.window, view, "personality");
  click(view, ".directive-creator-next-command");
  assert.equal(state.step, "review");
  assert.equal(view.dataset.creatorActiveStep, "review");
  assert.equal(view.querySelectorAll(".directive-creator-difficulty-option").length, 2);
  assert.equal(view.querySelector('[data-creator-difficulty-option="Command"]')?.getAttribute("aria-checked"), "true");
  click(view, '[data-creator-difficulty-option="Exploration"]');
  assert.equal(view.querySelector('[name="simulation_mode"]')?.value, "Exploration");
  assert.match(view.querySelector(".directive-creator-difficulty-summary")?.textContent || "", /Story-forward/);
  setValue(fixture.window, view.querySelector('[name="brief_biography"]'), "Avery Quill earned command through difficult relief work.");
  setValue(fixture.window, view.querySelector('[name="public_reputation"]'), "Known as a careful and candid officer.");

  await submit(fixture.window, view);
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0], {
    ...PLAYER_START_PAYLOAD,
    service_summary: "Operations and logistics; shaped by Dominion War fleet service.",
    command_style: "Analytical, Candid, and Decisive; Guarded remains a pressure point.",
    brief_biography: "Avery Quill earned command through difficult relief work.",
    public_reputation: "Known as a careful and candid officer.",
    simulation_mode: "Exploration",
  });
  fixture.window.close();
});

test("Creator session draft, discard, portrait, and bounded assist controls are functional", async () => {
  const fixture = installDomFixture();
  const state = { step: "identity", input: {}, status: "" };
  let libraryReturns = 0;
  let discards = 0;
  const view = renderCreatorView(state, {
    returnToCampaignLibrary: () => { libraryReturns += 1; },
    discardCreatorDraft: () => { discards += 1; },
    generateCreatorSectionDraft: async () => ({
      ok: true,
      source: "local-fallback",
      mode: "create",
      fields: {
        "identity.name": "Ari Venn",
        "identity.pronounsOrAddress": "Commander Venn",
        "identity.speciesId": "human",
        "identity.ageBandId": "mid-career",
        "identity.appearance": "A composed officer with an observant command presence.",
      },
      notes: ["Review before applying."],
    }),
  });
  fixture.document.body.append(view);

  click(view, ".directive-creator-save-command");
  assert.match(view.querySelector('[role="status"]')?.textContent || "", /Draft saved in this Directive session/);
  click(view, ".directive-creator-route-exit-command");
  assert.equal(libraryReturns, 1);

  click(view, '[data-creator-section-wand="identity"]');
  await tick();
  const dialog = fixture.document.querySelector('[data-creator-assist-modal="identity"]');
  assert.equal(dialog?.dataset.creatorAssistState, "result");
  click(dialog, '[data-creator-assist-action="apply"]');
  await tick();
  assert.equal(view.querySelector('[name="name"]')?.value, "Ari Venn");
  assert.equal(state.input.name, "Ari Venn");

  const fileInput = view.querySelector('.directive-creator-portrait-tile input[type="file"]');
  const portrait = new fixture.window.File([new Uint8Array([137, 80, 78, 71])], "avery.png", { type: "image/png" });
  Object.defineProperty(fileInput, "files", { configurable: true, value: [portrait] });
  fileInput.dispatchEvent(new fixture.window.Event("change", { bubbles: true }));
  await tick();
  assert.match(state.input.portrait_data_url || "", /^data:image\/png;base64,/);
  assert.match(view.querySelector(".directive-creator-player-portrait img")?.src || "", /^data:image\/png;base64,/);
  click(view, ".directive-creator-portrait-remove");
  assert.equal(state.input.portrait_data_url, "");

  fixture.window.confirm = () => true;
  globalThis.confirm = fixture.window.confirm;
  click(view, ".directive-creator-discard-command");
  assert.equal(discards, 1);
  assert.deepEqual(state.input, { simulation_mode: "Command" });
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
  openCreator(container);
  assert.ok(container.querySelector(".directive-creator-workspace"));
  fillCreator(fixture.window, container);

  await submit(fixture.window, container.querySelector("form"));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    method: "POST",
    path: "/api/extensions/directive/x/start",
    body: {
      ...PLAYER_START_PAYLOAD,
      service_summary: "Operations and logistics; shaped by Dominion War fleet service.",
      command_style: "Analytical, Candid, and Decisive; Guarded remains a pressure point.",
      brief_biography: "Avery Quill is a Human Starfleet Commander assigned as Executive Officer of the U.S.S. Breckenridge on stardate 53068.4. Their background in Operations and logistics and formative experience with Dominion War fleet service made them a credible choice for the Asterion Reach mission. Their command style is shaped by Analytical, Candid, and Decisive, while Guarded remains a pressure point they will need to manage in command.",
      public_reputation: "Avery Quill is regarded as a capable Commander whose Operations and logistics background makes the Breckenridge assignment plausible, though the crew is still learning what kind of XO they have received.",
      simulation_mode: "Exploration",
    },
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
  openCreator(container);
  fillCreator(fixture.window, container);
  click(container, '[data-creator-step="review"]');

  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 1, 0]);
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /created.*retry opening/i);
  await submit(fixture.window, container.querySelector("form"));
  assert.deepEqual([posts, opens, refreshes], [1, 2, 1]);
  fixture.window.close();
});

test("Creator app keeps session drafts and routes bounded assist through Sonder", async () => {
  const fixture = installDomFixture();
  const calls = [];
  const sonder = {
    state: () => ({ chatId: null }),
    api: async (method, path, body) => {
      calls.push({ method, path, body });
      return {
        ok: true,
        source: "provider",
        mode: "create",
        fields: { "identity.name": "Ari Venn" },
        notes: [],
        warnings: [],
      };
    },
    chats: { open: async () => {} },
    refresh: async () => {},
    closeView: () => {},
  };
  const container = fixture.document.createElement("div");
  fixture.document.body.append(container);
  await createDirectiveView(sonder).render(container);
  openCreator(container);

  const wand = container.querySelector('[data-creator-section-wand="identity"]');
  assert.equal(wand?.disabled, false);
  click(container, '[data-creator-section-wand="identity"]');
  await tick();
  assert.deepEqual(calls[0], {
    method: "POST",
    path: "/api/extensions/directive/x/creator-assist",
    body: { section_id: "identity", input: { simulation_mode: "Command" } },
  });
  click(fixture.document, '[data-creator-assist-action="apply"]');
  await tick();
  assert.equal(container.querySelector('[name="name"]')?.value, "Ari Venn");

  click(container, ".directive-creator-save-command");
  click(container, ".directive-creator-route-exit-command");
  assert.ok(container.querySelector(".campaign-browser"));
  openCreator(container);
  assert.equal(container.querySelector('[name="name"]')?.value, "Ari Venn");
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
  openCreator(container);
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
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace", summary: "Package high concept must not replace the current chapter.", simulation_mode: "Exploration" },
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
  fillStep(window, root, "identity");
  click(root, ".directive-creator-next-command");
  fillStep(window, root, "service");
  click(root, ".directive-creator-next-command");
  fillStep(window, root, "personality");
  click(root, ".directive-creator-next-command");
  setValue(window, root.querySelector('[name="simulation_mode"]'), "Exploration", "change");
}

function fillStep(window, root, step) {
  for (const name of STEP_FIELDS[step]) {
    setValue(window, root.querySelector(`[name="${name}"]`), PLAYER_VALUES[name],
      root.querySelector(`[name="${name}"]`)?.tagName === "SELECT" ? "change" : "input");
  }
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function openCreator(root) {
  click(root, '.campaign-desktop-detail .campaign-command-primary');
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
