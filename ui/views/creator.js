import packageData from "../../packages/ashes-of-peace/campaign.json" with { type: "json" };

import { createCreatorAssistDialog } from "../creator-assist-dialog.js";
import { appendText, createElement, setClassState } from "../primitives.js";

const CREATION = packageData.characterCreation;
const ASSET_ROOT = "/api/extensions/directive/asset/assets/packages/breckenridge/images/ship";
const PORTRAIT_LIMIT = 2 * 1024 * 1024;
const PORTRAIT_DATA_URL_LIMIT = 96 * 1024;
const DOSSIER_LIMIT = Number(CREATION.dossier?.selfFillCharacterLimit) || 1500;
const TRAIT_OPTIONS = Object.fromEntries(
  (CREATION.traitCategories || []).map((category) => [category.id, category.options || []]),
);

export const PLAYER_FIELDS = Object.freeze([
  field("name", "Name", "identity.name", "identity", { tooltip: "Player officer name shown in campaign records and chat context." }),
  field("pronouns_or_address", "Pronouns or Address", "identity.pronounsOrAddress", "identity", { tooltip: "How crew should address the player officer in narration." }),
  field("species", "Species", "identity.speciesId", "identity", { options: CREATION.allowedSpecies, tooltip: "Species choice used for player officer identity and context." }),
  field("age_band", "Age Band", "identity.ageBandId", "identity", { options: CREATION.ageBands, tooltip: "Broad age range used for characterization, not a precise age." }),
  field("appearance", "Appearance", "identity.appearance", "identity", { multiline: true, tooltip: "Visible description used for dossier and narration context." }),
  field("career_background", "Career Background", "service.careerBackgroundId", "service", { options: CREATION.careerBackgrounds, tooltip: "Service history that shapes the officer command profile." }),
  field("formative_experience", "Formative Experience", "service.formativeExperienceId", "service", { options: CREATION.formativeExperiences, tooltip: "Past experience that influences how the officer handles pressure." }),
  field("assignment_reason", "Assignment Reason", "service.assignmentReasonId", "service", { options: CREATION.assignmentReasons, tooltip: "Why this officer receives the campaign command assignment." }),
  field("insight_trait", "Insight", "personality.traits.insight", "personality", { options: TRAIT_OPTIONS.insight, tooltip: "How your officer reads evidence, people, and uncertainty." }),
  field("connection_trait", "Connection", "personality.traits.connection", "personality", { options: TRAIT_OPTIONS.connection, tooltip: "How your officer builds trust and uses relationships." }),
  field("execution_trait", "Execution", "personality.traits.execution", "personality", { options: TRAIT_OPTIONS.execution, tooltip: "How your officer turns decisions into action under pressure." }),
  field("flaw", "Flaw", "personality.flawId", "personality", { options: CREATION.flaws?.options, tooltip: "A command tendency that can create pressure or complications." }),
]);

const EXTRA_FIELDS = Object.freeze([
  field("service_summary", "Service Summary", "dossier.serviceSummary", "service", { multiline: true, optional: true, tooltip: "Editable service record note carried into the officer dossier." }),
  field("command_style", "Command Style", "dossier.traits", "personality", { multiline: true, optional: true, tooltip: "Editable command-style note carried into the officer dossier." }),
  field("brief_biography", "Brief Biography", "dossier.briefBiography", "review", { multiline: true, tooltip: "Concise player-facing biography for the officer dossier." }),
  field("public_reputation", "Public Reputation", "dossier.publicReputation", "review", { multiline: true, tooltip: "How the officer is known publicly before the campaign begins." }),
]);

const ALL_FIELDS = Object.freeze([...PLAYER_FIELDS, ...EXTRA_FIELDS]);
const FIELD_BY_PATH = new Map(ALL_FIELDS.map((item) => [item.path, item]));
const STEPS = Object.freeze([
  Object.freeze({ id: "identity", label: "Identity", summary: "Officer identity and presence", tooltip: "Name, address, species, age band, and visible presence for the player officer." }),
  Object.freeze({ id: "service", label: "Service", summary: "Career path and assignment reason", tooltip: "Service history and assignment context used to frame the player officer." }),
  Object.freeze({ id: "personality", label: "Personality", summary: "Command traits and flaw", tooltip: "Command tendencies: how the player officer reads, connects, acts, and fails under pressure." }),
  Object.freeze({ id: "review", label: "Review", summary: "Dossier and campaign readiness", tooltip: "Final dossier text and campaign-start readiness." }),
]);

const MODE_COPY = Object.freeze({
  Exploration: Object.freeze({
    label: "Exploration",
    difficultyLabel: "Story-forward",
    fatalityPolicy: "No player or senior staff death",
    summary: "Consequences still matter, but Directive softens the worst outcomes. Injury, delay, damaged trust, lost readiness, or lost position can happen; player and senior staff deaths are blocked.",
    bestFit: "Choose this for a campaign that prioritizes continuity, recovery paths, and softer worst-case outcomes.",
  }),
  Command: Object.freeze({
    label: "Command",
    difficultyLabel: "Full simulation",
    fatalityPolicy: "Full causal severity",
    summary: "Directive preserves full causal severity. Serious failure can include severe or fatal outcomes when the risk is established, but the system must stay fair and cannot invent unsupported harm.",
    bestFit: "Choose this for the complete command simulation, where serious risk can produce serious consequences.",
  }),
});

export function renderCreatorView(state = {}, actions = {}) {
  initializeState(state);
  const form = createElement("form", "directive-creator-form directive-creator-workspace directive-creator-console directive-lcars-console directive-lcars-panel");
  form.noValidate = true;
  form.dataset.creatorForm = "true";
  form.dataset.directiveScrollOwner = "true";

  const overview = createOverview(state, form);
  const progressHeader = createElement("header", "directive-creator-progress-header");
  const progressSummary = appendText(createElement("span"), "Complete each personnel section");
  progressHeader.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Commissioning Steps"),
    progressSummary,
  );

  const stepRow = createElement("nav", "directive-step-row directive-creator-step-row");
  stepRow.setAttribute("aria-label", "Character Creator steps");
  const stepButtons = new Map();
  for (const step of STEPS) {
    const button = createButton({ label: step.label, className: "directive-step-button directive-creator-step-button", title: step.tooltip });
    button.dataset.creatorStepButton = step.id;
    const stateLabel = appendText(createElement("span", "directive-creator-step-state"), "locked");
    button.append(stateLabel);
    button.addEventListener("click", () => moveToStep(step.id));
    stepRow.append(button);
    stepButtons.set(step.id, button);
  }

  const status = appendText(createElement("p", "directive-creator-validation-message"), state.status || "");
  status.hidden = !clean(state.status);
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const commandBar = createElement("div", "directive-action-row directive-creator-command-bar directive-lcars-panel");
  const exit = createButton({
    label: "Campaign Library", icon: "fa-solid fa-arrow-left",
    className: "directive-button directive-creator-command-button directive-creator-route-exit-command",
    title: "Return to Campaign Library",
    onClick: () => { syncState(); actions.returnToCampaignLibrary?.(); },
  });
  const save = createButton({
    label: "Save Draft", icon: "fa-solid fa-floppy-disk",
    className: "directive-button directive-creator-command-button directive-creator-save-command",
    title: "Save Character Creator draft",
    onClick: () => {
      syncState();
      state.saved = true;
      updateStatus("Draft saved in this Directive session.");
      actions.saveCreatorDraft?.(snapshot(state));
    },
  });
  const back = createButton({
    label: "Back", icon: "fa-solid fa-arrow-left",
    className: "directive-button directive-creator-command-button directive-creator-back-command",
    onClick: () => moveRelative(-1),
  });
  const next = createButton({
    label: "Next: Service", icon: "fa-solid fa-arrow-right",
    className: "directive-button directive-creator-command-button directive-creator-next-command",
    onClick: () => moveRelative(1),
  });
  const start = createButton({
    label: "Start Campaign", icon: "fa-solid fa-play",
    className: "directive-button directive-creator-command-button directive-creator-begin-button",
    title: "Create the campaign save, bind a chat, and post the opening scene",
  });
  start.type = "submit";
  const discard = createButton({
    label: "Discard Character", icon: "fa-solid fa-trash-can",
    className: "directive-button directive-creator-command-button directive-creator-discard-command",
    title: "Delete this in-progress Character Creator draft",
    onClick: () => {
      const confirmed = typeof globalThis.confirm === "function"
        ? globalThis.confirm("Discard this in-progress character and delete the draft?")
        : true;
      if (!confirmed) return;
      state.input = { simulation_mode: "Command" };
      state.completedSteps = [];
      state.step = "identity";
      state.status = "";
      state.saved = false;
      state.provisionedChatId = null;
      state.storyOpened = false;
      actions.discardCreatorDraft?.();
    },
  });
  commandBar.append(exit, save, back, next, discard);

  const sections = new Map();
  for (const step of STEPS) sections.set(step.id, createSection(step, state, form, actions, updateStatus));

  form.append(overview, progressHeader, stepRow, status, commandBar, ...sections.values());
  form.addEventListener("submit", submitCampaign);
  activateStep(state.step, false);
  return form;

  function syncState() {
    for (const control of form.querySelectorAll("[name]")) {
      if (control.name) state.input[control.name] = control.value;
    }
  }

  function moveToStep(stepId) {
    const destination = STEPS.findIndex((step) => step.id === stepId);
    const current = STEPS.findIndex((step) => step.id === state.step);
    if (destination < 0 || stepButtons.get(stepId)?.disabled) return;
    if (destination > current && !completeCurrentStep()) return;
    activateStep(stepId);
  }

  function moveRelative(offset) {
    const current = STEPS.findIndex((step) => step.id === state.step);
    const destination = STEPS[current + offset];
    if (!destination) return;
    if (offset > 0 && !completeCurrentStep()) return;
    activateStep(destination.id);
  }

  function completeCurrentStep() {
    syncState();
    if (!stepComplete(state.input, state.step)) {
      updateStatus(`Complete ${stepLabel(state.step)} before continuing.`);
      return false;
    }
    if (!state.completedSteps.includes(state.step)) state.completedSteps.push(state.step);
    if (state.step === "personality") {
      ensureDossierFallbacks(state.input);
      syncControls(form, state.input);
    }
    updateStatus("");
    return true;
  }

  function activateStep(stepId, notify = true) {
    if (!sections.has(stepId)) return;
    state.step = stepId;
    form.dataset.creatorActiveStep = stepId;
    for (const [id, section] of sections) {
      const active = id === stepId;
      section.hidden = !active;
      section.setAttribute("aria-hidden", active ? "false" : "true");
      setClassState(section, "directive-creator-section-active", active);
    }
    refreshStepButtons();
    refreshCommands();
    progressSummary.textContent = readyForStart(state.input) ? "Ready for final review" : "Complete each personnel section";
    if (notify) actions.onStepChange?.(stepId);
  }

  function refreshStepButtons() {
    const complete = new Set(state.completedSteps);
    const firstIncomplete = STEPS.findIndex((step) => !complete.has(step.id));
    for (const [index, step] of STEPS.entries()) {
      const button = stepButtons.get(step.id);
      const active = step.id === state.step;
      const buttonState = active ? "active" : complete.has(step.id) ? "complete" : index === firstIncomplete ? "available" : "locked";
      button.dataset.creatorStepState = buttonState;
      button.querySelector(".directive-creator-step-state").textContent = buttonState;
      button.disabled = buttonState === "locked";
      button.setAttribute("aria-current", active ? "step" : "false");
      button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
      button.dataset.complete = complete.has(step.id) ? "true" : "false";
      setClassState(button, "directive-step-button-active", active);
      for (const name of ["active", "complete", "available", "locked"]) {
        setClassState(button, `directive-creator-step-${name}`, buttonState === name);
      }
    }
  }

  function refreshCommands() {
    const index = STEPS.findIndex((step) => step.id === state.step);
    const previous = STEPS[index - 1];
    const following = STEPS[index + 1];
    back.disabled = !previous;
    back.title = previous ? `Save and return to ${previous.label}` : "Already at the first creator step";
    if (state.step === "review") {
      if (next.isConnected) next.replaceWith(start);
    } else if (start.isConnected) {
      start.replaceWith(next);
    }
    if (following) next.querySelector("span").textContent = `Next: ${following.label}`;
    next.disabled = !following;
    start.disabled = !readyForStart(state.input);
  }

  function updateStatus(message) {
    state.status = message;
    status.textContent = message;
    status.hidden = !clean(message);
    refreshCommands();
  }

  async function submitCampaign(event) {
    event.preventDefault();
    syncState();
    if (state.step !== "review" || !readyForStart(state.input)) {
      updateStatus("Complete Review before starting the campaign.");
      return;
    }
    start.disabled = true;
    try {
      if (state.provisionedChatId === undefined || state.provisionedChatId === null) {
        updateStatus("Provisioning the complete campaign…");
        state.provisionedChatId = await actions.provisionCampaign?.(payload(state.input));
        if (state.provisionedChatId === undefined || state.provisionedChatId === null) throw new Error("Campaign start returned no story id");
      }
      if (state.storyOpened !== true) {
        updateStatus("Campaign created. Opening story…");
        await actions.openCampaign?.(state.provisionedChatId);
        state.storyOpened = true;
      }
      updateStatus("Campaign opened. Refreshing Directive…");
      await actions.refreshCampaign?.();
    } catch (_error) {
      if (state.provisionedChatId === undefined || state.provisionedChatId === null) {
        updateStatus("The campaign could not be created. No partial story was kept. You can retry.");
      } else if (state.storyOpened !== true) {
        updateStatus("Campaign created, but the story could not be opened. Retry opening the existing story.");
      } else {
        updateStatus("Campaign opened, but Directive could not refresh. Retry refresh for the existing story.");
      }
      start.disabled = false;
    }
  }
}

function createOverview(state, form) {
  const summary = createElement("section", "directive-creator-overview directive-lcars-panel");
  const mediaDeck = createElement("div", "directive-creator-overview-media-deck");
  const ship = createElement("figure", "directive-media-frame directive-creator-overview-media");
  ship.dataset.mediaKind = "ship.hero";
  ship.dataset.mediaSubject = "uss-breckenridge";
  ship.dataset.mediaVariant = "card";
  const image = createElement("img", "directive-media-image");
  image.src = `${ASSET_ROOT}/uss-breckenridge.card.webp`;
  image.alt = "U.S.S. Breckenridge";
  image.loading = "eager";
  image.decoding = "async";
  image.draggable = false;
  ship.append(image);
  mediaDeck.append(ship, createPortraitTile(state, form));

  const copy = createElement("div", "directive-creator-overview-copy");
  copy.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Starfleet Personnel Command"),
    appendText(createElement("h3", "directive-card-title"), "Commissioning File"),
    appendText(createElement("p", "directive-creator-overview-summary"), "Commander, Executive Officer"),
    appendText(createElement("p", "directive-creator-overview-campaign"), "Ashes of Peace aboard U.S.S. Breckenridge"),
  );
  summary.append(mediaDeck, copy);
  return summary;
}

function createPortraitTile(state, form) {
  const tile = createElement("section", "directive-creator-portrait-tile");
  const fileInput = createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  fileInput.hidden = true;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp)$/.test(file.type) || file.size > PORTRAIT_LIMIT) {
      state.status = "Choose a PNG, JPEG, or WebP portrait no larger than 2 MB.";
      return;
    }
    try {
      state.input.portrait_data_url = await readPortraitDataUrl(file, form.ownerDocument?.defaultView);
      render();
    } catch (_error) {
      state.status = "This portrait could not be prepared for the campaign. Try a smaller PNG, JPEG, or WebP image.";
      const status = form.querySelector('[role="status"]');
      if (status) {
        status.textContent = state.status;
        status.hidden = false;
      }
    }
  });

  const render = () => {
    const portrait = createElement("figure", "directive-media-frame directive-player-portrait-frame directive-creator-player-portrait");
    portrait.dataset.mediaKind = "player.portrait";
    portrait.dataset.mediaSubject = "player-commander";
    if (clean(state.input.portrait_data_url)) {
      const image = createElement("img", "directive-media-image directive-player-portrait-image");
      image.src = state.input.portrait_data_url;
      image.alt = clean(state.input.name) || "Player character portrait";
      image.loading = "eager";
      portrait.append(image);
    } else {
      portrait.classList.add("directive-media-frame-placeholder");
      const placeholder = createElement("div", "directive-media-placeholder");
      const iconFrame = createElement("span", "directive-media-placeholder-icon");
      const icon = createElement("span", "directive-asset-mask-icon");
      icon.style.setProperty("--directive-asset-mask-url", "url('/api/extensions/directive/asset/assets/icons/comm-badge.svg')");
      iconFrame.append(icon);
      placeholder.append(iconFrame, appendText(createElement("strong", "directive-media-placeholder-label"), initials(state.input.name)));
      portrait.append(placeholder);
    }
    const copy = createElement("div", "directive-creator-portrait-copy");
    copy.append(
      appendText(createElement("span", "directive-lcars-kicker"), "Player Portrait"),
      appendText(createElement("strong"), clean(state.input.portrait_data_url) ? "Portrait Linked" : "No Portrait"),
    );
    const actions = createElement("div", "directive-creator-portrait-actions");
    actions.append(createButton({
      label: clean(state.input.portrait_data_url) ? "Change" : "Import", icon: "fa-solid fa-image",
      className: "directive-button directive-creator-portrait-import",
      title: "Import a player character portrait", onClick: () => fileInput.click(),
    }));
    if (clean(state.input.portrait_data_url)) {
      actions.append(createButton({
        label: "Remove", icon: "fa-solid fa-trash-can",
        className: "directive-button directive-creator-portrait-remove",
        title: "Remove this player character portrait",
        onClick: () => { state.input.portrait_data_url = ""; render(); },
      }));
    }
    tile.replaceChildren(portrait, copy, actions, fileInput);
  };
  render();
  return tile;
}

function createSection(step, state, form, actions, updateStatus) {
  const section = createElement("section", "directive-form-section directive-creator-section");
  section.dataset.creatorStep = step.id;
  const header = createElement("div", "directive-creator-section-header");
  const heading = createElement("div", "directive-creator-section-heading-copy");
  heading.append(
    appendText(createElement("h3", "directive-creator-section-title"), step.label),
    appendText(createElement("p", "directive-creator-section-summary"), step.summary),
  );
  const assist = createElement("div", "directive-creator-section-assist-control");
  assist.dataset.creatorAssistBusy = "false";
  const spinner = createElement("span", "directive-creator-assist-busy-spinner");
  spinner.setAttribute("aria-hidden", "true");
  const wand = createElement("button", "directive-icon-button directive-creator-section-wand");
  wand.type = "button";
  wand.dataset.creatorSectionWand = step.id;
  wand.disabled = typeof actions.generateCreatorSectionDraft !== "function";
  wand.setAttribute("aria-label", `Draft ${step.label}`);
  wand.title = `Draft ${step.label} from creator inputs only`;
  wand.append(createIcon("fa-solid fa-wand-magic-sparkles"));
  wand.addEventListener("click", () => startAssist({ step, state, form, actions, assist, wand, updateStatus }));
  assist.append(spinner, wand);
  header.append(heading, assist);
  section.append(header);
  if (step.id === "review") section.append(createDifficulty(state, form));
  for (const definition of ALL_FIELDS.filter((item) => item.step === step.id)) section.append(createInput(definition, state, form));
  return section;
}

function createInput(definition, state, form) {
  const wrapper = createElement("label", "directive-field");
  wrapper.title = definition.tooltip || "";
  wrapper.append(appendText(createElement("span", "directive-field-label"), definition.label));
  let control;
  if (definition.options?.length) {
    control = createElement("select", "directive-field-control");
    const placeholder = createElement("option");
    placeholder.value = "";
    control.append(placeholder);
    for (const option of definition.options) {
      const item = appendText(createElement("option"), option.label || option.id);
      item.value = option.id;
      control.append(item);
    }
  } else if (definition.multiline) {
    control = createElement("textarea", "directive-field-control");
    control.rows = 4;
    control.maxLength = DOSSIER_LIMIT;
  } else {
    control = createElement("input", "directive-field-control");
    control.type = "text";
  }
  control.name = definition.name;
  control.dataset.inputPath = definition.path;
  control.value = clean(state.input[definition.name]);
  control.autocomplete = "off";
  control.title = definition.tooltip || "";
  const update = () => {
    state.input[definition.name] = control.value;
    if (definition.name === "name") {
      const label = form?.querySelector(".directive-creator-player-portrait .directive-media-placeholder-label");
      if (label) label.textContent = initials(control.value);
      const image = form?.querySelector(".directive-creator-player-portrait img");
      if (image) image.alt = clean(control.value) || "Player character portrait";
    }
    if (definition.step === "review" && form?.isConnected) {
      const start = form.querySelector(".directive-creator-begin-button");
      if (start) start.disabled = !readyForStart(state.input);
    }
  };
  control.addEventListener("input", update);
  control.addEventListener("change", update);
  wrapper.append(control);
  return wrapper;
}

function createDifficulty(state, form) {
  const shell = createElement("section", "directive-creator-difficulty-field directive-lcars-panel");
  shell.dataset.creatorDifficultyField = "true";
  const header = createElement("header", "directive-creator-difficulty-header");
  const copy = createElement("div", "directive-creator-difficulty-heading-copy");
  copy.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Campaign Setup"),
    appendText(createElement("h4", "directive-creator-difficulty-title"), "Campaign Difficulty"),
    appendText(createElement("p", "directive-creator-difficulty-lead"), "Choose how hard future consequences can land in this campaign."),
  );
  header.append(copy);
  const rail = createElement("div", "directive-creator-difficulty-options");
  rail.setAttribute("role", "radiogroup");
  rail.setAttribute("aria-label", "Campaign Difficulty");
  const summary = createElement("article", "directive-creator-difficulty-summary");
  summary.setAttribute("aria-live", "polite");
  const summaryTitle = createElement("strong", "directive-creator-difficulty-summary-title");
  const summaryBadge = createElement("span", "directive-creator-difficulty-summary-badge");
  const fatality = createElement("span", "directive-creator-difficulty-fatality");
  const summaryHeading = createElement("div", "directive-creator-difficulty-summary-heading");
  summaryHeading.append(summaryTitle, summaryBadge, fatality);
  const summaryCopy = createElement("p", "directive-creator-difficulty-summary-copy");
  const bestFit = createElement("p", "directive-creator-difficulty-best-fit");
  summary.append(appendText(createElement("span", "directive-lcars-kicker"), "Selected Mode Summary"), summaryHeading, summaryCopy, bestFit);
  const select = createElement("select", "directive-field-control directive-creator-mode-select directive-creator-mode-select-hidden");
  select.name = "simulation_mode";
  select.dataset.inputPath = "settings.simulationMode";
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;
  const buttons = [];
  const modes = packageData.guardrails?.simulationModes || ["Exploration", "Command"];
  const sync = (mode) => {
    const selected = MODE_COPY[mode] ? mode : "Command";
    state.input.simulation_mode = selected;
    select.value = selected;
    shell.dataset.creatorDifficultyMode = selected;
    for (const button of buttons) {
      const active = button.dataset.creatorDifficultyOption === selected;
      setClassState(button, "directive-creator-difficulty-option-active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
      button.dataset.selected = active ? "true" : "false";
    }
    summaryTitle.textContent = MODE_COPY[selected].label;
    summaryBadge.textContent = MODE_COPY[selected].difficultyLabel;
    fatality.textContent = MODE_COPY[selected].fatalityPolicy;
    summaryCopy.textContent = MODE_COPY[selected].summary;
    bestFit.textContent = MODE_COPY[selected].bestFit;
    const start = form?.querySelector(".directive-creator-begin-button");
    if (start) start.disabled = !readyForStart(state.input);
  };
  for (const mode of modes) {
    const option = appendText(createElement("option"), mode);
    option.value = mode;
    select.append(option);
    const choice = createElement("button", "directive-creator-difficulty-option");
    choice.type = "button";
    choice.dataset.creatorDifficultyOption = mode;
    choice.setAttribute("role", "radio");
    choice.setAttribute("aria-label", `${MODE_COPY[mode].label}: ${MODE_COPY[mode].difficultyLabel}`);
    choice.append(
      appendText(createElement("strong"), MODE_COPY[mode].label),
      appendText(createElement("span", "directive-creator-difficulty-option-badge"), MODE_COPY[mode].difficultyLabel),
    );
    choice.addEventListener("click", () => sync(mode));
    rail.append(choice);
    buttons.push(choice);
  }
  select.addEventListener("change", () => sync(select.value));
  const top = createElement("div", "directive-creator-difficulty-top");
  top.append(header, rail);
  const body = createElement("div", "directive-creator-difficulty-body");
  body.append(top, summary);
  shell.append(body, select);
  sync(state.input.simulation_mode || packageData.guardrails?.defaultSimulationMode || "Command");
  return shell;
}

async function startAssist({ step, state, form, actions, assist, wand, updateStatus }) {
  if (wand.disabled) return;
  const mode = sectionHasInput(state.input, step.id) ? "refine" : "create";
  const controller = new AbortController();
  let dialog;
  const close = (reason, { abort = true } = {}) => {
    if (abort) controller.abort(reason);
    dialog?.close(reason);
    assist.dataset.creatorAssistBusy = "false";
    wand.disabled = false;
  };
  const run = async () => {
    dialog?.showProgress(mode === "refine" ? "Generating with Reasoning from current details..." : "Generating with Reasoning...");
    assist.dataset.creatorAssistBusy = "true";
    try {
      const response = await actions.generateCreatorSectionDraft({ sectionId: step.id, input: { ...state.input }, signal: controller.signal });
      if (controller.signal.aborted || !dialog?.isOpen()) return;
      const result = response?.assistResult || response;
      const fields = result?.fields || {};
      if (!result?.ok || !Object.keys(fields).length) throw new Error("No usable section draft was returned.");
      assist.dataset.creatorAssistBusy = "false";
      dialog.showResult({
        resultTitle: result.mode === "refine" ? "Suggested Refinement" : "Suggested Draft",
        source: result.source === "provider" ? "Provider" : "Local fallback",
        fields: Object.entries(fields).map(([path, value]) => ({ label: FIELD_BY_PATH.get(path)?.label || path, value: optionDisplay(path, value) })),
        message: [...(result.warnings || []), ...(result.notes || [])].slice(0, 3).join(" ") || "Review before applying to this section.",
        onApply: () => {
          applyAssistFields(state.input, fields);
          syncControls(form, state.input);
          updateStatus(`${step.label} draft applied.`);
          close("applied", { abort: false });
        },
        onRegenerate: run,
        onDismiss: () => close("dismissed", { abort: false }),
      });
    } catch (error) {
      if (controller.signal.aborted || !dialog?.isOpen()) return;
      assist.dataset.creatorAssistBusy = "false";
      dialog.showError({
        message: error?.message || "Section drafting failed.",
        onRetry: run,
        onDismiss: () => close("dismissed", { abort: false }),
      });
    }
  };
  dialog = createCreatorAssistDialog({
    sectionId: step.id, sectionLabel: step.label, mode, opener: wand,
    onRequestClose: (reason) => close(reason),
  });
  await run();
}

function initializeState(state) {
  state.input ||= {};
  state.step = STEPS.some((step) => step.id === state.step) ? state.step : "identity";
  state.completedSteps = Array.isArray(state.completedSteps) ? state.completedSteps.filter((id) => STEPS.some((step) => step.id === id)) : [];
  if (!clean(state.input.simulation_mode)) state.input.simulation_mode = packageData.guardrails?.defaultSimulationMode || "Command";
}

function field(name, label, path, step, options = {}) {
  return Object.freeze({ name, label, path, step, ...options });
}

function createButton({ label, icon = "", className = "directive-button", title = "", onClick = null }) {
  const button = createElement("button", className);
  button.type = "button";
  button.title = title;
  if (icon) button.append(createIcon(icon));
  button.append(appendText(createElement("span"), label));
  if (typeof onClick === "function") button.addEventListener("click", async (event) => { event.preventDefault(); await onClick(event); });
  return button;
}

function createIcon(className) {
  const icon = createElement("i", className);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function stepComplete(input, stepId) {
  const names = {
    identity: ["name", "pronouns_or_address", "species", "age_band", "appearance"],
    service: ["career_background", "formative_experience", "assignment_reason"],
    personality: ["insight_trait", "connection_trait", "execution_trait", "flaw"],
    review: ["brief_biography", "public_reputation"],
  }[stepId] || [];
  return names.every((name) => clean(input[name]));
}

function readyForStart(input) {
  return STEPS.every((step) => stepComplete(input, step.id)) && Boolean(MODE_COPY[input.simulation_mode]);
}

function sectionHasInput(input, stepId) {
  return ALL_FIELDS.some((item) => item.step === stepId && clean(input[item.name]));
}

function ensureDossierFallbacks(input) {
  const values = Object.fromEntries(PLAYER_FIELDS.map((definition) => [definition.name, fieldDisplay(definition, input[definition.name])]));
  input.service_summary ||= `${values.career_background}; shaped by ${values.formative_experience}.`;
  input.command_style ||= `${values.insight_trait}, ${values.connection_trait}, and ${values.execution_trait}; ${values.flaw} remains a pressure point.`;
  input.brief_biography ||= `${values.name} is a ${values.species} Starfleet Commander assigned as Executive Officer of the U.S.S. Breckenridge on stardate 53068.4. Their background in ${values.career_background} and formative experience with ${values.formative_experience} made them a credible choice for the Asterion Reach mission. Their command style is shaped by ${values.insight_trait}, ${values.connection_trait}, and ${values.execution_trait}, while ${values.flaw} remains a pressure point they will need to manage in command.`;
  input.public_reputation ||= `${values.name} is regarded as a capable Commander whose ${values.career_background} background makes the Breckenridge assignment plausible, though the crew is still learning what kind of XO they have received.`;
}

function payload(input) {
  const core = Object.fromEntries(PLAYER_FIELDS.map((definition) => [definition.name, fieldDisplay(definition, input[definition.name])]));
  const extra = Object.fromEntries(EXTRA_FIELDS.map((definition) => [definition.name, clean(input[definition.name])]).filter(([, value]) => value));
  if (clean(input.portrait_data_url)) extra.portrait_data_url = input.portrait_data_url;
  return { ...core, ...extra, simulation_mode: input.simulation_mode };
}

function fieldDisplay(definition, value) {
  const option = definition.options?.find((item) => item.id === value);
  return clean(option?.label || value);
}

function optionDisplay(path, value) {
  const definition = FIELD_BY_PATH.get(path);
  return definition ? fieldDisplay(definition, value) : clean(value);
}

function applyAssistFields(input, fields) {
  for (const [path, value] of Object.entries(fields || {})) {
    const definition = FIELD_BY_PATH.get(path);
    if (definition) input[definition.name] = clean(value);
  }
}

function syncControls(form, input) {
  for (const definition of ALL_FIELDS) {
    const control = form.querySelector(`[name="${definition.name}"]`);
    if (control) control.value = clean(input[definition.name]);
  }
}

function snapshot(state) {
  return { step: state.step, completedSteps: [...state.completedSteps], input: { ...state.input } };
}

async function readDataUrl(file, windowObject) {
  if (typeof file?.arrayBuffer === "function" && typeof windowObject?.btoa === "function") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${file.type};base64,${windowObject.btoa(binary)}`;
  }
  return new Promise((resolve, reject) => {
    const Reader = windowObject?.FileReader || globalThis.FileReader;
    if (!Reader) {
      reject(new Error("Portrait import is unavailable in this browser"));
      return;
    }
    const reader = new Reader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("Portrait import failed")), { once: true });
    reader.readAsDataURL(file);
  });
}

async function readPortraitDataUrl(file, windowObject) {
  const original = await readDataUrl(file, windowObject);
  if (original.length <= PORTRAIT_DATA_URL_LIMIT) return original;
  const ImageConstructor = windowObject?.Image;
  const documentObject = windowObject?.document;
  if (!ImageConstructor || !documentObject?.createElement) {
    throw new Error("Portrait normalization is unavailable");
  }
  const image = await new Promise((resolve, reject) => {
    const candidate = new ImageConstructor();
    candidate.addEventListener("load", () => resolve(candidate), { once: true });
    candidate.addEventListener("error", () => reject(new Error("Portrait could not be decoded")), { once: true });
    candidate.src = original;
  });
  for (const maxDimension of [320, 256, 192]) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = documentObject.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) break;
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.82, 0.68, 0.54]) {
      const normalized = canvas.toDataURL("image/webp", quality);
      if (normalized.length <= PORTRAIT_DATA_URL_LIMIT) return normalized;
    }
  }
  throw new Error("Portrait remains too large after normalization");
}

function initials(value) {
  return clean(value).split(/\s+/).filter(Boolean).map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 3) || "PC";
}

function stepLabel(stepId) {
  return STEPS.find((step) => step.id === stepId)?.label || stepId;
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}
