export const DIRECTIVE_ROUTES = Object.freeze([
  Object.freeze({ id: "campaign", label: "Campaign", shelfLabel: "Campaigns & Saves", glyphId: "route-campaign", railCode: "CPN", tone: "campaign" }),
  Object.freeze({ id: "mission", label: "Mission", shelfLabel: "Objectives & Outcomes", glyphId: "route-mission", railCode: "MSN", tone: "mission" }),
  Object.freeze({ id: "people", label: "People", shelfLabel: "Roster & Contacts", glyphId: "route-crew", railCode: "CRW", tone: "people" }),
  Object.freeze({ id: "ship", label: "Ship", shelfLabel: "Operational Status", glyphId: "route-ship", railCode: "SHP", tone: "ship" }),
  Object.freeze({ id: "settings", label: "Settings", shelfLabel: "General", glyphId: "route-settings", railCode: "SYS", tone: "settings" }),
]);

export function getDirectiveRoute(routeId) {
  return DIRECTIVE_ROUTES.find((route) => route.id === routeId) || null;
}
