import { appendText, createElement, setClassState } from "../primitives.js";

export const PLAYER_FIELDS = Object.freeze([
  Object.freeze({ name: "name", label: "Name", placeholder: "Sam Vickers", step: "identity" }),
  Object.freeze({ name: "pronouns_or_address", label: "Pronouns or address", placeholder: "Commander Vickers", step: "identity" }),
  Object.freeze({ name: "species", label: "Species", placeholder: "Human", step: "identity" }),
  Object.freeze({ name: "age_band", label: "Age band", placeholder: "mid-career", step: "identity" }),
  Object.freeze({ name: "appearance", label: "Appearance", placeholder: "Visible appearance", step: "identity", multiline: true }),
  Object.freeze({ name: "career_background", label: "Career background", placeholder: "Starfleet operations and logistics", step: "service" }),
  Object.freeze({ name: "formative_experience", label: "Formative experience", placeholder: "Fleet service", step: "service" }),
  Object.freeze({ name: "assignment_reason", label: "Assignment reason", placeholder: "Requested by the captain", step: "service" }),
  Object.freeze({ name: "insight_trait", label: "Insight trait", placeholder: "Analytical", step: "command" }),
  Object.freeze({ name: "connection_trait", label: "Connection trait", placeholder: "Candid", step: "command" }),
  Object.freeze({ name: "execution_trait", label: "Execution trait", placeholder: "Decisive", step: "command" }),
  Object.freeze({ name: "flaw", label: "Flaw", placeholder: "Guarded", step: "command" }),
]);

const CREATOR_STEPS = Object.freeze([
  Object.freeze({ id: "identity", label: "Identity", summary: "Name, address, species, age, and visible appearance" }),
  Object.freeze({ id: "service", label: "Service", summary: "Career record and reason for this assignment" }),
  Object.freeze({ id: "command", label: "Command Profile", summary: "Player-authored command traits and flaw" }),
  Object.freeze({ id: "review", label: "Review", summary: "Verify the complete commissioning file" }),
]);

export function renderCreatorView(state = {}, actions = {}) {
  state.input ||= {};
  state.step = CREATOR_STEPS.some(({ id }) => id === state.step) ? state.step : "identity";
  if (!clean(state.input.simulation_mode)) state.input.simulation_mode = "Command";

  const form = createElement("form", "directive-creator-form directive-creator-workspace directive-lcars-console");
  form.noValidate = true;
  const overview = createElement("header", "directive-creator-overview directive-lcars-panel");
  const overviewCopy = createElement("div", "directive-creator-overview-copy");
  overviewCopy.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Starfleet Personnel Command"),
    appendText(createElement("h2", "directive-card-title"), "Commissioning File"),
    appendText(createElement("p", "directive-creator-overview-summary"), "Commander · Executive Officer"),
    appendText(createElement("p", "directive-creator-overview-campaign"), "Ashes of Peace aboard the U.S.S. Breckenridge"),
  );
  overview.append(overviewCopy);

  const progressHeader = createElement("header", "directive-creator-progress-header");
  progressHeader.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Commissioning Steps"),
    appendText(createElement("span"), "Complete every required personnel field"),
  );
  const stepRow = createElement("nav", "directive-step-row directive-creator-step-row");
  stepRow.setAttribute("aria-label", "Character creation steps");
  stepRow.setAttribute("role", "tablist");
  const sections = new Map();
  const stepButtons = CREATOR_STEPS.map(({ id, label }, index) => {
    const button = appendText(createElement("button", "directive-button directive-step-button directive-creator-step-button"), label);
    button.id = `directive-creator-step-${id}-tab`;
    button.type = "button";
    button.dataset.creatorStep = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `directive-creator-step-${id}-panel`);
    button.addEventListener("click", () => activateStep(id));
    button.addEventListener("keydown", (event) => {
      const nextIndex = nextStepIndex(index, event.key, stepButtons.length);
      if (nextIndex === null || nextIndex === index) return;
      event.preventDefault();
      stepButtons[nextIndex].focus({ preventScroll: true });
      stepButtons[nextIndex].click();
    });
    stepRow.append(button);
    return button;
  });

  const status = appendText(createElement("p", "directive-creator-validation-message"), state.status || "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const commandBar = createElement("div", "directive-action-row directive-creator-command-bar directive-lcars-panel");
  const back = appendText(createElement("button", "directive-button directive-creator-command-button directive-creator-back-command"), "Back");
  back.type = "button";
  back.addEventListener("click", () => moveStep(-1));
  const next = appendText(createElement("button", "directive-button directive-creator-command-button directive-creator-next-command"), "Next");
  next.type = "button";
  next.addEventListener("click", () => moveStep(1));
  const submit = appendText(createElement("button", "directive-button directive-creator-command-button directive-creator-begin-button"), "Start Campaign");
  submit.type = "submit";
  commandBar.append(back, next, submit);

  for (const step of CREATOR_STEPS) {
    const section = createElement("section", "directive-creator-section");
    section.id = `directive-creator-step-${step.id}-panel`;
    section.dataset.creatorStep = step.id;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `directive-creator-step-${step.id}-tab`);
    const header = createElement("header", "directive-creator-section-header");
    header.append(
      appendText(createElement("h3", "directive-creator-section-title"), step.label),
      appendText(createElement("p", "directive-creator-section-summary"), step.summary),
    );
    section.append(header);
    if (step.id === "review") {
      section.append(createSimulationField(state), createReview(state));
    } else {
      for (const field of PLAYER_FIELDS.filter((item) => item.step === step.id)) section.append(createField(field, state));
    }
    sections.set(step.id, section);
  }

  form.append(overview, progressHeader, stepRow, status, commandBar, ...sections.values());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.step !== "review") {
      activateStep("review");
      stepButtons.at(-1).focus({ preventScroll: true });
      updateStatus("Review the commissioning file before starting the campaign.");
      return;
    }
    const missing = requiredNames().filter((name) => !clean(state.input[name]));
    if (missing.length) {
      updateStatus("Complete every required field before starting the campaign.");
      return;
    }
    submit.disabled = true;
    try {
      if (state.provisionedChatId === undefined || state.provisionedChatId === null) {
        updateStatus("Provisioning the complete campaign…");
        state.provisionedChatId = await actions.provisionCampaign(payload(state.input));
      }
      if (state.storyOpened !== true) {
        updateStatus("Campaign created. Opening story…");
        await actions.openCampaign(state.provisionedChatId);
        state.storyOpened = true;
      }
      updateStatus("Campaign opened. Refreshing Directive…");
      await actions.refreshCampaign();
    } catch (_error) {
      submit.disabled = false;
      if (state.provisionedChatId === undefined || state.provisionedChatId === null) {
        updateStatus("The campaign could not be created. No partial story was kept. You can retry.");
      } else if (state.storyOpened !== true) {
        updateStatus("Campaign created, but the story could not be opened. Retry opening the existing story.");
      } else {
        updateStatus("Campaign opened, but Directive could not refresh. Retry refresh for the existing story.");
      }
    }
  });
  activateStep(state.step, false);
  return form;

  function activateStep(stepId, notify = true) {
    if (!sections.has(stepId)) return;
    state.step = stepId;
    form.dataset.creatorActiveStep = stepId;
    stepButtons.forEach((button) => {
      const selected = button.dataset.creatorStep === stepId;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
      setClassState(button, "directive-step-button-active", selected);
    });
    sections.forEach((section, id) => {
      const active = id === stepId;
      section.hidden = !active;
      setClassState(section, "directive-creator-section-active", active);
    });
    const index = CREATOR_STEPS.findIndex(({ id }) => id === stepId);
    back.disabled = index === 0;
    next.hidden = index === CREATOR_STEPS.length - 1;
    submit.hidden = index !== CREATOR_STEPS.length - 1;
    if (stepId === "review") refreshReview(form, state);
    if (notify) actions.onStepChange?.(stepId);
  }

  function moveStep(offset) {
    const index = CREATOR_STEPS.findIndex(({ id }) => id === state.step);
    const destination = CREATOR_STEPS[index + offset];
    if (destination) activateStep(destination.id);
  }

  function updateStatus(message) {
    state.status = message;
    status.textContent = message;
  }
}

function createField(field, state) {
  const label = createElement("label", "directive-field");
  label.append(appendText(createElement("span", "directive-field-label"), field.label));
  const control = createElement(field.multiline ? "textarea" : "input", "directive-field-control");
  control.name = field.name;
  control.required = true;
  control.autocomplete = "off";
  control.placeholder = field.placeholder;
  control.value = clean(state.input[field.name]);
  if (field.multiline) control.rows = 3;
  control.addEventListener("input", () => { state.input[field.name] = control.value; });
  label.append(control);
  return label;
}

function createSimulationField(state) {
  const label = createElement("label", "directive-field directive-creator-difficulty-field");
  label.append(appendText(createElement("span", "directive-field-label"), "Simulation mode"));
  const select = createElement("select", "directive-field-control");
  select.name = "simulation_mode";
  select.required = true;
  for (const [value, text] of [
    ["Command", "Command · full causal severity"],
    ["Exploration", "Exploration · nonfatal senior-staff ceiling"],
  ]) {
    const option = appendText(createElement("option"), text);
    option.value = value;
    select.append(option);
  }
  select.value = state.input.simulation_mode;
  select.addEventListener("change", () => {
    state.input.simulation_mode = select.value;
    refreshReview(label.closest("form"), state);
  });
  label.append(select);
  return label;
}

function createReview(state) {
  const review = createElement("dl", "directive-creator-review directive-metadata-grid");
  review.dataset.creatorReview = "true";
  fillReview(review, state.input);
  return review;
}

function refreshReview(root, state) {
  const review = root?.querySelector?.("[data-creator-review]");
  if (review) fillReview(review, state.input);
}

function fillReview(review, input) {
  review.replaceChildren();
  for (const field of PLAYER_FIELDS) {
    const cell = createElement("div", "campaign-fact directive-metadata-cell");
    cell.append(
      appendText(createElement("dt"), field.label),
      appendText(createElement("dd"), clean(input[field.name]) || "Not provided"),
    );
    review.append(cell);
  }
  const mode = createElement("div", "campaign-fact directive-metadata-cell");
  mode.append(
    appendText(createElement("dt"), "Simulation mode"),
    appendText(createElement("dd"), clean(input.simulation_mode) || "Not provided"),
  );
  review.append(mode);
}

function payload(input) {
  return Object.fromEntries(requiredNames().map((name) => [name, clean(input[name])]));
}

function requiredNames() {
  return [...PLAYER_FIELDS.map(({ name }) => name), "simulation_mode"];
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function nextStepIndex(index, key, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
