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
  assert.match(view.textContent, /Exploration/);
  assert.match(view.textContent, /57300\.4/);
  assert.match(view.textContent, /3/);
  assert.match(view.textContent, /Location is not currently established\./);
  assert.doesNotMatch(view.textContent, /Asterion Station/);

  click(view, '[data-campaign-mode="library"]');
  assert.equal(state.mode, "library");
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
  fixture.window.close();
});

test("Creator keeps required fields across four steps and renders a literal review", () => {
  const fixture = installDomFixture();
  const state = { step: "identity", input: {}, status: "" };
  const submitted = [];
  const view = renderCreatorView(state, {
    startCampaign: async (payload) => { submitted.push(payload); },
  });
  fixture.document.body.append(view);

  assert.match(view.className, /\bdirective-creator-workspace\b/);
  assert.deepEqual(
    [...view.querySelectorAll("[data-creator-step]")]
      .filter((element) => element.matches("button"))
      .map((button) => button.textContent),
    ["Identity", "Service", "Command Profile", "Review"],
  );
  assert.equal([...view.querySelectorAll("[name]")].filter((control) => control.required).length, 13);

  setValue(fixture.window, view.querySelector('[name="name"]'), PLAYER_VALUES.name);
  click(view, '[data-creator-step="service"]');
  click(view, '[data-creator-step="identity"]');
  assert.equal(view.querySelector('[name="name"]').value, PLAYER_VALUES.name);

  for (const [name, value] of Object.entries(PLAYER_VALUES)) {
    setValue(fixture.window, view.querySelector(`[name="${name}"]`), value);
  }
  setValue(fixture.window, view.querySelector('[name="simulation_mode"]'), "Exploration", "change");
  click(view, '[data-creator-step="review"]');
  assert.equal(state.step, "review");
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
  assert.match(container.querySelector('[role="status"]')?.textContent || "", /Opening story/i);
  fixture.window.close();
});

function campaignProjection() {
  return {
    chat_id: 27,
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace", simulation_mode: "Exploration" },
    viewer: { name: "Avery Quill" },
    ship: {},
    mission: { id: "prelude-a-ship-underway", status: "active" },
    time: { stardate: 57300.4, clock_display: "16:42:00" },
    journey: { completed_count: 3 },
    media: { ship: { alt: "U.S.S. Breckenridge", variants: { hero: "/breckenridge.webp" } } },
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

async function submit(window, form) {
  assert.ok(form, "missing form");
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
