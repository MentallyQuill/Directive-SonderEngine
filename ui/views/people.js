import { appendText, createElement, setClassState } from "../primitives.js";

const RANK_PIPS = Object.freeze({
  captain: ["solid", "solid", "solid", "solid"],
  commander: ["solid", "solid", "solid"],
  lieutenant_commander: ["solid", "solid", "hollow"],
  lieutenant: ["solid", "solid"],
  lieutenant_junior_grade: ["solid", "hollow"],
  ensign: ["solid"],
});

const DIVISION_BY_DEPARTMENT = Object.freeze({
  command: "command", flight: "command",
  tactical: "operations", security: "operations", operations: "operations", engineering: "operations",
  science: "science", medical: "science",
});

const PUBLIC_RECORD_FIELDS = Object.freeze([
  ["affiliation", "Affiliation"],
  ["age", "Age"],
  ["birthplace", "Birthplace"],
  ["serviceBackground", "Service background"],
  ["assignmentHistory", "Assignment history"],
]);

export function renderPeopleView(data = {}, state = {}, actions = {}) {
  hydratePeopleState(data, state);
  const model = buildPeopleModel(data, state);
  const persist = () => persistPeopleState(data, state);
  persist();
  const root = createElement("section", "directive-expanded-people people-route");
  root.dataset.directiveScrollOwner = "true";
  root.append(renderBearing(data.command_bearing || {}, actions));

  const host = createElement("div", "people-journal-host");
  host.dataset.directiveScrollOwner = "true";
  root.append(host);
  drawJournal();
  return root;

  function drawJournal() {
    host.replaceChildren();
    const desktopSelection = { rows: new Map(), detail: null };
    const desktop = createElement("div", "people-layout people-journal people-desktop-journal");
    const roster = createElement("aside", "people-roster");
    roster.append(createToolbar());
    const categoryList = createElement("div", "people-category-list");
    categoryList.dataset.directiveScrollOwner = "true";
    for (const category of orderedCategories(state)) {
      categoryList.append(renderCategory(category, false, desktopSelection));
    }
    roster.append(categoryList);
    desktopSelection.detail = renderPersonDetail(model.byId.get(state.selectedPersonId), false, actions);
    desktop.append(roster, desktopSelection.detail);

    const mobile = createElement("div", "mobile-crew-accordion");
    mobile.append(createToolbar());
    const mobileDisclosures = new Map();
    for (const category of orderedCategories(state)) {
      mobile.append(renderCategory(category, true, desktopSelection, mobileDisclosures));
    }
    host.append(desktop, mobile);

    function select(personId) {
      const person = model.byId.get(personId);
      if (!person) return;
      state.selectedPersonId = person.id;
      persist();
      for (const [id, record] of desktopSelection.rows) {
        const active = id === person.id;
        setClassState(record.row, "active", active);
        record.select.setAttribute("aria-pressed", active ? "true" : "false");
      }
      const next = renderPersonDetail(person, false, actions);
      desktopSelection.detail?.parentNode?.replaceChild(next, desktopSelection.detail);
      desktopSelection.detail = next;
    }

    function createToolbar() {
      const toolbar = createElement("div", "people-collection-toolbar");
      const label = appendText(createElement("strong"), "Personnel records");
      const add = appendText(createElement("button", "people-add-category"), "+ Category");
      add.type = "button";
      add.addEventListener("click", () => {
        const id = `custom-${state.nextCategoryId++}`;
        const category = { id, label: "New Category" };
        state.customCategories.push(category);
        state.categories.push(category);
        state.categoryOrder.push(id);
        state.categoryRecords[id] = [];
        state.editingCategoryId = id;
        persist();
        drawJournal();
        focusLater(`.collection-category[data-category-id="${id}"] .collection-category-input`);
      });
      toolbar.append(label, add);
      return toolbar;
    }

    function renderCategory(category, mobileMode, desktopState, mobileDisclosures = new Map()) {
      const section = createElement("section", `collection-category${mobileMode ? " mobile-people-category" : ""}`);
      section.dataset.categoryId = category.id;
      const head = createElement("header", "collection-category-head");
      const disclosure = appendText(createElement("button", "collection-disclosure"), "›");
      disclosure.type = "button";
      const collapsed = state.collapsedCategoryIds.includes(category.id);
      disclosure.setAttribute("aria-expanded", collapsed ? "false" : "true");
      disclosure.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${category.label}`);
      disclosure.addEventListener("click", () => {
        toggleInArray(state.collapsedCategoryIds, category.id);
        persist();
        drawJournal();
      });
      const copy = createElement("span", "collection-category-copy");
      const categoryActions = createElement("span", "collection-category-actions");
      if (!category.system && state.editingCategoryId === category.id) {
        const input = createElement("input", "collection-category-input");
        input.value = category.label;
        input.setAttribute("aria-label", "Category name");
        const save = () => {
          const value = input.value.trim();
          if (value) {
            category.label = value;
            const stored = state.customCategories.find((entry) => entry.id === category.id);
            if (stored) stored.label = value;
          }
          state.editingCategoryId = "";
          persist();
          drawJournal();
        };
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") {
            state.editingCategoryId = "";
            drawJournal();
          }
        });
        copy.append(input);
        categoryActions.append(
          iconButton("Save category", "✓", save),
          iconButton("Cancel edit", "×", () => {
            state.editingCategoryId = "";
            drawJournal();
          }),
        );
      } else {
        copy.append(
          appendText(createElement("strong"), category.label),
          appendText(createElement("small"), `${category.recordIds.length} ${category.recordIds.length === 1 ? "person" : "people"}`),
        );
        if (!category.system) {
          categoryActions.append(
            iconButton("Rename category", "✎", () => {
              state.editingCategoryId = category.id;
              drawJournal();
              focusLater(`.collection-category[data-category-id="${category.id}"] .collection-category-input`);
            }),
            iconButton("Remove category", "×", () => {
              const destination = state.categoryRecords.contacts || state.categoryRecords["ships-company"];
              destination.push(...category.recordIds);
              state.customCategories = state.customCategories.filter((entry) => entry.id !== category.id);
              state.categories = state.categories.filter((entry) => entry.id !== category.id);
              state.categoryOrder = state.categoryOrder.filter((id) => id !== category.id);
              delete state.categoryRecords[category.id];
              persist();
              drawJournal();
            }, "danger"),
          );
        }
      }
      const categoryHandle = reorderHandle(category.label, (event) => {
        if (!event.key?.startsWith("Arrow")) return;
        const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
        moveWithin(state.categoryOrder, category.id, direction);
        event.preventDefault();
        persist();
        drawJournal();
        focusLater(`${mobileMode ? ".mobile-crew-accordion" : ".people-desktop-journal"} .collection-category[data-category-id="${category.id}"] > .collection-category-head > .collection-drag-handle`);
      }, "", {
        itemSelector: ".collection-category",
        listSelector: mobileMode ? ".mobile-crew-accordion" : ".people-category-list",
        idAttribute: "data-category-id",
        onDrop: (categoryId, _list, toIndex) => {
          const current = state.categoryOrder.indexOf(categoryId);
          if (current < 0) return;
          state.categoryOrder.splice(current, 1);
          state.categoryOrder.splice(Math.max(0, Math.min(state.categoryOrder.length, toIndex)), 0, categoryId);
          persist();
          drawJournal();
        },
      });
      head.append(disclosure, copy, categoryActions, categoryHandle);
      section.append(head);
      if (collapsed) return section;

      const list = createElement("div", mobileMode ? "mobile-people-list collection-person-list" : "collection-person-list");
      list.dataset.categoryId = category.id;
      for (const personId of category.recordIds) {
        const person = model.byId.get(personId);
        if (!person) continue;
        list.append(mobileMode
          ? renderMobileRecord(person, category, desktopState, mobileDisclosures)
          : renderDesktopRecord(person, category, desktopState));
      }
      section.append(list);
      return section;
    }

    function renderDesktopRecord(person, category, selection) {
      const active = state.selectedPersonId === person.id;
      const row = createElement("article", `collection-person-row${active ? " active" : ""}`);
      row.dataset.personId = person.id;
      const control = createElement("button", "people-row");
      control.type = "button";
      control.dataset.personId = person.id;
      control.setAttribute("aria-pressed", active ? "true" : "false");
      control.append(createPortrait(person, "thumb", "people-row-image"), createRecordCopy(person));
      control.addEventListener("click", () => select(person.id));
      const handle = reorderHandle(person.name, (event) => {
        if (!event.key?.startsWith("Arrow")) return;
        const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
        movePerson(category.id, person.id, direction);
        event.preventDefault();
        persist();
        drawJournal();
        focusLater(`.people-desktop-journal .collection-person-row[data-person-id="${person.id}"] .collection-person-drag-handle`);
      }, "collection-person-drag-handle", {
        itemSelector: ".collection-person-row",
        listSelector: ".collection-person-list",
        idAttribute: "data-person-id",
        onDrop: (personId, toList, toIndex) => {
          movePersonTo(personId, toList.dataset.categoryId, toIndex);
          persist();
          drawJournal();
        },
      });
      row.append(control, handle);
      selection.rows.set(person.id, { row, select: control });
      return row;
    }

    function renderMobileRecord(person, category, desktopState, disclosures) {
      const open = state.mobileOpenPersonId === person.id;
      const item = createElement("article", `mobile-accordion-item mobile-crew-item collection-person-row${open ? " is-open" : ""}`);
      item.dataset.personId = person.id;
      const head = createElement("div", "mobile-accordion-head");
      head.append(createPortrait(person, "thumb", "mobile-crew-avatar"));
      const toggle = createElement("button", "mobile-accordion-toggle");
      toggle.type = "button";
      toggle.dataset.personId = person.id;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.append(createRecordCopy(person), appendText(createElement("span", "mobile-accordion-chevron"), "›"));
      const handle = reorderHandle(person.name, (event) => {
        if (!event.key?.startsWith("Arrow")) return;
        const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
        movePerson(category.id, person.id, direction);
        event.preventDefault();
        persist();
        drawJournal();
        focusLater(`.mobile-crew-accordion .collection-person-row[data-person-id="${person.id}"] .collection-person-drag-handle`);
      }, "collection-person-drag-handle", {
        itemSelector: ".collection-person-row",
        listSelector: ".collection-person-list",
        idAttribute: "data-person-id",
        onDrop: (personId, toList, toIndex) => {
          movePersonTo(personId, toList.dataset.categoryId, toIndex);
          persist();
          drawJournal();
        },
      });
      head.append(toggle, handle);
      item.append(head);
      const disclosureState = { item, toggle, detail: null };
      disclosures.set(person.id, disclosureState);
      const setExpanded = (expanded) => {
        setClassState(item, "is-open", expanded);
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        if (expanded && !disclosureState.detail) {
          disclosureState.detail = createElement("div", "mobile-accordion-detail");
          disclosureState.detail.append(renderPersonDetail(person, true, actions));
          item.append(disclosureState.detail);
        } else if (!expanded && disclosureState.detail) {
          disclosureState.detail.remove();
          disclosureState.detail = null;
        }
      };
      disclosureState.setExpanded = setExpanded;
      toggle.addEventListener("click", () => {
        const expanding = !item.classList.contains("is-open");
        for (const [id, other] of disclosures) {
          if (id !== person.id) other.setExpanded(false);
        }
        setExpanded(expanding);
        state.mobileOpenPersonId = expanding ? person.id : "";
        persist();
        if (expanding) select(person.id);
      });
      if (open) setExpanded(true);
      return item;
    }

    function movePerson(categoryId, personId, direction) {
      const categories = orderedCategories(state);
      const categoryIndex = categories.findIndex((entry) => entry.id === categoryId);
      const current = state.categoryRecords[categoryId];
      const index = current.indexOf(personId);
      const destinationIndex = index + direction;
      if (destinationIndex >= 0 && destinationIndex < current.length) {
        current.splice(index, 1);
        current.splice(destinationIndex, 0, personId);
        return;
      }
      const adjacent = categories[categoryIndex + direction];
      if (!adjacent) return;
      current.splice(index, 1);
      state.categoryRecords[adjacent.id].splice(direction < 0 ? state.categoryRecords[adjacent.id].length : 0, 0, personId);
    }

    function movePersonTo(personId, targetCategoryId, toIndex) {
      const source = Object.values(state.categoryRecords).find((ids) => ids.includes(personId));
      const target = state.categoryRecords[targetCategoryId];
      if (!source || !target) return;
      source.splice(source.indexOf(personId), 1);
      target.splice(Math.max(0, Math.min(target.length, toIndex)), 0, personId);
    }
  }
}

function buildPeopleModel(data, state) {
  const player = normalizePlayer(data.player || data.viewer || {});
  const crew = [];
  const contacts = [];
  for (const raw of data.people || []) {
    const record = normalizePerson(raw);
    if (!record) continue;
    (raw.directive ? crew : contacts).push(record);
  }
  const records = [player, ...crew, ...contacts].filter(Boolean);
  const byId = new Map(records.map((record) => [record.id, record]));
  const systemCategories = [
    { id: "ships-company", label: "Ship's Company", system: true },
    ...(contacts.length ? [{ id: "contacts", label: "Contacts", system: true }] : []),
  ];
  if (!Array.isArray(state.customCategories)) state.customCategories = [];
  if (!Number.isInteger(state.nextCategoryId)) state.nextCategoryId = 1;
  if (!state.categoryRecords) state.categoryRecords = {};
  if (!Array.isArray(state.categoryOrder)) state.categoryOrder = [];
  if (!Array.isArray(state.collapsedCategoryIds)) state.collapsedCategoryIds = [];
  state.categories = [...systemCategories, ...state.customCategories];
  const validIds = new Set(records.map(({ id }) => id));
  const assigned = new Set();
  for (const category of state.categories) {
    const existing = (state.categoryRecords[category.id] || []).filter((id) => validIds.has(id) && !assigned.has(id));
    state.categoryRecords[category.id] = existing;
    existing.forEach((id) => assigned.add(id));
  }
  const defaultIds = {
    "ships-company": [player?.id, ...crew.map(({ id }) => id)].filter(Boolean),
    contacts: contacts.map(({ id }) => id),
  };
  for (const [categoryId, ids] of Object.entries(defaultIds)) {
    if (!state.categoryRecords[categoryId]) continue;
    for (const id of ids) {
      if (!assigned.has(id)) {
        state.categoryRecords[categoryId].push(id);
        assigned.add(id);
      }
    }
  }
  const validCategories = new Set(state.categories.map(({ id }) => id));
  state.categoryOrder = state.categoryOrder.filter((id) => validCategories.has(id));
  for (const category of state.categories) {
    if (!state.categoryOrder.includes(category.id)) state.categoryOrder.push(category.id);
  }
  state.collapsedCategoryIds = state.collapsedCategoryIds.filter((id) => validCategories.has(id));
  if (!byId.has(state.selectedPersonId)) state.selectedPersonId = player?.id || crew[0]?.id || contacts[0]?.id || null;
  if (state.mobileOpenPersonId === undefined) state.mobileOpenPersonId = player?.id || "";
  return { records, byId };
}

function orderedCategories(state) {
  const byId = new Map(state.categories.map((category) => [category.id, category]));
  return state.categoryOrder.map((id) => byId.get(id)).filter(Boolean).map((category) => ({
    ...category,
    recordIds: state.categoryRecords[category.id] || [],
  }));
}

function normalizePlayer(raw) {
  if (!raw || !present(raw.name)) return null;
  return {
    id: String(raw.id || "player"), isPlayer: true, name: String(raw.name),
    rank: raw.service?.rank_label || raw.service?.rankLabel || "Commander",
    billet: raw.billet || "Executive Officer", role: raw.role, species: raw.species,
    appearance: raw.appearance, profileSummary: raw.appearance,
    publicRecord: { age: raw.age_band },
    service: normalizeService(raw.service, "Commander", "command"),
    portrait: raw.portrait,
  };
}

function normalizePerson(raw) {
  if (!raw || !present(raw.id) || !present(raw.display_name)) return null;
  const domain = raw.directive || {};
  const publicRecord = domain.public_record || {};
  return {
    id: String(raw.id), isPlayer: false, name: String(raw.display_name), rank: domain.rank || "",
    billet: domain.role || (raw.directive ? "Recognized crew" : "Observed contact"), role: domain.role,
    species: domain.species || publicRecord.species,
    profileSummary: domain.operational_summary || raw.facts?.public_history,
    publicRecord,
    service: domain.service || (raw.directive ? normalizeService(null, domain.rank, domain.department) : null),
    portrait: domain.media,
  };
}

function normalizeService(service, rank, department) {
  return {
    organization: service?.organization || "starfleet",
    department: service?.department || department || "operations",
    rankCode: service?.rankCode || service?.rank_code || rankCode(rank),
    rankLabel: service?.rankLabel || service?.rank_label || rank || "",
  };
}

function rankCode(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function renderBearing(bearing, actions) {
  const section = createElement("section", "directive-command-bearing-strip");
  section.dataset.directiveTour = "crew.command-bearing";
  const balance = Number.isInteger(bearing.balance) ? bearing.balance : 0;
  const capacity = Number.isInteger(bearing.capacity) && bearing.capacity > 0 ? bearing.capacity : 3;
  const copy = createElement("div", "directive-command-bearing-copy");
  copy.append(
    appendText(createElement("span"), "Command Bearing"),
    appendText(createElement("h2"), `${balance} of ${capacity} available`),
    appendText(createElement("p"), bearing.pending_edge
      ? (bearing.pending_edge.status === "armed" ? "A favorable edge is armed for the current response." : "A favorable edge is reserved for the next response.")
      : "A small reserve earned through meaningful command decisions."),
  );
  const pips = createElement("div", "directive-command-bearing-pips");
  pips.setAttribute("aria-label", `${balance} of ${capacity} Command Bearing available`);
  for (let index = 0; index < capacity; index += 1) {
    const pip = createElement("span", index < balance ? "is-filled" : "");
    pip.setAttribute("aria-hidden", "true");
    pips.append(pip);
  }
  const commands = createElement("div", "directive-command-bearing-actions");
  const pending = bearing.pending_edge;
  const handler = pending ? actions.cancelCommandBearingEdge : actions.reserveCommandBearingEdge;
  const button = appendText(createElement("button", pending ? "people-command" : "people-command people-command-primary"), pending ? "Cancel edge" : "Use Command Bearing");
  button.type = "button";
  button.disabled = typeof handler !== "function" || (!pending && balance <= 0);
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    try { await handler(); await actions.refresh?.(); }
    finally { button.disabled = typeof handler !== "function" || (!pending && balance <= 0); }
  });
  commands.append(button);
  section.append(copy, pips, commands);
  return section;
}

function createRecordCopy(person) {
  const copy = createElement("span", "people-row-copy");
  const pips = pipStrip(person);
  if (pips) copy.append(pips);
  copy.append(
    appendText(createElement("strong"), person.name),
    appendText(createElement("span", "people-row-billet"), person.billet || person.role || ""),
  );
  return copy;
}

function pipStrip(person, className = "") {
  const service = person.service;
  if (service?.organization !== "starfleet") return null;
  const division = DIVISION_BY_DEPARTMENT[service.department] || "operations";
  const strip = createElement("span", `people-pips people-pips-${division}${className ? ` ${className}` : ""}`);
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", [service.rankLabel, service.department].filter(Boolean).join(", "));
  for (const kind of RANK_PIPS[service.rankCode] || []) strip.append(createElement("i", `people-pip people-pip-${kind}`));
  return strip;
}

function createPortrait(person, variant, wrapperClass) {
  const frame = createElement("figure", `directive-media-frame ${person.isPlayer ? "directive-player-portrait-frame " : ""}${wrapperClass}`);
  const path = person.portrait?.variants?.[variant === "detail" ? "detail" : "thumb"];
  if (present(path)) {
    const image = createElement("img", "directive-media-image");
    image.src = path;
    image.alt = variant === "detail" ? literal(person.portrait?.alt, person.name) : "";
    image.loading = variant === "detail" ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;
    frame.append(image);
    return frame;
  }
  const placeholder = createElement("div", "directive-media-placeholder");
  const placeholderIcon = createElement("span", "directive-media-placeholder-icon");
  const icon = createElement("span", "directive-asset-mask-icon");
  icon.style.setProperty("--directive-asset-mask-url", "url('/api/extensions/directive/asset/assets/icons/comm-badge.svg')");
  placeholderIcon.append(icon);
  placeholder.append(placeholderIcon, appendText(createElement("strong", "directive-media-placeholder-label"), initials(person.name)));
  frame.classList.add("directive-media-frame-placeholder");
  frame.append(placeholder);
  return frame;
}

function createPortraitControl({ label, className, iconClass = "", glyph = "", disabled = false, onClick = null }) {
  const button = createElement("button", `directive-crew-player-portrait-control ${className}`);
  button.type = "button";
  button.disabled = disabled;
  button.title = label;
  button.setAttribute("aria-label", label);
  const visual = appendText(createElement("span", iconClass || "directive-crew-player-portrait-confirmation-glyph"), glyph);
  visual.setAttribute("aria-hidden", "true");
  button.append(visual);
  if (typeof onClick === "function") {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try { await onClick(); }
      finally { button.disabled = disabled; }
    });
  }
  return button;
}

function createPlayerPortraitActions(person, actions) {
  const supported = typeof actions.importCampaignPlayerPortrait === "function"
    && typeof actions.removeCampaignPlayerPortrait === "function";
  const hasImportedPortrait = present(person.portrait?.asset?.path);
  const row = createElement("div", "directive-crew-player-portrait-controls");
  const fileInput = createElement("input", "directive-crew-player-portrait-input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  fileInput.hidden = true;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0] || null;
    if (!file) return;
    await actions.importCampaignPlayerPortrait({ file });
    fileInput.value = "";
    await actions.refresh?.();
  });
  const renderNormal = () => {
    const upload = createPortraitControl({
      label: hasImportedPortrait ? "Replace player image" : "Add player image",
      className: "directive-crew-player-portrait-upload",
      iconClass: "directive-crew-player-portrait-icon directive-crew-player-portrait-upload-icon",
      disabled: !supported,
      onClick: () => fileInput.click(),
    });
    const remove = createPortraitControl({
      label: hasImportedPortrait ? "Remove player image" : "No player image to remove",
      className: "directive-crew-player-portrait-remove",
      iconClass: "directive-crew-player-portrait-icon directive-crew-player-portrait-remove-icon",
      disabled: !supported || !hasImportedPortrait,
      onClick: renderConfirmation,
    });
    row.replaceChildren(upload, remove, fileInput);
  };
  const renderConfirmation = () => {
    const confirm = createPortraitControl({
      label: "Confirm remove image",
      className: "directive-crew-player-portrait-confirm",
      glyph: "✓",
      onClick: async () => {
        await actions.removeCampaignPlayerPortrait();
        await actions.refresh?.();
      },
    });
    const cancel = createPortraitControl({
      label: "Cancel remove image",
      className: "directive-crew-player-portrait-cancel",
      glyph: "×",
      onClick: renderNormal,
    });
    row.replaceChildren(confirm, cancel, fileInput);
  };
  renderNormal();
  return row;
}

function renderPersonDetail(person, mobile = false, actions = {}) {
  const detail = createElement("section", `people-detail${mobile ? " people-detail-mobile" : ""}`);
  if (!mobile) detail.dataset.directiveScrollOwner = "true";
  if (!person) return detail;
  detail.dataset.personId = person.id;
  const hero = createElement("header", "people-detail-hero");
  const portrait = createPortrait(person, "detail", "people-detail-portrait");
  if (person.isPlayer) portrait.append(createPlayerPortraitActions(person, actions));
  hero.append(portrait);
  const identity = createElement("div", "people-detail-identity");
  const nameLine = createElement("div", "people-detail-name-line");
  nameLine.append(appendText(createElement("h2"), person.name));
  const pips = pipStrip(person, "people-pips-detail");
  if (pips) nameLine.append(pips);
  identity.append(
    appendText(createElement("span"), person.isPlayer ? "Your commander" : (person.service ? "Personnel record" : "Observed contact")),
    nameLine,
  );
  const role = [person.rank, person.billet || person.role].filter(present).join(" / ");
  if (role) identity.append(appendText(createElement("strong"), role));
  if (present(person.species)) identity.append(appendText(createElement("span", "people-detail-species"), person.species));
  hero.append(identity);
  detail.append(hero);
  let blocks = 0;
  blocks += appendDefinition(detail, "Profile", person.profileSummary || person.appearance);
  blocks += appendPublicRecord(detail, person);
  if (!blocks) detail.append(appendText(createElement("p", "people-detail-block people-detail-empty"), "No additional public details are available."));
  return detail;
}

function appendDefinition(container, label, value) {
  if (!present(value)) return 0;
  const section = createElement("section", "people-detail-block");
  section.append(appendText(createElement("h3"), label), appendText(createElement("p"), value));
  container.append(section);
  return 1;
}

function appendPublicRecord(container, person) {
  const rows = PUBLIC_RECORD_FIELDS.map(([key, label]) => [label, person.publicRecord?.[key]]).filter(([, value]) => present(value));
  if (!rows.length) return 0;
  const section = createElement("section", "people-detail-block people-service-record");
  const list = createElement("dl");
  for (const [label, value] of rows) {
    const row = createElement("div");
    row.append(appendText(createElement("dt"), label), appendText(createElement("dd"), value));
    list.append(row);
  }
  section.append(appendText(createElement("h3"), person.service?.organization === "starfleet" ? "Service record" : "Public record"), list);
  container.append(section);
  return 1;
}

function reorderHandle(label, onKeyDown, extraClass = "", pointerOptions = null) {
  const handle = createElement("button", `collection-drag-handle${extraClass ? ` ${extraClass}` : ""}`);
  handle.type = "button";
  handle.setAttribute("aria-label", `Reorder ${label}`);
  handle.addEventListener("keydown", onKeyDown);
  if (pointerOptions) bindPointerReorder(handle, pointerOptions);
  return handle;
}

function bindPointerReorder(handle, {
  itemSelector, listSelector, idAttribute, onDrop,
}) {
  let drag = null;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const item = handle.closest(itemSelector);
    const list = handle.closest(listSelector);
    const id = item?.getAttribute(idAttribute);
    if (!item || !list || !id) return;
    event.preventDefault?.();
    const owner = handle.ownerDocument;
    drag = { id, item, list, pointerId: event.pointerId, targetList: list, target: item, before: false };
    item.classList.add("is-dragging");
    const move = (moveEvent) => {
      if (!drag || (drag.pointerId !== undefined && moveEvent.pointerId !== drag.pointerId)) return;
      moveEvent.preventDefault?.();
      const hovered = owner.elementFromPoint?.(moveEvent.clientX, moveEvent.clientY);
      const targetList = hovered?.closest?.(listSelector);
      const target = hovered?.closest?.(itemSelector);
      if (!targetList) return;
      drag.targetList = targetList;
      drag.target = target?.parentElement === targetList && target !== drag.item ? target : null;
      const rect = drag.target?.getBoundingClientRect?.();
      drag.before = Boolean(rect && moveEvent.clientY < rect.top + (rect.height / 2));
    };
    const finish = (upEvent) => {
      if (!drag || (drag.pointerId !== undefined && upEvent.pointerId !== drag.pointerId)) return;
      move(upEvent);
      owner.removeEventListener("pointermove", move, true);
      owner.removeEventListener("pointerup", finish, true);
      owner.removeEventListener("pointercancel", cancel, true);
      const current = drag;
      drag = null;
      current.item.classList.remove("is-dragging");
      const ids = [...current.targetList.querySelectorAll(`:scope > ${itemSelector}`)]
        .map((candidate) => candidate.getAttribute(idAttribute))
        .filter((id) => id && id !== current.id);
      const targetId = current.target?.getAttribute(idAttribute);
      const targetIndex = targetId && ids.includes(targetId)
        ? ids.indexOf(targetId) + (current.before ? 0 : 1)
        : ids.length;
      onDrop(current.id, current.targetList, targetIndex);
    };
    const cancel = () => {
      if (!drag) return;
      drag.item.classList.remove("is-dragging");
      drag = null;
      owner.removeEventListener("pointermove", move, true);
      owner.removeEventListener("pointerup", finish, true);
      owner.removeEventListener("pointercancel", cancel, true);
    };
    owner.addEventListener("pointermove", move, true);
    owner.addEventListener("pointerup", finish, true);
    owner.addEventListener("pointercancel", cancel, true);
  });
}

function peopleScope(data) {
  return [data.campaign?.id || "campaign", data.chat_id || "main"].join(":");
}

function peopleStorage(data) {
  const storage = globalThis.document?.defaultView?.localStorage;
  return {
    storage,
    key: `directive.people.preferences.v1:${encodeURIComponent(peopleScope(data))}`,
  };
}

function hydratePeopleState(data, state) {
  const { storage, key } = peopleStorage(data);
  if (state.__peopleHydratedScope === key) return;
  try {
    const stored = JSON.parse(storage?.getItem?.(key) || "null");
    if (stored && typeof stored === "object") {
      for (const field of [
        "selectedPersonId", "mobileOpenPersonId", "customCategories",
        "categoryRecords", "categoryOrder", "collapsedCategoryIds", "nextCategoryId",
      ]) {
        if (stored[field] !== undefined) state[field] = structuredClone(stored[field]);
      }
    }
  } catch {}
  state.__peopleHydratedScope = key;
}

function persistPeopleState(data, state) {
  const { storage, key } = peopleStorage(data);
  const stored = {};
  for (const field of [
    "selectedPersonId", "mobileOpenPersonId", "customCategories",
    "categoryRecords", "categoryOrder", "collapsedCategoryIds", "nextCategoryId",
  ]) {
    if (state[field] !== undefined) stored[field] = structuredClone(state[field]);
  }
  try { storage?.setItem?.(key, JSON.stringify(stored)); } catch {}
}

function iconButton(label, glyph, onClick, className = "") {
  const button = appendText(createElement("button", `collection-icon-button${className ? ` ${className}` : ""}`), glyph);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return button;
}

function moveWithin(values, id, direction) {
  const index = values.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= values.length) return;
  values.splice(index, 1);
  values.splice(target, 0, id);
}

function toggleInArray(values, id) {
  const index = values.indexOf(id);
  if (index >= 0) values.splice(index, 1);
  else values.push(id);
}

function focusLater(selector) {
  const schedule = globalThis.requestAnimationFrame
    || globalThis.document?.defaultView?.requestAnimationFrame?.bind(globalThis.document.defaultView);
  schedule?.(() => document.querySelector(selector)?.focus());
}

function initials(value) {
  return String(value || "PC").trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() || "").join("") || "PC";
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function literal(value, unavailable) {
  return present(value) ? String(value) : unavailable;
}
