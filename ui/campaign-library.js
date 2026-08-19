import { appendText, createElement } from "./primitives.js";
import { createCampaignHeroScene } from "./hero-scene.js";
import { bindReactiveHeroOrbit } from "./reactive-hero-orbit.js";
import { bindSingleOpenDisclosure } from "./mobile-record-disclosure.js";

const ASSET_ROOT = "/api/extensions/directive/asset/assets/packages";

function campaign({ id, title, era, theater, shipId, shipName, shipClass, summary, packageRoot, available = false, layered = false }) {
  return Object.freeze({
    id,
    packageId: id,
    title,
    description: summary,
    availability: available ? "available" : "coming-later",
    disabled: !available,
    facts: Object.freeze([
      Object.freeze({ label: "Era", value: era }),
      Object.freeze({ label: "Theater", value: theater }),
      Object.freeze({ label: "Assignment", value: `${shipName}, ${shipClass}` }),
      Object.freeze({ label: "Your Role", value: "Commander, Executive Officer" }),
    ]),
    image: Object.freeze({
      alt: `${shipName} campaign artwork`,
      hero: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero.webp`,
      card: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.card.webp`,
      thumb: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.thumb.webp`,
      ...(layered ? {
        scene: Object.freeze({
          layers: Object.freeze({
            background: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-background.webp`,
            stars: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-stars.webp`,
            foreground: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-ship.webp`,
          }),
          cruise: Object.freeze({
            farStars: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-stars-far.svg`,
            nearStars: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-stars-near.svg`,
            sunlight: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-sunlight.svg`,
          }),
          emissive: Object.freeze({
            windows: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-windows.png`,
            nacelles: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-nacelles.png`,
            windowNoise: `${ASSET_ROOT}/${packageRoot}/images/ship/${shipId}.hero-window-noise.webp`,
          }),
        }),
      } : {}),
    }),
  });
}

export const DIRECTIVE_CAMPAIGN_LIBRARY = Object.freeze([
  campaign({
    id: "directive:campaign-package:breckenridge-ashes-of-peace",
    title: "Ashes of Peace",
    era: "2376, Post-Dominion War",
    theater: "Asterion Reach",
    shipId: "uss-breckenridge",
    shipName: "U.S.S. Breckenridge",
    shipClass: "Intrepid-class",
    packageRoot: "breckenridge",
    available: true,
    layered: true,
    summary: "The Dominion War is over, but the choices made to survive it still shape Federation worlds. You join the USS Breckenridge as its new executive officer while a mostly reconstituted crew returns to service. Three days later, a stabilization assignment begins with missing relief crews and counterfeit Starfleet orders. Command the mission, shape the crew, and decide what Starfleet principles require when restoring the old order may not be enough.",
  }),
  campaign({
    id: "directive:campaign-package:glass-harbor-drowned-constellation",
    title: "Drowned Constellation",
    era: "2373, Dominion War",
    theater: "Nerine Reef",
    shipId: "uss-glass-harbor",
    shipName: "U.S.S. Glass Harbor",
    shipClass: "Steamrunner-class",
    packageRoot: "glass-harbor",
    summary: "As the newly promoted executive officer of the USS Glass Harbor, you enter the unmapped currents of the Nerine Reef. When the captain and her shuttle vanish during a gravitic inversion, you assume acting command. Rescue, survey, escort, and diplomacy all depend on charts that different communities need for different reasons. Decide who may map the Reef when every reliable route can save lives, expose a sanctuary, create a border, or become a weapon.",
  }),
  campaign({
    id: "directive:campaign-package:serein-black-current",
    title: "Black Current",
    era: "2376, Post-Dominion War",
    theater: "Vanta Wake",
    shipId: "uss-serein",
    shipName: "U.S.S. Serein",
    shipClass: "Steamrunner-class",
    packageRoot: "serein",
    summary: "The Dominion War is over, but the Vanta Wake continues to deliver its wreckage. A migrating subspace current releases damaged vessels, live ordnance, records, and survivors months after the battles that trapped them. Command the USS Serein through rescue operations where every recovered person and object carries competing claims. Decide who owns what returns, which people are still legally alive, and what it means to come home to a world that already buried you.",
  }),
  campaign({
    id: "directive:campaign-package:eudora-vale-broken-accord",
    title: "Broken Accord",
    era: "2378, Post-Dominion War",
    theater: "Ilyra System",
    shipId: "uss-eudora-vale",
    shipName: "U.S.S. Eudora Vale",
    shipClass: "Intrepid-class",
    packageRoot: "eudora-vale",
    summary: "Five inhabited worlds depend on a shared terraforming lattice that has kept their fragile environments alive for generations. When a lattice surge leaves the USS Eudora Vale without its captain, you inherit your first independent command. Keeping the system alive means discovering why its benefits and burdens were never shared honestly. Balance finite Starfleet resources, competing planetary needs, and the question of what lawful authority can replace a peace built on unequal sacrifice.",
  }),
  campaign({
    id: "directive:campaign-package:aster-vale-unseen-border",
    title: "Unseen Border",
    era: "2371",
    theater: "Lacuna March",
    shipId: "uss-aster-vale",
    shipName: "U.S.S. Aster Vale",
    shipClass: "New Orleans-class",
    packageRoot: "aster-vale",
    summary: "Starfleet charts say the Lacuna March is empty in places where families are raising children and convoys still travel by mutable markers. When an official colony route ends in empty space, you take the USS Aster Vale beyond the boundary of reliable maps. Every route you restore may save a settlement, expose a sanctuary, or reveal whose orders made entire communities disappear on paper. Command the ship, protect the witnesses, and decide whether visibility is rescue, betrayal, or both.",
  }),
  campaign({
    id: "directive:campaign-package:celandine-enemys-garden",
    title: "Enemy's Garden",
    era: "2376, Post-Dominion War",
    theater: "Cyradon Relief Cluster",
    shipId: "uss-celandine",
    shipName: "U.S.S. Celandine",
    shipClass: "Norway-class",
    packageRoot: "celandine",
    summary: "Several worlds survived the final years of the Dominion War by adopting K-17 crops that thrive in damaged soil. The harvest prevented famine, but it also displaced local seed lines and bound each world to a dangerous biological inheritance. When the USS Celandine captain enters quarantine, you assume acting command over a relief mission no planet can survive alone. Guide the transition through planting deadlines, finite clean stock, and competing claims over who controls the seeds, the science, and the future.",
  }),
]);

export function renderCampaignBrowser(state = {}, actions = {}, activeCampaign = null) {
  state.selectedRecordKey ||= activeCampaign
    ? `campaign:${activeCampaign.id || activeCampaign.chat_id}`
    : `package:${DIRECTIVE_CAMPAIGN_LIBRARY[0].packageId}`;
  const browser = createElement("section", "campaign-browser");
  browser.dataset.campaignView = "browser";
  if (activeCampaign) browser.append(createBrowserHeading(actions));

  const surface = createElement("div", "directive-expanded-campaign campaign-layout campaign-journal");
  const master = createElement("aside", "campaign-master campaign-index-panel campaign-desktop-master");
  master.dataset.directiveScrollOwner = "true";
  const head = createElement("header", "campaign-index-head");
  head.append(
    appendText(createElement("span", "campaign-kicker"), "Your stories"),
    appendText(createElement("h2"), "Campaigns"),
  );
  master.append(head);
  const list = createElement("div", "campaign-index-list");
  const desktopRows = new Map();
  if (activeCampaign) {
    const key = `campaign:${activeCampaign.id || activeCampaign.chat_id}`;
    const row = createActiveCampaignRow(activeCampaign, state, actions);
    desktopRows.set(key, row);
    list.append(row);
  }
  list.append(appendText(createElement("h3", "campaign-library-heading"), "Campaign library"));
  for (const pack of DIRECTIVE_CAMPAIGN_LIBRARY) {
    const key = `package:${pack.packageId}`;
    const row = createPackageRow(pack, state, actions);
    desktopRows.set(key, row);
    list.append(row);
  }
  master.append(list);

  const detail = createElement("section", "campaign-detail campaign-desktop-detail");
  detail.dataset.directiveScrollOwner = "true";
  detail.append(renderSelectedDetail(state.selectedRecordKey, activeCampaign, actions));

  const mobile = createElement("section", "campaign-mobile-accordion");
  mobile.dataset.directiveScrollOwner = "true";
  const mobileRecords = [];
  if (activeCampaign) {
    const record = createMobileRecord(`campaign:${activeCampaign.id || activeCampaign.chat_id}`, activeCampaign.title || "Ashes of Peace", activeCampaign, actions);
    mobile.append(
      appendText(createElement("h3", "campaign-mobile-section-heading"), "Your stories"),
      record.article,
    );
    mobileRecords.push(record);
  }
  mobile.append(appendText(createElement("h3", "campaign-mobile-section-heading campaign-mobile-library-heading"), "Campaign library"));
  for (const pack of DIRECTIVE_CAMPAIGN_LIBRARY) {
    const record = createMobileRecord(`package:${pack.packageId}`, pack.title, pack, actions);
    mobile.append(record.article);
    mobileRecords.push(record);
  }
  bindSingleOpenDisclosure({
    records: mobileRecords,
    initialOpenKey: state.selectedRecordKey,
    onOpen: (key) => {
      state.selectedRecordKey = key;
      for (const [recordKey, row] of desktopRows) {
        const active = recordKey === key;
        row.classList.toggle("active", active);
        row.setAttribute("aria-pressed", active ? "true" : "false");
      }
      detail.replaceChildren(renderSelectedDetail(key, activeCampaign, actions));
    },
  });
  surface.append(master, detail, mobile);
  browser.append(surface);
  return browser;
}

function createBrowserHeading(actions) {
  const heading = createElement("header", "campaign-browser-heading");
  const back = appendText(createElement("button", "campaign-command campaign-browser-back-command"), "Back to Current Campaign");
  back.type = "button";
  back.dataset.campaignAction = "back-to-current";
  back.addEventListener("click", () => actions.showCurrentCampaign?.());
  heading.append(appendText(createElement("h2"), "Campaigns"), back);
  return heading;
}

function createActiveCampaignRow(campaignValue, state, actions) {
  const key = `campaign:${campaignValue.id || campaignValue.chat_id}`;
  return createSelectableRow({
    key,
    title: campaignValue.title || "Ashes of Peace",
    meta: [campaignValue.playerName, campaignValue.chapter].filter(Boolean).join(" / "),
    status: "Current",
    image: DIRECTIVE_CAMPAIGN_LIBRARY[0].image,
    active: state.selectedRecordKey === key,
    onSelect: () => actions.selectCampaignRecord?.(key),
  });
}

function createPackageRow(pack, state, actions) {
  const key = `package:${pack.packageId}`;
  return createSelectableRow({
    key,
    title: pack.title,
    meta: pack.description,
    status: pack.disabled ? "" : "Playable",
    availability: pack.availability,
    image: pack.image,
    active: state.selectedRecordKey === key,
    onSelect: () => actions.selectCampaignRecord?.(key),
  });
}

function createSelectableRow({ key, title, meta, status, availability, image, active, onSelect }) {
  const row = createElement("button", `campaign-row${active ? " active" : ""}`);
  row.type = "button";
  row.dataset.campaignRecordKey = key;
  if (availability) row.dataset.campaignAvailability = availability;
  row.setAttribute("aria-pressed", active ? "true" : "false");
  row.append(createImageFrame(image, "thumb", "campaign-row-art directive-media-frame"));
  const copy = createElement("span", "campaign-row-copy");
  copy.append(appendText(createElement("strong"), title), appendText(createElement("span"), meta));
  row.append(copy);
  if (status) row.append(appendText(createElement("span", "campaign-row-state"), status));
  if (typeof onSelect === "function") row.addEventListener("click", onSelect);
  return row;
}

function renderSelectedDetail(key, activeCampaign, actions) {
  if (String(key).startsWith("campaign:") && activeCampaign) return renderActiveDetail(activeCampaign, actions);
  const packageId = String(key).replace(/^package:/, "");
  const pack = DIRECTIVE_CAMPAIGN_LIBRARY.find((candidate) => candidate.packageId === packageId) || DIRECTIVE_CAMPAIGN_LIBRARY[0];
  return renderPackageDetail(pack, actions);
}

function renderPackageDetail(pack, actions) {
  const fragment = document.createDocumentFragment();
  const hero = createElement("section", `campaign-hero campaign-browser-hero campaign-library-hero${pack.disabled ? " is-coming-later" : ""}`);
  hero.dataset.campaignAvailability = pack.availability;
  hero.append(pack.image.scene
    ? createCampaignHeroScene(pack.image, "campaign-hero-media directive-media-frame")
    : createImageFrame(pack.image, "hero", "campaign-hero-media directive-media-frame"));
  const copy = createElement("div", "campaign-hero-copy");
  if (pack.disabled) copy.append(appendText(createElement("span", "campaign-status"), "Coming later"));
  copy.append(appendText(createElement("h2"), pack.title));
  hero.append(copy);
  if (!pack.disabled) bindReactiveHeroOrbit(hero);
  const body = createElement("div", "campaign-library-detail-body");
  const description = appendText(createElement("p", "campaign-summary campaign-library-description"), pack.description);
  description.dataset.campaignDescription = "true";
  body.append(description);
  const facts = createElement("div", "campaign-facts campaign-library-facts");
  for (const fact of pack.facts) {
    const item = createElement("div", "campaign-fact");
    item.append(appendText(createElement("span"), fact.label), appendText(createElement("strong"), fact.value));
    facts.append(item);
  }
  const action = appendText(createElement("button", "campaign-command campaign-command-primary"), pack.disabled ? "New campaign" : "Start campaign");
  action.type = "button";
  action.disabled = pack.disabled;
  if (!pack.disabled) action.addEventListener("click", () => actions.startCampaign?.(pack.packageId));
  body.append(facts, action);
  fragment.append(hero, body);
  return fragment;
}

function renderActiveDetail(campaignValue, actions) {
  const wrapper = createElement("div", "campaign-browser-current-detail");
  const pack = DIRECTIVE_CAMPAIGN_LIBRARY[0];
  const hero = createElement("section", "campaign-hero campaign-browser-hero");
  hero.append(createCampaignHeroScene(pack.image, "campaign-hero-media directive-media-frame"));
  const copy = createElement("div", "campaign-hero-copy");
  copy.append(
    appendText(createElement("span", "campaign-status"), "Current campaign"),
    appendText(createElement("h2"), campaignValue.title || pack.title),
    appendText(createElement("p"), [campaignValue.playerName, campaignValue.playerRole].filter(Boolean).join(" / ")),
    appendText(createElement("p", "campaign-summary"), campaignValue.chapter || ""),
  );
  hero.append(copy);
  bindReactiveHeroOrbit(hero);
  const commands = createElement("div", "campaign-detail-actions");
  const continueButton = appendText(createElement("button", "campaign-command campaign-command-primary"), "Continue");
  continueButton.type = "button";
  continueButton.addEventListener("click", () => actions.continueCampaign?.(campaignValue.chat_id));
  commands.append(continueButton);
  wrapper.append(hero, commands);
  return wrapper;
}

function createMobileRecord(key, title, value, actions) {
  const article = createElement("article", "campaign-mobile-record");
  article.dataset.mobileRecordContainerKey = key;
  const image = value.image || DIRECTIVE_CAMPAIGN_LIBRARY[0].image;
  const trigger = createSelectableRow({
    key,
    title,
    meta: value.description || value.chapter || "",
    status: value.disabled ? "" : value.availability === "available" ? "Playable" : "Current",
    availability: value.availability,
    image,
    active: false,
    onSelect: null,
  });
  trigger.classList.add("campaign-mobile-trigger");
  delete trigger.dataset.campaignRecordKey;
  trigger.dataset.mobileRecordKey = key;
  trigger.removeAttribute("aria-pressed");
  const panel = createElement("div", "campaign-mobile-detail");
  panel.id = `campaign-mobile-detail-${key.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`;
  panel.append(renderSelectedDetail(key, String(key).startsWith("campaign:") ? value : null, actions));
  article.append(trigger, panel);
  return { key, trigger, panel, article };
}

function createImageFrame(image, variant, className) {
  const frame = createElement("span", className);
  const node = createElement("img", "directive-media-image");
  node.src = image?.[variant] || "";
  node.alt = image?.alt || "";
  const placeholder = appendText(createElement("span", "directive-media-placeholder"), "Campaign media unavailable.");
  placeholder.hidden = true;
  node.addEventListener("error", () => {
    node.hidden = true;
    placeholder.hidden = false;
  });
  frame.append(node, placeholder);
  return frame;
}
