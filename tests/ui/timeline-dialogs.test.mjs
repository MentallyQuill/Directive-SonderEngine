import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { createCampaignDeleteDialog } from "../../ui/campaign-delete-dialog.js";
import { createLoadGameDialog, createSaveGameDialog } from "../../ui/timeline-dialogs.js";

test("Save Game uses Directive's modal, validates a name, and returns the saved record", async () => {
  const fixture = installDomFixture();
  const opener = fixture.document.createElement("button");
  fixture.document.body.append(opener);
  const calls = [];
  const dialog = createSaveGameDialog({
    campaign: { chapter: "Prelude: A Ship Underway" },
    opener,
    onSave: async (value) => { calls.push(value); return { id: "save-42" }; },
  });

  assert.ok(fixture.document.body.querySelector(".save-game-dialog-overlay"));
  assert.equal(dialog.input.value, "Before Prelude: A Ship Underway");
  dialog.input.value = "Before the briefing";
  dialog.input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.primary.click();
  await settle();

  assert.deepEqual(calls, [{ name: "Before the briefing" }]);
  assert.equal(fixture.document.body.querySelector(".save-game-dialog-overlay"), null);
  fixture.window.close();
});

test("Load Game selects, loads, and deletes immutable saved timelines", async () => {
  const fixture = installDomFixture();
  globalThis.confirm = () => true;
  const loaded = [];
  const deleted = [];
  const savedGame = {
    id: "save-42",
    name: "Before the briefing",
    chapter: "Prelude: A Ship Underway",
    stardate: 53068.4,
    createdAt: "2026-08-18T12:34:56.000Z",
  };
  const dialog = createLoadGameDialog({
    campaign: { savedGames: [savedGame] },
    onLoad: async (value) => loaded.push(value),
    onDelete: async (value) => deleted.push(value),
  });

  assert.equal(dialog.primary.disabled, true);
  assert.match(dialog.rows[0].textContent, /Before the briefing.*Prelude: A Ship Underway.*Stardate 53068\.4/s);
  dialog.rows[0].click();
  assert.equal(dialog.primary.disabled, false);
  dialog.primary.click();
  await settle();
  assert.deepEqual(loaded, [{ savedGameId: "save-42" }]);

  const second = createLoadGameDialog({
    campaign: { savedGames: [savedGame] },
    onDelete: async (value) => deleted.push(value),
  });
  second.deleteButtons[0].click();
  await settle();
  assert.deepEqual(deleted, [{ savedGameId: "save-42" }]);
  assert.equal(second.entries.length, 0);
  fixture.window.close();
});

test("saved-game deletion disables every action and keeps focus inside the busy dialog", async () => {
  const fixture = installDomFixture();
  globalThis.confirm = () => true;
  let finishDelete;
  const dialog = createLoadGameDialog({
    campaign: { savedGames: [{ id: "save-42", name: "Before the briefing" }] },
    onDelete: () => new Promise((resolve) => { finishDelete = resolve; }),
  });
  dialog.rows[0].click();
  dialog.deleteButtons[0].click();

  assert.equal(dialog.primary.disabled, true);
  assert.equal(dialog.cancel.disabled, true);
  assert.equal(dialog.rows[0].disabled, true);
  assert.equal(fixture.document.activeElement, dialog.dialog);
  dialog.dialog.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  assert.equal(fixture.document.activeElement, dialog.dialog);

  finishDelete();
  await settle();
  fixture.window.close();
});

test("failed saved-game deletion does not enable Load Game without a selection", async () => {
  const fixture = installDomFixture();
  globalThis.confirm = () => true;
  const dialog = createLoadGameDialog({
    campaign: { savedGames: [{ id: "save-42", name: "Before the briefing" }] },
    onDelete: async () => { throw new Error("Story deletion failed."); },
  });

  dialog.deleteButtons[0].click();
  await settle();

  assert.equal(dialog.primary.disabled, true);
  assert.equal(dialog.deleteButtons[0].disabled, false);
  assert.equal(dialog.error.hidden, false);
  fixture.window.close();
});

test("campaign deletion requires the literal confirmation and names Sonder ownership", async () => {
  const fixture = installDomFixture();
  let deleted = 0;
  const dialog = createCampaignDeleteDialog({
    campaign: { id: 27, title: "Ashes of Peace", savedGames: [{ id: "save-42" }] },
    onDelete: async () => { deleted += 1; },
  });

  assert.match(dialog.dialog.textContent, /permanently delete the Sonder story "Ashes of Peace" and its saved timelines/);
  assert.doesNotMatch(dialog.dialog.textContent, /SillyTavern|character card/i);
  assert.equal(dialog.deleteButton.disabled, true);
  dialog.input.value = "delete";
  dialog.input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  assert.equal(dialog.deleteButton.disabled, false);
  dialog.deleteButton.click();
  await settle();
  assert.equal(deleted, 1);
  assert.equal(dialog.isOpen(), false);
  fixture.window.close();
});

test("timeline dialogs trap focus, inert the shell, and cannot dismiss while an operation is busy", async () => {
  const fixture = installDomFixture();
  const shell = fixture.document.createElement("section");
  shell.className = "directive-runtime-panel";
  fixture.document.body.append(shell);
  let rejectSave;
  const dialog = createSaveGameDialog({
    onSave: () => new Promise((_resolve, reject) => { rejectSave = reject; }),
  });
  dialog.input.value = "Retryable save";
  dialog.input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));

  dialog.primary.focus();
  dialog.dialog.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  assert.equal(fixture.document.activeElement, dialog.input);
  dialog.input.focus();
  dialog.dialog.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
  assert.equal(fixture.document.activeElement, dialog.primary);
  assert.equal(shell.inert, true);

  dialog.primary.click();
  assert.equal(dialog.cancel.disabled, true);
  assert.equal(dialog.dialog.getAttribute("aria-busy"), "true");
  assert.equal(fixture.document.activeElement, dialog.dialog);
  dialog.dialog.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  dialog.cancel.click();
  assert.ok(fixture.document.body.querySelector(".save-game-dialog-overlay"));

  rejectSave(new Error("Temporary save failure."));
  await settle();
  assert.equal(dialog.cancel.disabled, false);
  assert.equal(dialog.dialog.getAttribute("aria-busy"), "false");
  assert.equal(dialog.error.hidden, false);
  assert.match(dialog.error.textContent, /Temporary save failure/);
  dialog.cancel.click();
  assert.equal(shell.inert, false);
  fixture.window.close();
});

test("campaign deletion exposes an aria-busy focus target until the host operation settles", async () => {
  const fixture = installDomFixture();
  let failDelete;
  const dialog = createCampaignDeleteDialog({
    campaign: { id: 27, title: "Ashes of Peace" },
    onDelete: () => new Promise((_resolve, reject) => { failDelete = reject; }),
  });
  dialog.input.value = "delete";
  dialog.input.dispatchEvent(new fixture.window.Event("input", { bubbles: true }));
  dialog.deleteButton.click();

  assert.equal(dialog.dialog.getAttribute("aria-busy"), "true");
  assert.equal(fixture.document.activeElement, dialog.dialog);
  dialog.dialog.dispatchEvent(new fixture.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  assert.equal(fixture.document.activeElement, dialog.dialog);

  failDelete(new Error("Temporary campaign deletion failure."));
  await settle();
  assert.equal(dialog.dialog.getAttribute("aria-busy"), "false");
  assert.equal(dialog.input.disabled, false);
  assert.equal(dialog.error.hidden, false);
  fixture.window.close();
});

function installDomFixture() {
  const window = new Window();
  globalThis.document = window.document;
  return { window, document: window.document };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
