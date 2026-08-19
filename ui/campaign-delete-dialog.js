import { appendText, createElement } from "./primitives.js";

export function createCampaignDeleteDialog({ campaign, opener = null, onDelete = null } = {}) {
  const shell = document.querySelector?.(".directive-runtime-panel") || null;
  const shellWasInert = shell?.inert === true;
  if (shell) shell.inert = true;
  let busy = false;

  const overlay = createElement("div", "campaign-delete-dialog-overlay");
  overlay.dataset.campaignDeleteModal = String(campaign?.id || "campaign");
  overlay.dataset.campaignDeleteState = "confirming";
  const dialog = createElement("section", "campaign-delete-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "campaign-delete-dialog-title");
  dialog.setAttribute("aria-busy", "false");
  dialog.tabIndex = -1;
  const header = createElement("header", "campaign-delete-dialog-header");
  const title = appendText(createElement("h2", "campaign-delete-dialog-title"), "Delete campaign?");
  title.id = "campaign-delete-dialog-title";
  const closeButton = appendText(createElement("button", "campaign-delete-dialog-close"), "×");
  closeButton.type = "button";
  closeButton.dataset.campaignDeleteAction = "close";
  closeButton.setAttribute("aria-label", "Close campaign deletion confirmation");
  header.append(title, closeButton);

  const body = createElement("div", "campaign-delete-dialog-body");
  body.dataset.directiveScrollOwner = "true";
  const warning = appendText(createElement("p", "campaign-delete-dialog-warning"), `This will permanently delete the Sonder story "${campaign?.title || ""}" and its saved timelines.`);
  const instruction = appendText(createElement("p", "campaign-delete-dialog-instruction"), "Type delete to confirm.");
  const field = createElement("label", "campaign-delete-dialog-field");
  field.setAttribute("for", "campaign-delete-confirmation");
  const input = createElement("input", "campaign-delete-dialog-input");
  input.id = "campaign-delete-confirmation";
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "none";
  input.spellcheck = false;
  field.append(appendText(createElement("span", "campaign-delete-dialog-label"), "Confirmation"), input);
  const error = createElement("p", "campaign-delete-dialog-error");
  error.setAttribute("role", "alert");
  error.setAttribute("aria-live", "assertive");
  error.hidden = true;
  const actions = createElement("div", "campaign-delete-dialog-actions");
  const cancelButton = appendText(createElement("button", "campaign-command"), "Cancel");
  cancelButton.type = "button";
  cancelButton.dataset.campaignDeleteAction = "cancel";
  const deleteButton = appendText(createElement("button", "campaign-command campaign-command-danger campaign-delete-confirm"), "Delete");
  deleteButton.type = "button";
  deleteButton.dataset.campaignDeleteAction = "delete";
  deleteButton.disabled = true;
  actions.append(cancelButton, deleteButton);
  body.append(warning, instruction, field, error, actions);
  dialog.append(header, body);
  overlay.append(dialog);
  document.body.append(overlay);

  const setControlsDisabled = (disabled) => {
    input.disabled = disabled;
    cancelButton.disabled = disabled;
    closeButton.disabled = disabled;
    deleteButton.disabled = disabled || !normalizedConfirmation(input.value);
  };
  const close = (reason = "dismissed") => {
    if (busy || !overlay.isConnected) return { closed: false, reason };
    overlay.remove();
    if (shell) shell.inert = shellWasInert;
    opener?.focus?.({ preventScroll: true });
    return { closed: true, reason };
  };
  input.addEventListener("input", () => { deleteButton.disabled = busy || !normalizedConfirmation(input.value); });
  closeButton.addEventListener("click", () => { if (!busy) close("close-control"); });
  cancelButton.addEventListener("click", () => { if (!busy) close("cancel"); });
  deleteButton.addEventListener("click", async (event) => {
    event.preventDefault();
    if (busy || !normalizedConfirmation(input.value)) return;
    busy = true;
    overlay.dataset.campaignDeleteState = "deleting";
    error.hidden = true;
    error.textContent = "";
    deleteButton.textContent = "Deleting...";
    setControlsDisabled(true);
    dialog.setAttribute("aria-busy", "true");
    dialog.focus?.({ preventScroll: true });
    try {
      await onDelete?.({ campaignId: campaign?.id });
      busy = false;
      close("deleted");
    } catch (cause) {
      busy = false;
      overlay.dataset.campaignDeleteState = "error";
      dialog.setAttribute("aria-busy", "false");
      error.textContent = cause?.message || String(cause || "Campaign deletion failed.");
      error.hidden = false;
      deleteButton.textContent = "Delete";
      setControlsDisabled(false);
      input.focus?.({ preventScroll: true });
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) close("escape");
      return;
    }
    if (event.key !== "Tab") return;
    if (busy) {
      event.preventDefault();
      dialog.focus?.({ preventScroll: true });
      return;
    }
    const focusable = [input, closeButton, cancelButton, deleteButton].filter((candidate) => !candidate.disabled && !candidate.hidden);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  input.focus?.({ preventScroll: true });
  return { overlay, dialog, input, error, cancelButton, deleteButton, close, isOpen: () => overlay.isConnected === true };
}

function normalizedConfirmation(value) {
  return String(value || "").trim().toLowerCase() === "delete";
}
