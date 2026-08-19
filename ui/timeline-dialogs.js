import { appendText, createElement } from "./primitives.js";

let dialogSequence = 0;

export function createSaveGameDialog({ campaign, opener = null, onSave = null, onSaved = null } = {}) {
  const frame = createDialogFrame({ title: "Save Game", className: "save-game-dialog-overlay", opener });
  const explanation = appendText(createElement("p", "timeline-dialog-copy"), "Create an immutable saved game without leaving your current timeline.");
  const label = createElement("label", "timeline-dialog-field");
  const input = createElement("input", "timeline-dialog-input");
  input.type = "text";
  input.value = campaign?.chapter ? `Before ${campaign.chapter}` : "Saved Game";
  label.append(appendText(createElement("span"), "Save name"), input);
  const error = createError();
  frame.dialog.append(explanation, label, error);
  let busy = false;
  const controls = appendDialogActions(frame.dialog, {
    primaryLabel: "Save Game",
    close: frame.close,
    onPrimary: async () => {
      const name = compact(input.value);
      if (!name || busy) return;
      busy = true;
      frame.setBusy(true);
      showError(error, "");
      controls.primary.textContent = "Saving...";
      controls.primary.disabled = true;
      try {
        const result = await onSave?.({ name });
        busy = false;
        frame.setBusy(false);
        controls.primary.textContent = "Save Game";
        frame.close("saved");
        await onSaved?.(result);
      } catch (cause) {
        busy = false;
        frame.setBusy(false);
        controls.primary.textContent = "Save Game";
        controls.primary.disabled = !compact(input.value);
        showError(error, cause?.message || String(cause || "Save Game failed."));
      }
    },
  });
  input.addEventListener("input", () => { controls.primary.disabled = !compact(input.value) || busy; });
  input.focus?.({ preventScroll: true });
  input.select?.();
  return { ...frame, input, error, ...controls };
}

export function createLoadGameDialog({ campaign, opener = null, onLoad = null, onDelete = null } = {}) {
  const frame = createDialogFrame({ title: "Load Game", className: "load-game-dialog-overlay", opener });
  const explanation = appendText(createElement("p", "timeline-dialog-copy"), "Loading this save creates a new timeline. Your current timeline will be preserved automatically.");
  const list = createElement("div", "timeline-saved-game-list");
  const savedGames = campaign?.savedGames || campaign?.checkpoints || [];
  let selectedId = null;
  const entries = [];
  const rows = [];
  const deleteButtons = [];
  const error = createError();
  frame.dialog.append(explanation, list, error);
  const controls = appendDialogActions(frame.dialog, {
    primaryLabel: "Load Game",
    primaryDisabled: true,
    close: frame.close,
    onPrimary: async () => {
      if (!selectedId || controls.primary.disabled) return;
      frame.setBusy(true);
      controls.primary.disabled = true;
      showError(error, "");
      try {
        await onLoad?.({ savedGameId: selectedId });
        frame.setBusy(false);
        frame.close("loaded");
      } catch (cause) {
        frame.setBusy(false);
        showError(error, cause?.message || String(cause || "Load Game failed."));
        controls.primary.disabled = !selectedId;
      }
    },
  });
  for (const savedGame of savedGames) {
    const entry = createElement("div", "timeline-saved-game-entry");
    const row = createElement("button", "timeline-saved-game-row");
    row.type = "button";
    row.dataset.savedGameId = savedGame.id;
    row.setAttribute("aria-pressed", "false");
    row.append(
      appendText(createElement("strong"), savedGame.name || "Saved Game"),
      appendText(createElement("span"), savedGameMeta(savedGame)),
    );
    row.addEventListener("click", () => {
      selectedId = savedGame.id;
      rows.forEach((candidate) => candidate.setAttribute("aria-pressed", candidate === row ? "true" : "false"));
      controls.primary.disabled = false;
    });
    entry.append(row);
    if (typeof onDelete === "function") {
      const remove = appendText(createElement("button", "timeline-saved-game-delete"), "Delete");
      remove.type = "button";
      remove.setAttribute("aria-label", `Delete saved game ${savedGame.name || "Saved Game"}`);
      remove.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof globalThis.confirm !== "function" || globalThis.confirm(`Delete saved game "${savedGame.name || "Saved Game"}"?`);
        if (!confirmed) return;
        frame.setBusy(true);
        remove.disabled = true;
        showError(error, "");
        try {
          await onDelete({ savedGameId: savedGame.id });
          const index = entries.indexOf(entry);
          if (index >= 0) {
            entries.splice(index, 1);
            rows.splice(index, 1);
            deleteButtons.splice(index, 1);
          }
          entry.remove();
          frame.setBusy(false);
          if (selectedId === savedGame.id) selectedId = null;
          controls.primary.disabled = !selectedId;
          if (!entries.length) appendEmpty(list, "No saved games are available to load.");
        } catch (cause) {
          frame.setBusy(false);
          showError(error, cause?.message || String(cause || "Saved game deletion failed."));
          controls.primary.disabled = !selectedId;
          remove.disabled = false;
        }
      });
      deleteButtons.push(remove);
      entry.append(remove);
    }
    entries.push(entry);
    rows.push(row);
    list.append(entry);
  }
  if (!savedGames.length) appendEmpty(list, "No saved games are available to load.");
  return { ...frame, list, entries, rows, deleteButtons, error, ...controls, selectedSavedGameId: () => selectedId };
}

function createDialogFrame({ title, className, opener }) {
  const shell = document.querySelector?.(".directive-runtime-panel") || null;
  const shellWasInert = shell?.inert === true;
  if (shell) shell.inert = true;
  const overlay = createElement("div", `timeline-dialog-overlay ${className || ""}`.trim());
  const dialog = createElement("section", "timeline-dialog");
  const titleId = `directive-timeline-dialog-title-${++dialogSequence}`;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.tabIndex = -1;
  const heading = appendText(createElement("h2", "timeline-dialog-title"), title);
  heading.id = titleId;
  dialog.append(heading);
  overlay.append(dialog);
  document.body.append(overlay);
  let busy = false;
  const setBusy = (value) => {
    busy = Boolean(value);
    dialog.setAttribute("aria-busy", busy ? "true" : "false");
    for (const control of dialog.querySelectorAll("button, input, select, textarea")) {
      control.disabled = busy;
    }
    if (busy) dialog.focus?.({ preventScroll: true });
  };
  const close = (reason = "dismissed") => {
    if (busy) return { closed: false, reason: "busy" };
    overlay.remove();
    if (shell) shell.inert = shellWasInert;
    opener?.focus?.({ preventScroll: true });
    return { closed: true, reason };
  };
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close("escape");
      return;
    }
    if (event.key !== "Tab") return;
    if (busy) {
      event.preventDefault();
      dialog.focus?.({ preventScroll: true });
      return;
    }
    const focusable = [...dialog.querySelectorAll("button, input, select, textarea, [tabindex]")]
      .filter((node) => !node.disabled && node.hidden !== true && node.getAttribute("tabindex") !== "-1");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus?.();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus?.();
    }
  });
  setBusy(false);
  return { overlay, dialog, close, setBusy, isBusy: () => busy };
}

function appendDialogActions(dialog, { primaryLabel, primaryDisabled = false, onPrimary, close }) {
  const actions = createElement("div", "timeline-dialog-actions");
  const cancel = appendText(createElement("button", "campaign-command"), "Cancel");
  cancel.type = "button";
  cancel.dataset.dialogDismiss = "true";
  const primary = appendText(createElement("button", "campaign-command campaign-command-primary"), primaryLabel);
  primary.type = "button";
  primary.disabled = primaryDisabled;
  cancel.addEventListener("click", () => close("cancel"));
  primary.addEventListener("click", onPrimary);
  actions.append(cancel, primary);
  dialog.append(actions);
  return { actions, cancel, primary };
}

function savedGameMeta(savedGame = {}) {
  const stardate = present(savedGame.stardate) ? String(savedGame.stardate) : "";
  return [savedGame.chapter, stardate ? `Stardate ${stardate}` : "", formatDate(savedGame.createdAt)].filter(Boolean).join(" / ");
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
}

function createError() {
  const error = createElement("p", "timeline-dialog-error");
  error.setAttribute("role", "alert");
  error.setAttribute("aria-live", "assertive");
  error.hidden = true;
  return error;
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

function appendEmpty(container, message) {
  container.append(appendText(createElement("p", "directive-empty-copy"), message));
}

function compact(value) { return String(value ?? "").trim(); }
function present(value) { return value !== undefined && value !== null && String(value).trim() !== ""; }
