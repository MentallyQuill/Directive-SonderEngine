import { appendText, createElement, createVectorGlyph, setClassState } from "./primitives.js";
import { DIRECTIVE_ROUTES, getDirectiveRoute } from "./routes.js";

export function createDirectiveShell({
  activeRouteId = "campaign",
  onSelectRoute = null,
  onClose = null,
} = {}) {
  const initialRoute = getDirectiveRoute(activeRouteId) || DIRECTIVE_ROUTES[0];
  const shell = createElement("section", "directive-app directive-runtime-panel directive-runtime-shell directive-shell directive-expanded-shell");
  shell.dataset.directiveShell = "expanded";
  shell.setAttribute("aria-label", "Directive expanded interface");
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");

  const rail = createElement("aside", "directive-lcars-rail");
  rail.setAttribute("aria-label", "LCARS route identifiers");
  DIRECTIVE_ROUTES.forEach((route, index) => {
    const segment = createElement("span", "directive-lcars-rail-segment");
    const number = appendText(createElement("b"), String(index + 1).padStart(2, "0"));
    const code = appendText(createElement("small"), route.railCode);
    segment.append(number, code);
    rail.append(segment);
  });

  const workspace = createElement("main", "directive-workspace");
  const topbar = createElement("header", "directive-topbar");
  const identity = createElement("div", "directive-topbar-identity");
  identity.append(
    appendText(createElement("div", "directive-brand"), "DIRECTIVE"),
    appendText(createElement("div", "directive-route-path"), routePath(initialRoute)),
  );

  const actions = createElement("div", "directive-topbar-actions");
  const close = appendText(createElement("button", "directive-close-action"), "×");
  close.type = "button";
  close.dataset.shellAction = "close";
  close.setAttribute("aria-label", "Close Directive");
  close.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    onClose?.(event);
  });
  actions.append(close);
  topbar.append(identity, actions);

  const heading = createElement("div", "directive-route-heading");
  const cap = createElement("span", "directive-route-cap");
  cap.setAttribute("aria-hidden", "true");
  const routeName = createElement("div", "directive-route-name");
  routeName.append(appendText(createElement("span", "directive-route-name-label"), initialRoute.label));
  heading.append(cap, routeName);

  const body = createElement("section", "directive-runtime-body directive-route-body");
  body.dataset.directiveRuntimeBody = "true";

  const routeBar = createElement("nav", "directive-route-bar");
  routeBar.setAttribute("aria-label", "Directive routes");
  routeBar.setAttribute("role", "tablist");
  const controls = DIRECTIVE_ROUTES.map((route, index) => {
    const control = createRouteControl(route, index);
    const activate = (event) => {
      event?.preventDefault?.();
      setShellRoute(shell, route.id);
      onSelectRoute?.(route.id);
    };
    control.addEventListener("click", activate);
    control.addEventListener("keydown", (event) => {
      const targetIndex = nextRouteIndex(index, event?.key, controls.length);
      if (targetIndex !== null) {
        if (targetIndex === index) return;
        event.preventDefault?.();
        controls[targetIndex].tabIndex = 0;
        controls.forEach((item, itemIndex) => { if (itemIndex !== targetIndex) item.tabIndex = -1; });
        controls[targetIndex].focus?.({ preventScroll: true });
        controls[targetIndex].click?.();
        return;
      }
      if (event?.key === "Enter" || event?.key === " ") activate(event);
    });
    control.addEventListener("focus", () => {
      controls.forEach((item) => { item.tabIndex = item === control ? 0 : -1; });
    });
    routeBar.append(control);
    return control;
  });

  workspace.append(topbar, heading, body, routeBar);
  shell.append(rail, workspace);
  shell.addEventListener("keydown", (event) => {
    if (event?.key === "Tab") {
      containModalFocus(shell, event);
      return;
    }
    if (event?.key === "Escape") {
      event.preventDefault?.();
      onClose?.(event);
    }
  });
  setShellRoute(shell, initialRoute.id);
  return shell;
}

function containModalFocus(shell, event) {
  const focusable = [...shell.querySelectorAll("button, [href], input, select, textarea, summary, [tabindex]")]
    .filter((node) => !node.disabled && !node.hidden && node.tabIndex >= 0);
  if (!focusable.length) {
    event.preventDefault?.();
    shell.tabIndex = -1;
    shell.focus?.({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = shell.ownerDocument?.activeElement;
  if (event.shiftKey && (active === first || !shell.contains(active))) {
    event.preventDefault?.();
    last.focus?.({ preventScroll: true });
  } else if (!event.shiftKey && (active === last || !shell.contains(active))) {
    event.preventDefault?.();
    first.focus?.({ preventScroll: true });
  }
}

export function setShellRoute(shell, routeId) {
  const route = getDirectiveRoute(routeId);
  if (!shell || !route) return false;
  shell.dataset.activeRoute = route.id;
  const controls = [...(shell.querySelectorAll?.("[data-route-id]") || [])];
  for (const control of controls) {
    const selected = control.dataset.routeId === route.id;
    control.setAttribute("aria-selected", selected ? "true" : "false");
    if (selected) control.setAttribute("aria-current", "page");
    else control.removeAttribute("aria-current");
    control.tabIndex = selected ? 0 : -1;
    setClassState(control, "active", selected);
  }
  const path = shell.querySelector?.(".directive-route-path");
  if (path) path.textContent = routePath(route);
  const label = shell.querySelector?.(".directive-route-name-label");
  if (label) label.textContent = route.label;
  const body = shell.querySelector?.(".directive-route-body");
  if (body) body.dataset.routeView = route.id;
  return true;
}

function createRouteControl(route, index) {
  const control = createElement("button", "directive-route-control");
  control.type = "button";
  control.dataset.routeId = route.id;
  control.dataset.routeTone = route.tone;
  control.dataset.routeIndex = String(index + 1).padStart(2, "0");
  control.dataset.glyph = route.glyphId;
  control.setAttribute("role", "tab");
  control.append(
    createVectorGlyph(route.glyphId, "directive-route-control-icon"),
    appendText(createElement("b", "directive-route-control-label"), route.label),
  );
  return control;
}

function routePath(route) {
  return `${route.label} / ${route.shelfLabel || route.label}`;
}

function nextRouteIndex(index, key, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
