const NAV = [["campaign", "Campaign"], ["mission", "Mission"], ["ship", "Ship"], ["crew", "Crew"], ["people", "People"]];

const PLAYER_FIELDS = [
  ["name", "Name", "Sam Vickers"],
  ["pronouns_or_address", "Pronouns or address", "they/them"],
  ["species", "Species", "Human"],
  ["age_band", "Age band", "mid-career"],
  ["appearance", "Appearance", "Close-cropped dark hair; composed bearing."],
  ["career_background", "Career background", "Starfleet operations and logistics"],
  ["formative_experience", "Formative experience", "Fleet service during the Dominion War"],
  ["assignment_reason", "Assignment reason", "Requested by Captain Whitaker"],
  ["insight_trait", "Insight trait", "Analytical"],
  ["connection_trait", "Connection trait", "Candid"],
  ["execution_trait", "Execution trait", "Decisive"],
  ["flaw", "Flaw", "Guarded"]
];

export function createDirectiveView(sonder, { onClose = () => sonder.closeView() } = {}) {
  let route = "campaign";
  return {
    id: "directive",
    label: "Directive",
    async render(container) {
      container.replaceChildren();
      const shell = el("div", { class: "directive-app", "data-route": route });
      container.append(shell);
      await draw();

      async function draw() {
        shell.replaceChildren(header(onClose));
        const chatId = sonder.state().chatId;
        if (!chatId) {
          shell.append(startScreen(sonder));
          return;
        }
        let projection;
        try {
          projection = await sonder.api("GET", `/api/extensions/directive/x/projection?chat_id=${encodeURIComponent(chatId)}`);
        } catch (error) {
          shell.append(emptyStory(onClose));
          return;
        }
        shell.querySelector(".directive-close").before(chronometer(projection.time));
        const layout = el("div", { class: "directive-layout" });
        const nav = el("nav", { class: "directive-nav", "aria-label": "Directive sections" });
        for (const [id, label] of NAV) {
          nav.append(el("button", {
            class: `directive-nav__item${route === id ? " is-active" : ""}`,
            type: "button",
            "aria-current": route === id ? "page" : null,
            onclick: () => { route = id; draw(); }
          }, label));
        }
        layout.append(nav, el("main", { class: "directive-main", tabindex: "-1" }, routeView(route, projection)));
        shell.append(layout);
      }
    }
  };
}

function header(onClose) {
  return el("header", { class: "directive-header" },
    el("div", { class: "directive-brand" },
      el("span", { class: "directive-brand__eyebrow" }, "STARFLEET COMMAND CAMPAIGN"),
      el("strong", { class: "directive-brand__title" }, "DIRECTIVE")),
    el("button", { class: "directive-close", type: "button", "aria-label": "Close Directive", onclick: onClose }, "Return to story"));
}

function chronometer(time) {
  return el("div", { class: "directive-chrono", translate: "no" },
    el("span", { class: "directive-chrono__label" }, "SHIP TIME"),
    text(time?.clock_display || ""),
    el("span", { class: "directive-chrono__stardate" }, time?.stardate === undefined ? "" : `SD ${Number(time.stardate).toFixed(1)}`));
}

function startScreen(sonder) {
  const form = el("form", { class: "directive-start" });
  form.append(
    el("p", { class: "directive-kicker" }, "ASHES OF PEACE"),
    el("h1", {}, "Take your place aboard the Breckenridge"),
    el("p", { class: "directive-lede" }, "Create the executive officer Sonder will treat as yours alone. Every field becomes campaign data; none is guessed later."));
  const fields = el("div", { class: "directive-form-grid" });
  for (const [name, label, placeholder] of PLAYER_FIELDS) {
    fields.append(el("label", { class: "directive-field" }, el("span", {}, label),
      el(name === "appearance" ? "textarea" : "input", { name, required: true, autocomplete: "off", placeholder, rows: name === "appearance" ? "3" : null })));
  }
  fields.append(el("label", { class: "directive-field" },
    el("span", {}, "Simulation mode"),
    el("select", { name: "simulation_mode", required: true },
      el("option", { value: "Command" }, "Command · full causal severity"),
      el("option", { value: "Exploration" }, "Exploration · nonfatal senior-staff ceiling"))));
  const status = el("p", { class: "directive-form-status", role: "status" });
  const submit = el("button", { class: "directive-primary", type: "submit" }, "Begin Ashes of Peace");
  form.append(fields, submit, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Provisioning the complete campaign…";
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const made = await sonder.api("POST", "/api/extensions/directive/x/start", body);
      status.textContent = "Campaign created. Opening story…";
      await sonder.chats.open(made.chat_id);
      sonder.refresh();
    } catch (error) {
      submit.disabled = false;
      status.textContent = "The campaign could not be created. No partial story was kept.";
    }
  });
  return form;
}

function emptyStory(onClose) {
  return el("section", { class: "directive-empty" },
    el("p", { class: "directive-kicker" }, "NO DIRECTIVE CAMPAIGN HERE"),
    el("h1", {}, "This story belongs to Sonder"),
    el("p", {}, "Directive only opens campaign state it provisioned. Return to Stories to create or open Ashes of Peace."),
    el("button", { class: "directive-primary", onclick: onClose }, "Return to story"));
}

function routeView(route, data) {
  if (route === "mission") return missionView(data);
  if (route === "ship") return shipView(data.ship);
  if (route === "crew") return peopleView(data.people, true);
  if (route === "people") return peopleView(data.people, false);
  return campaignView(data);
}

function campaignView(data) {
  const mission = data.mission || {};
  const shipHero = data.media?.ship?.variants?.hero;
  return el("section", { class: "directive-view directive-campaign" },
    el("div", { class: "directive-hero", style: shipHero ? `--directive-hero-image: url("${shipHero}")` : null },
      el("p", { class: "directive-kicker" }, "CURRENT ASSIGNMENT"),
      el("h1", {}, titleCase(String(mission.id || "Ashes of Peace").replace(/^mission\./, "").replaceAll("-", " "))),
      el("p", { class: "directive-lede" }, "Command decisions persist on Sonder's committed story lineage."),
      statRow([["COMPLETED", String(data.journey?.completed_count || 0)], ["BEARING", String(data.command_bearing?.balance ?? 0)], ["COHESION", String(data.ship?.cohesion?.total ?? "")]])),
    data.journey?.last_transition ? panel("Latest outcome", list(data.journey.last_transition.outcome_summary || [])) : fragment(),
    panel("Where you are", data.location?.name ? el("p", { translate: "no" }, text(data.location.name)) : el("p", {}, "Location is not currently established.")));
}

function missionView(data) {
  const mission = data.mission || {};
  return el("section", { class: "directive-view" },
    sectionHead("MISSION", titleCase(String(mission.id || "Current mission").replace(/^mission\./, "").replaceAll("-", " ")), `Revision ${mission.revision ?? 0} · ${titleCase(mission.status || "active")}`),
    el("div", { class: "directive-card-grid" }, ...(mission.objectives || []).map(objective =>
      el("article", { class: `directive-card directive-objective is-${String(objective.state || "inactive").toLowerCase()}` },
        el("span", { class: "directive-card__status" }, titleCase(objective.state || "inactive")),
        objective.title ? el("h2", {}, text(objective.title)) : fragment(),
        objective.summary ? el("p", {}, text(objective.summary)) : fragment(),
        objective.terminal_text ? el("p", { class: "directive-result" }, text(objective.terminal_text)) : fragment()))),
    Object.keys(mission.outcome_dimensions || {}).length ? panel("Outcome record", definitionList(mission.outcome_dimensions)) : fragment());
}

function shipView(ship) {
  const cohesion = ship?.cohesion || {};
  return el("section", { class: "directive-view" },
    sectionHead("U.S.S. BRECKENRIDGE", "Operational readiness", `${cohesion.band?.label || ""} · ${cohesion.total ?? ""} Cohesion`),
    el("div", { class: "directive-segments", role: "img", "aria-label": `${cohesion.total ?? 0} cohesion` },
      ...(cohesion.segments || []).map(segment => el("span", { class: `directive-segment${segment.filled ? " is-filled" : " is-open"}`, title: segment.issueId || "Ready" }))),
    el("div", { class: "directive-card-grid" }, ...(ship?.systems || []).map(system =>
      el("article", { class: "directive-card directive-system" },
        el("span", { class: "directive-card__status" }, system.state?.label || ""),
        el("h2", {}, text(system.label || "Ship system")),
        system.state?.mechanicalEffect ? el("p", {}, text(system.state.mechanicalEffect)) : fragment(),
        el("h3", {}, "Work orders"),
        el("ul", { class: "directive-work" }, ...((system.work_orders || []).filter(order => order.status !== "unknown").map(order =>
          el("li", { class: `is-${order.status}` }, el("strong", {}, text(order.label || "Work order")), order.summary ? el("span", {}, text(order.summary)) : fragment()))))))),
    (cohesion.issues || []).length ? panel("Cohesion priorities", el("div", { class: "directive-issue-list" }, ...cohesion.issues.map(issue =>
      el("article", { class: "directive-issue" }, el("span", {}, `LEVEL ${issue.level}`), el("h3", {}, text(issue.player_text?.title || "Operational issue")),
        issue.player_text?.situation ? el("p", {}, text(issue.player_text.situation)) : fragment())))) : fragment());
}

function peopleView(people, crewOnly) {
  const filtered = (people || []).filter(person => !crewOnly || person.directive);
  return el("section", { class: "directive-view" },
    sectionHead(crewOnly ? "SENIOR STAFF" : "PEOPLE", crewOnly ? "Crew manifest" : "Observed people", `${filtered.length} ${crewOnly ? "officers" : "records"}`),
    el("div", { class: "directive-card-grid" }, ...filtered.map(person => {
      const domain = person.directive || {};
      return el("article", { class: "directive-card directive-person" },
        domain.media?.variants?.card ? el("img", { class: "directive-person__portrait", src: domain.media.variants.card, alt: domain.media.alt || "" }) : fragment(),
        el("span", { class: "directive-card__status" }, text(domain.rank || titleCase(person.identity_status || "observed"))),
        el("h2", { translate: "no" }, text(person.display_name || "Observed person")),
        domain.role ? el("p", { class: "directive-person__role" }, text(domain.role)) : fragment(),
        domain.operational_summary ? el("p", {}, text(domain.operational_summary)) : fragment(),
        domain.department ? el("span", { class: "directive-tag" }, text(domain.department)) : fragment());
    })));
}

function sectionHead(kicker, title, meta) {
  return el("header", { class: "directive-section-head" }, el("p", { class: "directive-kicker" }, kicker), el("h1", {}, title), el("p", { class: "directive-section-meta" }, meta));
}
function statRow(items) { return el("div", { class: "directive-stats" }, ...items.map(([label, value]) => el("div", {}, el("span", {}, label), el("strong", { translate: "no" }, value)))); }
function panel(title, body) { return el("section", { class: "directive-panel" }, el("h2", {}, title), body); }
function list(items) { return el("ul", {}, ...items.map(item => el("li", { translate: "no" }, text(item)))); }
function definitionList(value) {
  return el("dl", { class: "directive-definitions" }, ...Object.entries(value).flatMap(([key, item]) => [
    el("dt", {}, titleCase(key.replace(/^dimension\.[^.]+\./, "").replaceAll("-", " "))), el("dd", { translate: "no" }, text(String(item)))
  ]));
}
function titleCase(value) { return String(value).replace(/\b\w/g, letter => letter.toUpperCase()); }
function fragment() { return document.createDocumentFragment(); }
function text(value) { return document.createTextNode(String(value ?? "")); }

function el(tag, attrs = {}, ...children) {
  const value = document.createElement(tag);
  for (const [key, item] of Object.entries(attrs)) {
    if (item === null || item === undefined || item === false) continue;
    if (key === "class") value.className = item;
    else if (key.startsWith("on") && typeof item === "function") value.addEventListener(key.slice(2), item);
    else if (item === true) value.setAttribute(key, "");
    else value.setAttribute(key, String(item));
  }
  value.append(...children.filter(Boolean).map(child => typeof child === "string" ? document.createTextNode(child) : child));
  return value;
}
