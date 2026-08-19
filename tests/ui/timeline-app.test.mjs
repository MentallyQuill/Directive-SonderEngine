import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createDirectiveView } from "../../ui/app.js";

test("active campaign Save Game clones the full Sonder story and registers it", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness();
  await harness.render(fixture.document);

  const save = fixture.document.querySelector('[data-campaign-action="save"]');
  assert.equal(save?.disabled, false);
  save.click();
  const dialog = fixture.document.querySelector(".save-game-dialog-overlay");
  assert.ok(dialog);
  const input = dialog.querySelector("input");
  input.value = "Before the briefing";
  input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.querySelector(".campaign-command-primary").click();
  await settle(4);

  assert.deepEqual(harness.calls.filter(([kind]) => kind !== "projection").map(([kind, url]) => [kind, url]), [
    ["GET", "/api/chats/27/export"],
    ["POST", "/api/chats/import"],
    ["POST", "/api/extensions/directive/x/saves?chat_id=27"],
  ]);
  assert.equal(harness.projection.saved_games[0].name, "Before the briefing");
  assert.equal(harness.projection.saved_games[0].chat_id, 80);
  fixture.window.close();
});

test("Save Game compensates the imported clone when registry registration fails", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness({ failRegister: true });
  await harness.render(fixture.document);

  fixture.document.querySelector('[data-campaign-action="save"]').click();
  const dialog = fixture.document.querySelector(".save-game-dialog-overlay");
  dialog.querySelector("input").value = "Retryable save";
  dialog.querySelector("input").dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.querySelector(".campaign-command-primary").click();
  await settle(5);

  assert.deepEqual(
    harness.calls.filter(([kind]) => kind !== "projection").map(([kind, url]) => [kind, url]),
    [
      ["GET", "/api/chats/27/export"],
      ["POST", "/api/chats/import"],
      ["POST", "/api/extensions/directive/x/saves?chat_id=27"],
      ["DELETE", "/api/chats/80"],
    ],
  );
  assert.equal(dialog.querySelector(".timeline-dialog-error").hidden, false);
  fixture.window.close();
});

test("Load Game registers the existing current story in the loaded timeline family", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness({ withSave: true });
  await harness.render(fixture.document);

  fixture.document.querySelector('[data-campaign-action="load"]').click();
  const dialog = fixture.document.querySelector(".load-game-dialog-overlay");
  dialog.querySelector(".timeline-saved-game-row").click();
  dialog.querySelector(".timeline-dialog-actions .campaign-command-primary").click();
  await settle(8);

  const operational = harness.calls.filter(([kind]) => kind !== "projection");
  assert.deepEqual(operational.map(([kind, url]) => [kind, url]), [
    ["GET", "/api/chats/42/export"],
    ["POST", "/api/chats/import"],
    ["POST", "/api/extensions/directive/x/saves?chat_id=80"],
  ]);
  assert.equal(operational[2][2].chat_id, 27);
  assert.equal(operational[2][2].name, "Previous timeline");
  assert.deepEqual(harness.opened, [80]);
  assert.equal(harness.closed, 1);
  fixture.window.close();
});

test("saved-game deletion unregisters first and restores the registry if story deletion fails", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness({ withSave: true, failDeleteChatId: 42 });
  await harness.render(fixture.document);

  fixture.document.querySelector('[data-campaign-action="load"]').click();
  const dialog = fixture.document.querySelector(".load-game-dialog-overlay");
  dialog.querySelector(".timeline-saved-game-delete").click();
  await settle(6);

  const operational = harness.calls.filter(([kind]) => kind !== "projection");
  assert.deepEqual(operational.map(([kind, url]) => [kind, url]), [
    ["DELETE", "/api/extensions/directive/x/saves?chat_id=27&saved_game_id=save-42"],
    ["DELETE", "/api/chats/42"],
    ["POST", "/api/extensions/directive/x/saves?chat_id=27"],
  ]);
  assert.equal(dialog.querySelectorAll(".timeline-saved-game-entry").length, 1);
  assert.equal(dialog.querySelector(".timeline-dialog-error").hidden, false);
  assert.equal(harness.projection.saved_games[0].id, "save-42");
  fixture.window.close();
});

test("Delete campaign confirmation removes saved timelines before the active Sonder story", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness({ withSave: true });
  await harness.render(fixture.document);

  fixture.document.querySelector('[data-campaign-action="delete"]').click();
  const dialog = fixture.document.querySelector(".campaign-delete-dialog-overlay");
  const input = dialog.querySelector("input");
  input.value = "delete";
  input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.querySelector('[data-campaign-delete-action="delete"]').click();
  await settle(5);

  assert.deepEqual(
    harness.calls.filter(([kind]) => kind === "DELETE").map(([, url]) => url),
    ["/api/chats/42", "/api/chats/27"],
  );
  assert.equal(harness.closed, 1);
  fixture.window.close();
});

test("campaign deletion is idempotent when a prior attempt already removed a saved timeline", async () => {
  const fixture = installDomFixture();
  const harness = apiHarness({ withSave: true, missingDeleteChatId: 42 });
  await harness.render(fixture.document);

  fixture.document.querySelector('[data-campaign-action="delete"]').click();
  const dialog = fixture.document.querySelector(".campaign-delete-dialog-overlay");
  const input = dialog.querySelector("input");
  input.value = "delete";
  input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.querySelector('[data-campaign-delete-action="delete"]').click();
  await settle(5);

  assert.deepEqual(
    harness.calls.filter(([kind]) => kind === "DELETE").map(([, url]) => url),
    ["/api/chats/42", "/api/chats/27"],
  );
  assert.equal(harness.closed, 1);
  fixture.window.close();
});

function apiHarness({ withSave = false, failDeleteChatId = null, missingDeleteChatId = null, failRegister = false } = {}) {
  const calls = [];
  const opened = [];
  let importedId = 79;
  const projection = campaignProjection();
  if (withSave) projection.saved_games.push(savedGame());
  const sonder = {
    state: () => ({ chatId: 27 }),
    async api(method, url, body) {
      if (url.includes("/projection")) {
        calls.push(["projection", url, body]);
        return structuredClone(projection);
      }
      calls.push([method, url, body]);
      if (method === "GET" && url.endsWith("/export")) {
        const id = Number(url.match(/chats\/(\d+)/)?.[1]);
        return { version: 4, chat: { id, name: "Ashes of Peace" }, world: {} };
      }
      if (method === "POST" && url === "/api/chats/import") return { id: ++importedId };
      if (method === "POST" && url.includes("/x/saves")) {
        if (failRegister) throw new Error("Timeline registry failed.");
        projection.saved_games = [...projection.saved_games.filter((item) => item.id !== body.id), structuredClone(body)];
        return { ok: true, saved_games: structuredClone(projection.saved_games) };
      }
      if (method === "DELETE" && url.includes("/x/saves")) {
        const savedGameId = new URL(url, "https://sonder.invalid").searchParams.get("saved_game_id");
        projection.saved_games = projection.saved_games.filter((item) => item.id !== savedGameId);
        return { ok: true, saved_games: structuredClone(projection.saved_games) };
      }
      if (method === "DELETE" && url === `/api/chats/${failDeleteChatId}`) {
        throw new Error("Story deletion failed.");
      }
      if (method === "DELETE" && url === `/api/chats/${missingDeleteChatId}`) {
        const error = new Error("Story not found.");
        error.status = 404;
        throw error;
      }
      if (method === "DELETE") return { ok: true };
      throw new Error(`unexpected API call ${method} ${url}`);
    },
    chats: { open: async (id) => { opened.push(id); } },
    refresh: async () => {},
    closeView: () => { harness.closed += 1; },
  };
  const harness = {
    calls, opened, projection, closed: 0,
    async render(document) {
      const container = document.createElement("div");
      document.body.append(container);
      await createDirectiveView(sonder).render(container);
    },
  };
  return harness;
}

function campaignProjection() {
  return {
    chat_id: 27,
    campaign: { id: "ashes-of-peace", title: "Ashes of Peace" },
    viewer: { name: "Sam Vickers" },
    player: { name: "Sam Vickers" },
    mission: { id: "prelude-a-ship-underway", title: "Prelude: A Ship Underway", objectives: [] },
    journey: {},
    ship: { name: "U.S.S. Breckenridge", class_name: "Intrepid-class", cohesion: { total: 75, band: { id: "ready", label: "Ready" }, segments: [], issues: [], completed: [] }, systems: [], capabilities: [], constraints: [] },
    command_bearing: { balance: 0, capacity: 3 },
    time: { stardate: 53068.4, clock_display: "08:48:12" },
    people: [],
    saved_games: [],
    media: { ship: { alt: "U.S.S. Breckenridge", variants: { hero: "/breckenridge.webp" } } },
  };
}

function savedGame() {
  return {
    id: "save-42", chat_id: 42, name: "Before the briefing",
    createdAt: "2026-08-18T12:34:56.000Z", chapter: "Prelude: A Ship Underway", stardate: 53068.4,
  };
}

function installDomFixture() {
  const window = new Window();
  globalThis.document = window.document;
  globalThis.confirm = () => true;
  return { window, document: window.document };
}

async function settle(rounds) {
  for (let index = 0; index < rounds; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}
