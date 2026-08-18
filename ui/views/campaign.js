import { appendText, createElement, setClassState } from "../primitives.js";

const CAMPAIGN_MODES = Object.freeze([
  Object.freeze({ id: "command", label: "Command" }),
  Object.freeze({ id: "library", label: "Library" }),
  Object.freeze({ id: "records", label: "Records" }),
]);
const CAMPAIGN_PACKAGES = Object.freeze({
  "ashes-of-peace": Object.freeze({
    shipName: "U.S.S. Breckenridge",
    shipClass: "Intrepid-class",
  }),
});

export function renderCampaignView(data = {}, state = {}, actions = {}) {
  const root = createElement("section", "directive-v1-campaign directive-campaign-workspace");
  const commandBar = createElement("nav", "directive-campaign-command-bar directive-action-row directive-lcars-panel");
  commandBar.setAttribute("aria-label", "Campaign workspace modes");
  commandBar.setAttribute("role", "tablist");
  const panel = createElement("div", "directive-campaign-mode-panel");
  panel.dataset.campaignPanel = "command";
  const initialMode = CAMPAIGN_MODES.some(({ id }) => id === state.mode) ? state.mode : "command";
  state.mode = initialMode;

  const controls = CAMPAIGN_MODES.map(({ id, label }, index) => {
    const button = appendText(createElement("button", "campaign-command"), label);
    button.type = "button";
    button.dataset.campaignMode = id;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => activate(id));
    button.addEventListener("keydown", (event) => {
      const nextIndex = nextModeIndex(index, event.key, controls.length);
      if (nextIndex === null || nextIndex === index) return;
      event.preventDefault();
      controls[nextIndex].focus({ preventScroll: true });
      controls[nextIndex].click();
    });
    commandBar.append(button);
    return button;
  });

  root.append(commandBar, panel);
  activate(initialMode, false);
  return root;

  function activate(mode, notify = true) {
    if (!CAMPAIGN_MODES.some(({ id }) => id === mode)) return;
    state.mode = mode;
    controls.forEach((control) => {
      const selected = control.dataset.campaignMode === mode;
      control.setAttribute("aria-selected", selected ? "true" : "false");
      control.tabIndex = selected ? 0 : -1;
      setClassState(control, "campaign-command-primary", selected);
    });
    panel.dataset.campaignPanel = mode;
    panel.replaceChildren(renderMode(mode, data, actions));
    if (notify) actions.onModeChange?.(mode);
  }
}

function renderMode(mode, data, actions) {
  if (mode === "library") return renderLibrary(data, actions);
  if (mode === "records") return renderRecords(data);
  return renderCommand(data, actions);
}

function renderCommand(data, actions) {
  const dashboard = createElement("section", "campaign-dashboard");
  const heading = createElement("header", "campaign-dashboard-heading");
  heading.append(appendText(createElement("h2"), "Current Campaign"));
  dashboard.append(heading, createCampaignHero(data));

  if (typeof actions.continueCampaign === "function") {
    const commands = createElement("div", "campaign-detail-actions campaign-dashboard-actions");
    const resume = appendText(createElement("button", "campaign-command campaign-command-primary"), "Continue Campaign");
    resume.type = "button";
    resume.dataset.campaignAction = "continue";
    resume.addEventListener("click", () => actions.continueCampaign(data.chat_id));
    commands.append(resume);
    dashboard.append(commands);
  }
  return dashboard;
}

function createCampaignHero(data) {
  const hero = createElement("section", "campaign-hero campaign-dashboard-hero");
  const source = clean(data.media?.ship?.variants?.hero);
  if (source) {
    const media = createElement("div", "campaign-hero-media directive-media-frame");
    const image = createElement("img");
    image.src = source;
    image.alt = clean(data.media?.ship?.alt) || "";
    media.append(image);
    hero.append(media);
  }

  const copy = createElement("div", "campaign-hero-copy");
  copy.append(
    appendText(createElement("span", "directive-lcars-kicker"), "Active campaign"),
    appendText(createElement("h2"), fact(data.campaign?.title, "Campaign title unavailable.")),
  );
  const facts = createElement("div", "campaign-facts campaign-library-facts");
  for (const [label, value] of campaignFacts(data)) facts.append(createFact(label, value));
  copy.append(facts);
  hero.append(copy);
  return hero;
}

function renderLibrary(data) {
  const browser = createElement("section", "campaign-browser");
  const heading = createElement("header", "campaign-browser-heading");
  heading.append(appendText(createElement("h2"), "Campaign Library"));
  const packages = createElement("div", "directive-v1-campaign-packages");
  const card = createElement("article", "directive-v1-campaign-package directive-package-card");
  const source = clean(data.media?.ship?.variants?.card) || clean(data.media?.ship?.variants?.hero);
  if (source) {
    const media = createElement("div", "directive-v1-campaign-media directive-media-frame");
    const image = createElement("img");
    image.src = source;
    image.alt = clean(data.media?.ship?.alt) || "";
    media.append(image);
    card.append(media);
  }
  const copy = createElement("div", "directive-v1-campaign-package-copy");
  copy.append(
    appendText(createElement("span", "directive-v1-kicker"), "Installed campaign package"),
    appendText(createElement("h3"), fact(data.campaign?.title, "Campaign title unavailable.")),
    appendText(createElement("p", "directive-v1-campaign-hook"), "The active Sonder story supplies this package record."),
  );
  card.append(copy);
  packages.append(card);
  browser.append(heading, packages);
  return browser;
}

function renderRecords(data) {
  const browser = createElement("section", "campaign-browser campaign-records");
  const heading = createElement("header", "campaign-browser-heading");
  heading.append(appendText(createElement("h2"), "Campaign Records"));
  const record = createElement("article", "campaign-row active directive-package-card");
  const copy = createElement("span", "campaign-row-copy");
  copy.append(
    appendText(createElement("strong"), data.chat_id === undefined || data.chat_id === null ? "Story identifier unavailable." : `Story ${data.chat_id}`),
    appendText(createElement("span", "campaign-row-state"), "Current record"),
    appendText(createElement("span"), fact(data.campaign?.title, "Campaign title unavailable.")),
  );
  record.append(copy);
  browser.append(heading, record);
  return browser;
}

function campaignFacts(data) {
  const stardate = Number.isFinite(Number(data.time?.stardate)) ? Number(data.time.stardate).toFixed(1) : null;
  const completed = Number.isFinite(Number(data.journey?.completed_count)) ? String(Number(data.journey.completed_count)) : null;
  const packageFacts = CAMPAIGN_PACKAGES[clean(data.campaign?.id)] || {};
  return [
    ["Player", fact(data.viewer?.name, "Player identity unavailable.")],
    ["Ship", fact(data.ship?.name || packageFacts.shipName, "Ship identity unavailable.")],
    ["Class", fact(data.ship?.class_name || data.ship?.class || packageFacts.shipClass, "Ship class unavailable.")],
    ["Current mission", fact(data.mission?.title || data.mission?.id, "Current mission unavailable.")],
    ["Simulation mode", fact(data.campaign?.simulation_mode, "Simulation mode unavailable.")],
    ["Stardate", fact(stardate, "Stardate unavailable.")],
    ["Completed", fact(completed, "Completion record unavailable.")],
    ["Location", fact(data.location?.name, "Location is not currently established.")],
  ];
}

function createFact(label, value) {
  const item = createElement("div", "campaign-fact directive-metadata-cell");
  item.append(appendText(createElement("span"), label), appendText(createElement("strong"), value));
  return item;
}

function fact(value, empty) {
  return clean(value) || empty;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
}

function nextModeIndex(index, key, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
