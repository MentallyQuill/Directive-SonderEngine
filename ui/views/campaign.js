import { appendText, createElement, setClassState } from "../primitives.js";

const CAMPAIGN_MODES = Object.freeze([
  Object.freeze({ id: "command", label: "Command" }),
  Object.freeze({ id: "library", label: "Library" }),
  Object.freeze({ id: "records", label: "Records" }),
]);
export function renderCampaignView(data = {}, state = {}, actions = {}) {
  const root = createElement("section", "directive-expanded-campaign directive-campaign-workspace");
  root.dataset.directiveScrollOwner = "true";
  const commandBar = createElement("nav", "directive-campaign-command-bar directive-action-row directive-lcars-panel");
  commandBar.setAttribute("aria-label", "Campaign workspace modes");
  commandBar.setAttribute("role", "tablist");
  const panel = createElement("div", "directive-campaign-mode-panel");
  panel.id = "directive-campaign-mode-panel";
  panel.dataset.campaignPanel = "command";
  panel.setAttribute("role", "tabpanel");
  const initialMode = CAMPAIGN_MODES.some(({ id }) => id === state.mode) ? state.mode : "command";
  state.mode = initialMode;

  const controls = CAMPAIGN_MODES.map(({ id, label }, index) => {
    const button = appendText(createElement("button", "campaign-command"), label);
    button.id = `directive-campaign-mode-${id}-tab`;
    button.type = "button";
    button.dataset.campaignMode = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", panel.id);
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
    panel.setAttribute("aria-labelledby", controls.find((control) => control.dataset.campaignMode === mode).id);
    panel.dataset.campaignPanel = mode;
    commandBar.hidden = mode === "command";
    panel.replaceChildren(renderMode(mode, data, actions, activate));
    if (notify) actions.onModeChange?.(mode);
  }
}

function renderMode(mode, data, actions, activate) {
  if (mode === "library") return renderLibrary(data, actions);
  if (mode === "records") return renderRecords(data);
  return renderCommand(data, actions, activate);
}

function renderCommand(data, actions, activate) {
  const dashboard = createElement("section", "campaign-dashboard");
  const heading = createElement("header", "campaign-dashboard-heading");
  const campaigns = appendText(createElement("button", "campaign-command"), "Campaigns");
  campaigns.type = "button";
  campaigns.dataset.campaignAction = "browse";
  campaigns.addEventListener("click", () => activate("library"));
  heading.append(appendText(createElement("h2"), "Current Campaign"), campaigns);
  dashboard.append(heading, createCampaignHero(data));

  const commands = createElement("div", "campaign-detail-actions campaign-dashboard-actions");
  if (typeof actions.continueCampaign === "function") {
    const resume = appendText(createElement("button", "campaign-command campaign-command-primary"), "Continue Campaign");
    resume.type = "button";
    resume.dataset.campaignAction = "continue";
    resume.addEventListener("click", () => actions.continueCampaign(data.chat_id));
    commands.append(resume);
  }
  for (const [action, label, className] of [
    ["save", "Save Game", "campaign-command"],
    ["load", "Load Game", "campaign-command"],
    ["delete", "Delete", "campaign-command campaign-command-danger campaign-delete-icon-command"],
  ]) {
    const unavailable = appendText(createElement("button", className), label);
    unavailable.type = "button";
    unavailable.disabled = true;
    unavailable.dataset.campaignAction = action;
    unavailable.setAttribute("aria-label", `${label} unavailable in the Sonder migration`);
    commands.append(unavailable);
  }
  dashboard.append(commands);
  return dashboard;
}

function createCampaignHero(data) {
  const hero = createElement("section", "campaign-hero campaign-dashboard-hero");
  hero.append(createCampaignMedia(data, "hero", "campaign-hero-media directive-media-frame"));

  const copy = createElement("div", "campaign-hero-copy");
  copy.append(
    appendText(createElement("span", "directive-lcars-kicker campaign-status"), "Current campaign"),
    appendText(createElement("h2"), fact(data.campaign?.title, "Campaign title unavailable.")),
    appendText(createElement("p"), [
      fact(data.viewer?.name, "Player identity unavailable."),
      fact(data.ship?.class_name, "Ship class unavailable."),
      fact(data.ship?.name, "Ship identity unavailable."),
    ].join(" / ")),
    appendText(
      createElement("p"),
      fact(data.mission?.summary || data.mission?.title || data.mission?.id, "Current mission unavailable."),
    ),
  );
  copy.append(createChronometer(data.time));
  hero.append(copy);
  return hero;
}

function renderLibrary(data) {
  const browser = createElement("section", "campaign-browser");
  const heading = createElement("header", "campaign-browser-heading");
  heading.append(appendText(createElement("h2"), "Campaign Library"));
  const packages = createElement("div", "directive-v1-campaign-packages");
  const card = createElement("article", "directive-v1-campaign-package directive-package-card");
  card.append(createCampaignMedia(data, "card", "directive-v1-campaign-media directive-media-frame"));
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
  const stardateValue = finiteProjectionNumber(data.time?.stardate);
  const completedValue = finiteProjectionNumber(data.journey?.completed_count);
  const stardate = stardateValue === null ? null : stardateValue.toFixed(1);
  const completed = completedValue === null ? null : String(completedValue);
  return [
    ["Player", fact(data.viewer?.name, "Player identity unavailable.")],
    ["Ship", fact(data.ship?.name, "Ship identity unavailable.")],
    ["Class", fact(data.ship?.class_name, "Ship class unavailable.")],
    ["Current mission", fact(data.mission?.title || data.mission?.id, "Current mission unavailable.")],
    ["Simulation mode", fact(data.campaign?.simulation_mode, "Simulation mode unavailable.")],
    ["Stardate", fact(stardate, "Stardate unavailable.")],
    ["Completed", fact(completed, "Completion record unavailable.")],
    ["Location", fact(data.location?.name, "Location is not currently established.")],
  ];
}

function createCampaignMedia(data, variant, className) {
  const scene = variant === "hero" ? data.media?.ship?.scene : null;
  if (scene?.layers?.background && scene?.layers?.stars && scene?.layers?.foreground) {
    return createCampaignHeroScene(data.media.ship, className);
  }
  const frame = createElement("div", className);
  const placeholder = appendText(createElement("span", "directive-media-placeholder"), "Campaign media unavailable.");
  const source = clean(data.media?.ship?.variants?.[variant]) || (variant === "card" ? clean(data.media?.ship?.variants?.hero) : "");
  placeholder.hidden = Boolean(source);
  if (source) {
    const image = createElement("img");
    image.className = "directive-media-image";
    image.src = source;
    image.alt = clean(data.media?.ship?.alt) || "";
    image.addEventListener("error", () => {
      image.hidden = true;
      placeholder.hidden = false;
    });
    frame.append(image);
  }
  frame.append(placeholder);
  return frame;
}

function createCampaignHeroScene(media, className) {
  const frame = createElement("figure", `${className} directive-hero-scene${media.scene.cruise ? " directive-hero-scene-has-cruise" : ""}`);
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", clean(media.alt) || "Campaign ship scene");
  const placeholder = appendText(createElement("span", "directive-media-placeholder"), "Campaign media unavailable.");
  placeholder.hidden = true;
  let failed = false;
  const image = (classNameValue, source, layerName, shipLayer = false) => {
    const node = createElement("img", classNameValue);
    if (shipLayer) node.dataset.heroShipLayer = layerName;
    else node.dataset.heroSceneLayer = layerName;
    node.src = source;
    node.alt = "";
    node.setAttribute("aria-hidden", "true");
    node.addEventListener("error", () => {
      if (failed) return;
      failed = true;
      for (const rendered of frame.querySelectorAll("img")) rendered.hidden = true;
      placeholder.hidden = false;
    });
    return node;
  };
  frame.append(
    image("directive-hero-scene-layer", media.scene.layers.background, "background"),
    image("directive-hero-scene-layer", media.scene.layers.stars, "stars"),
  );
  if (media.scene.cruise) {
    for (const [name, source] of [["stars-far", media.scene.cruise.farStars], ["stars-near", media.scene.cruise.nearStars]]) {
      const field = createElement("span", "directive-hero-scene-layer directive-hero-cruise-stars");
      field.dataset.heroSceneLayer = name;
      field.style.setProperty("--directive-hero-star-texture", `url("${source}")`);
      field.setAttribute("aria-hidden", "true");
      frame.append(field);
    }
  }
  if (media.scene.emissive) {
    const card = createElement("span", "directive-hero-scene-layer directive-hero-ship-card");
    card.dataset.heroSceneLayer = "foreground";
    card.setAttribute("aria-hidden", "true");
    card.style.setProperty("--directive-hero-window-noise", `url("${media.scene.emissive.windowNoise}")`);
    card.append(
      image("directive-hero-ship-card-layer", media.scene.layers.foreground, "base", true),
      image("directive-hero-ship-card-layer", media.scene.emissive.windows, "windows", true),
      image("directive-hero-ship-card-layer", media.scene.emissive.nacelles, "nacelles", true),
    );
    frame.append(card);
  } else {
    frame.append(image("directive-hero-scene-layer", media.scene.layers.foreground, "foreground"));
  }
  if (media.scene.cruise?.sunlight) frame.append(image("directive-hero-scene-layer", media.scene.cruise.sunlight, "sunlight"));
  frame.append(placeholder);
  return frame;
}

function createChronometer(time = {}) {
  const root = createElement("div", "directive-ship-chronometer directive-ship-chronometer-campaign");
  root.append(
    appendText(createElement("span", "directive-ship-chronometer-label"), "Ship time"),
    appendText(createElement("strong", "directive-ship-chronometer-clock"), fact(time.clock_display, "Unavailable")),
    appendText(
      createElement("span", "directive-ship-chronometer-stardate"),
      finiteProjectionNumber(time.stardate) === null ? "Stardate unavailable" : `Stardate ${Number(time.stardate).toFixed(1)}`,
    ),
  );
  return root;
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

function finiteProjectionNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nextModeIndex(index, key, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
