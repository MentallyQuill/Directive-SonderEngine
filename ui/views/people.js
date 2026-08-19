import { appendText, createElement, setClassState } from "../primitives.js";

const PUBLIC_RECORD_FIELDS = Object.freeze([
  ["affiliation", "Affiliation"],
  ["age", "Age"],
  ["birthplace", "Birthplace"],
  ["serviceBackground", "Service background"],
  ["assignmentHistory", "Assignment history"],
]);

export function renderPeopleView(data = {}, state = {}) {
  const people = orderedPeople(data.people || []);
  if (!people.some((person) => person.id === state.selectedPersonId)) {
    state.selectedPersonId = people[0]?.id || null;
  }

  const root = createElement("section", "directive-expanded-people people-route");
  root.dataset.directiveScrollOwner = "true";
  root.append(renderBearing(data.command_bearing || {}));
  const journal = createElement("div", "people-layout people-journal");
  const roster = createElement("aside", "people-roster");
  const rosterHead = createElement("header", "people-roster-head");
  rosterHead.append(
    appendText(createElement("span"), "Personnel and contacts"),
    appendText(createElement("h2"), "People"),
  );
  const list = createElement("div", "people-roster-list");
  list.dataset.directiveScrollOwner = "true";
  const detail = createElement("section", "people-detail");
  detail.dataset.directiveScrollOwner = "true";
  const controls = people.map((person) => createRosterControl(person));
  controls.forEach((control) => list.append(control));
  roster.append(rosterHead, list);
  journal.append(roster, detail);
  root.append(journal);
  select(state.selectedPersonId);
  return root;

  function createRosterControl(person) {
    const control = createElement("button", "people-row");
    control.type = "button";
    control.dataset.personId = String(person.id || "");
    const thumb = person.directive?.media?.variants?.thumb;
    if (present(thumb)) {
      const portrait = createElement("figure", "people-row-image directive-media-frame");
      const image = createElement("img", "directive-media-image");
      image.src = thumb;
      image.alt = "";
      portrait.append(image);
      control.append(portrait);
    }
    const copy = createElement("span", "people-row-copy");
    copy.append(
      appendText(createElement("strong"), literal(person.display_name, "Observed person")),
      appendText(createElement("span", "people-row-billet"), rosterRole(person)),
    );
    control.append(copy);
    control.addEventListener("click", () => select(person.id));
    return control;
  }

  function select(personId) {
    const person = people.find((record) => record.id === personId) || people[0] || null;
    state.selectedPersonId = person?.id || null;
    for (const control of controls) {
      const active = control.dataset.personId === String(state.selectedPersonId || "");
      setClassState(control, "active", active);
      control.setAttribute("aria-pressed", active ? "true" : "false");
    }
    detail.replaceChildren(renderPersonDetail(person));
  }
}

function renderBearing(bearing) {
  const section = createElement("section", "directive-command-bearing-strip");
  const copy = createElement("div", "directive-command-bearing-copy");
  const available = Number.isInteger(bearing.balance) && Number.isInteger(bearing.capacity) && bearing.capacity > 0;
  copy.append(
    appendText(createElement("span"), "Command Bearing"),
    appendText(createElement("h2"), available ? `${bearing.balance} of ${bearing.capacity} available` : "Unavailable"),
    appendText(createElement("p"), available ? literal(bearing.latest_award_reason, "A reserve earned through meaningful command decisions.") : "Command Bearing unavailable."),
  );
  section.append(copy);
  if (available) {
    const pips = createElement("div", "directive-command-bearing-pips");
    pips.setAttribute("aria-label", `${bearing.balance} of ${bearing.capacity} Command Bearing available`);
    for (let index = 0; index < bearing.capacity; index += 1) pips.append(createElement("span", index < bearing.balance ? "is-filled" : ""));
    section.append(pips);
  }
  return section;
}

function orderedPeople(people) {
  return people
    .map((person, index) => ({ person, index }))
    .sort((left, right) => Number(Boolean(right.person?.directive)) - Number(Boolean(left.person?.directive)) || left.index - right.index)
    .map(({ person }) => person);
}

function rosterRole(person) {
  const domain = person.directive;
  if (!domain) return "Observed contact";
  const role = [domain.rank, domain.role].filter(present).join(" · ");
  return role || "Recognized crew";
}

function renderPersonDetail(person) {
  const content = document.createDocumentFragment();
  if (!person) {
    content.append(appendText(createElement("p"), "No people are currently observed."));
    return content;
  }

  const domain = person.directive || {};
  const hero = createElement("header", "people-detail-hero");
  const media = domain.media?.variants?.detail;
  if (present(media)) {
    const portrait = createElement("figure", "people-detail-portrait");
    const image = createElement("img");
    image.src = media;
    image.alt = literal(domain.media?.alt, "");
    portrait.append(image);
    hero.append(portrait);
  }
  const identity = createElement("div", "people-detail-identity");
  identity.append(
    appendText(createElement("span"), domain.crew_id ? "Personnel record" : "Observed contact"),
    appendText(createElement("h2"), literal(person.display_name, "Observed person")),
  );
  const role = [domain.rank, domain.role].filter(present).join(" / ");
  if (role) identity.append(appendText(createElement("strong"), role));
  if (present(domain.department)) {
    identity.append(appendText(createElement("span", "people-detail-species"), domain.department));
  }
  hero.append(identity);
  content.append(hero);

  let details = 0;
  const renderedFacts = new Set();
  details += appendCopy(content, "Operational summary", domain.operational_summary, renderedFacts);
  details += appendCopy(content, "Public history", person.facts?.public_history, renderedFacts);
  details += appendCopy(content, "Assignment", domain.assignment, renderedFacts);
  details += appendCopy(content, "Duty status", domain.duty_status, renderedFacts);
  details += appendPublicRecord(content, domain.public_record);
  if (!details) {
    content.append(appendText(
      createElement("p", "people-detail-block people-detail-empty"),
      "No additional public details are available.",
    ));
  }
  return content;
}

function appendCopy(container, label, value, renderedFacts) {
  if (!present(value)) return 0;
  const fact = String(value).trim();
  if (renderedFacts.has(fact)) return 0;
  renderedFacts.add(fact);
  const section = createElement("section", "people-detail-block");
  section.append(appendText(createElement("h3"), label), appendText(createElement("p"), fact));
  container.append(section);
  return 1;
}

function appendPublicRecord(container, record = {}) {
  const rows = PUBLIC_RECORD_FIELDS
    .map(([key, label]) => [label, record?.[key]])
    .filter(([, value]) => present(value));
  if (!rows.length) return 0;
  const section = createElement("section", "people-detail-block people-service-record");
  const list = createElement("dl");
  for (const [label, value] of rows) {
    const row = createElement("div");
    row.append(appendText(createElement("dt"), label), appendText(createElement("dd"), value));
    list.append(row);
  }
  section.append(appendText(createElement("h3"), "Public record"), list);
  container.append(section);
  return 1;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function literal(value, unavailable) {
  return present(value) ? String(value) : unavailable;
}
