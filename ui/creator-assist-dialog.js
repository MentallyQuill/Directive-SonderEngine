import { appendText, createElement } from "./primitives.js";

let activeDialog = null;

export function createCreatorAssistDialog({
  sectionId,
  sectionLabel,
  mode = "create",
  opener = null,
  onRequestClose = null,
} = {}) {
  activeDialog?.requestClose?.("replaced");

  const shell = document.querySelector(".directive-expanded-shell");
  const shellWasInert = shell?.inert === true;
  if (shell) shell.inert = true;

  const overlay = createElement("div", "directive-creator-assist-dialog-overlay");
  overlay.dataset.creatorAssistModal = sectionId || "";
  overlay.dataset.creatorAssistState = "loading";
  const dialog = createElement("section", "directive-creator-assist-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const header = createElement("header", "directive-creator-assist-dialog-header");
  const title = createElement("h2", "directive-creator-assist-dialog-title");
  const closeButton = appendText(createElement("button", "directive-creator-assist-dialog-close"), "×");
  closeButton.type = "button";
  closeButton.dataset.creatorAssistAction = "close";
  closeButton.setAttribute("aria-label", "Close character draft assistant");
  header.append(title, closeButton);
  const body = createElement("div", "directive-creator-assist-dialog-body");
  body.dataset.directiveScrollOwner = "true";
  dialog.append(header, body);
  overlay.append(dialog);
  document.body.append(overlay);

  const loadingTitle = `${mode === "refine" ? "Refining" : "Drafting"} ${sectionLabel || "Character"}`;
  const requestClose = (reason = "dismissed") => {
    onRequestClose?.(reason);
    return close(reason);
  };
  const close = (reason = "dismissed") => {
    if (!overlay.isConnected) return { closed: false, reason };
    overlay.remove();
    if (shell) shell.inert = shellWasInert;
    opener?.focus?.({ preventScroll: true });
    if (activeDialog?.overlay === overlay) activeDialog = null;
    return { closed: true, reason };
  };
  const button = (label, action, handler, icon = "") => {
    const value = createElement("button", "directive-button");
    value.type = "button";
    value.dataset.creatorAssistAction = action;
    if (icon) {
      const glyph = createElement("i", `fa-solid ${icon}`);
      glyph.setAttribute("aria-hidden", "true");
      value.append(glyph);
    }
    value.append(appendText(createElement("span"), label));
    value.addEventListener("click", async (event) => {
      event.preventDefault();
      await handler?.();
    });
    return value;
  };
  const showProgress = (message = "Generating with Reasoning...") => {
    overlay.dataset.creatorAssistState = "loading";
    title.textContent = loadingTitle;
    dialog.setAttribute("aria-label", loadingTitle);
    const loading = createElement("div", "directive-creator-assist-dialog-loading");
    const spinner = createElement("span", "directive-creator-assist-dialog-spinner");
    spinner.setAttribute("aria-hidden", "true");
    const progress = appendText(createElement("p", "directive-creator-assist-dialog-progress"), message);
    progress.setAttribute("role", "status");
    progress.setAttribute("aria-live", "polite");
    loading.append(spinner, progress);
    const actions = createElement("div", "directive-creator-assist-dialog-actions");
    const cancel = button("Cancel", "cancel", () => requestClose("cancel"));
    cancel.classList.add("directive-creator-assist-dialog-cancel");
    actions.append(cancel);
    body.replaceChildren(loading, actions);
    cancel.focus?.({ preventScroll: true });
  };
  const showResult = ({
    resultTitle = "Suggested Draft",
    source = "Provider",
    fields = [],
    message = "Review before applying to this section.",
    onApply,
    onRegenerate,
    onDismiss,
  } = {}) => {
    overlay.dataset.creatorAssistState = "result";
    title.textContent = resultTitle;
    dialog.setAttribute("aria-label", resultTitle);
    const sourceLabel = appendText(createElement("p", "directive-creator-assist-dialog-source"), source);
    const list = createElement("dl", "directive-creator-assist-dialog-field-list");
    for (const field of fields) {
      list.append(
        appendText(createElement("dt", "directive-creator-assist-dialog-field-label"), field.label || ""),
        appendText(createElement("dd", "directive-creator-assist-dialog-field-value"), field.value || ""),
      );
    }
    const note = appendText(createElement("p", "directive-creator-assist-dialog-note"), message);
    const actions = createElement("div", "directive-creator-assist-dialog-actions");
    const apply = button("Apply", "apply", onApply, "fa-check");
    actions.append(
      apply,
      button("Regenerate", "regenerate", onRegenerate, "fa-rotate-right"),
      button("Dismiss", "dismiss", onDismiss, "fa-xmark"),
    );
    body.replaceChildren(sourceLabel, list, note, actions);
    apply.focus?.({ preventScroll: true });
  };
  const showError = ({ message = "Section drafting failed.", onRetry, onDismiss } = {}) => {
    overlay.dataset.creatorAssistState = "error";
    title.textContent = `${sectionLabel || "Character"} Draft Unavailable`;
    dialog.setAttribute("aria-label", title.textContent);
    const error = appendText(createElement("p", "directive-creator-assist-dialog-error"), message);
    error.setAttribute("role", "alert");
    const actions = createElement("div", "directive-creator-assist-dialog-actions");
    const retry = button("Retry", "retry", onRetry, "fa-rotate-right");
    actions.append(retry, button("Dismiss", "dismiss", onDismiss, "fa-xmark"));
    body.replaceChildren(error, actions);
    retry.focus?.({ preventScroll: true });
  };

  closeButton.addEventListener("click", () => requestClose("close-control"));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose("escape");
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("[data-creator-assist-action]")]
      .filter((control) => !control.disabled && !control.hidden);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  const api = { overlay, dialog, close, requestClose, showError, showProgress, showResult, isOpen: () => overlay.isConnected };
  activeDialog = api;
  showProgress();
  return api;
}
