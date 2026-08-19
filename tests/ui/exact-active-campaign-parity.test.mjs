import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { renderCampaignView } from "../../ui/views/campaign.js";

test("active Campaign opens on Directive's dashboard and exposes the official controls", () => {
  const fixture = installDomFixture();
  const state = { mode: "command" };
  const calls = [];
  let view;
  const redraw = () => {
    view = renderCampaignView(campaignProjection(), state, {
      continueCampaign: (chatId) => calls.push(["continue", chatId]),
      saveGame: () => calls.push(["save"]),
      loadGame: () => calls.push(["load"]),
      deleteCampaign: () => calls.push(["delete"]),
      redraw,
    });
    fixture.document.body.replaceChildren(view);
  };
  redraw();

  assert.equal(view.dataset.campaignView, "dashboard");
  assert.match(view.className, /\bcampaign-dashboard\b/);
  assert.equal(view.querySelector(".directive-campaign-command-bar"), null);
  assert.deepEqual(
    [...view.querySelectorAll("button")].map((button) => button.textContent.trim()),
    ["Campaigns", "Continue", "Save Game", "Load Game", ""],
  );
  assert.equal(view.querySelector('[data-campaign-action="delete"]')?.getAttribute("aria-label"), "Delete campaign");
  assert.match(view.textContent, /Current Campaign/);
  assert.match(view.textContent, /Ashes of Peace/);
  assert.match(view.textContent, /Avery Quill \/ Executive Officer \/ U\.S\.S\. Breckenridge/);
  assert.match(view.textContent, /Take command aboard a newly refitted starship/);
  assert.doesNotMatch(view.textContent, /unavailable in the Sonder migration/i);

  click(view, '[data-campaign-action="continue"]');
  click(view, '[data-campaign-action="save"]');
  click(view, '[data-campaign-action="load"]');
  click(view, '[data-campaign-action="delete"]');
  assert.deepEqual(calls, [["continue", 27], ["save"], ["load"], ["delete"]]);
  fixture.window.close();
});

test("Campaigns switches to Directive's complete browser and back to the current campaign", () => {
  const fixture = installDomFixture();
  const state = { mode: "command" };
  let view;
  const redraw = () => {
    view = renderCampaignView(campaignProjection(), state, { redraw });
    fixture.document.body.replaceChildren(view);
  };
  redraw();

  click(view, '[data-campaign-action="campaigns"]');
  assert.equal(state.mode, "browser");
  assert.equal(view.dataset.campaignView, "browser");
  assert.equal(view.querySelector('[data-campaign-action="back-to-current"]')?.textContent, "Back to Current Campaign");
  assert.deepEqual(
    [...view.querySelectorAll(".campaign-desktop-master .campaign-row strong")].map((node) => node.textContent),
    ["Ashes of Peace", "Ashes of Peace", "Drowned Constellation", "Black Current", "Broken Accord", "Unseen Border", "Enemy's Garden"],
  );

  click(view, '[data-campaign-action="back-to-current"]');
  assert.equal(state.mode, "command");
  assert.equal(view.dataset.campaignView, "dashboard");
  fixture.window.close();
});

function campaignProjection() {
  return {
    chat_id: 27,
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace", premise: "Take command aboard a newly refitted starship." },
    viewer: { name: "Avery Quill" },
    player: { name: "Avery Quill", billet: "Executive Officer" },
    ship: { name: "U.S.S. Breckenridge", class_name: "Intrepid-class" },
    mission: { id: "prelude-a-ship-underway", status: "active" },
    time: { stardate: 57300.4, clock_display: "16:42:00" },
    media: {
      ship: {
        alt: "U.S.S. Breckenridge",
        variants: { hero: "/breckenridge.webp" },
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
