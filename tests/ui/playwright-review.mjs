import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { DIRECTIVE_CAMPAIGN_LIBRARY } from "../../ui/campaign-library.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const liveRoot = process.env.SONDER_ENGINE_ROOT;
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", liveRoot ? "playwright-ui-alignment-live" : "playwright-ui-alignment");
const DIRECTIVE_SOURCE_ROOT = path.resolve(process.env.DIRECTIVE_SOURCE_ROOT || path.join(ROOT, "..", "..", "..", "Directive"));
const REFERENCE_ROOT = path.join(DIRECTIVE_SOURCE_ROOT, "artifacts", "expanded-interface-conformance");
const HARNESS_PATH = "/tests/ui/fixtures/directive-harness.html";
const ROUTES = ["campaign", "mission", "people", "ship", "settings"];
const ROUTE_LABELS = ["Campaign", "Mission", "People", "Ship", "Settings"];
const VIEWPORTS = [
  { label: "desktop-wide", mode: "desktop", width: 1440, height: 900 },
  { label: "desktop-compact", mode: "desktop", width: 1024, height: 768 },
  { label: "phone-wide", mode: "mobile", width: 390, height: 844 },
  { label: "phone", mode: "mobile", width: 360, height: 800 },
  { label: "phone-short", mode: "mobile", width: 360, height: 500 },
];
const BREAKPOINTS = [360.5, 410, 420, 480, 640, 680, 720, 760, 820, 899.98, 1080, 1180];
const PROVEN_VISUAL_LIMITS = Object.freeze({
  "campaign:1440x900": { mean: 0.0046, changed: 0.0131 },
  "campaign:1024x768": { mean: 0.0067, changed: 0.0291 },
  "campaign:390x844": { mean: 0.0032, changed: 0.0107 },
  "campaign:360x800": { mean: 0.003, changed: 0.0059 },
  "campaign:360x500": { mean: 0.0039, changed: 0.0088 },
  "campaign-browser:1440x900": { mean: 0.0071, changed: 0.0335 },
  "campaign-browser:390x844": { mean: 0.0069, changed: 0.0123 },
  "mission:1440x900": { mean: 0.0052, changed: 0.0287 },
  "mission:1024x768": { mean: 0.006, changed: 0.0338 },
  "mission:390x844": { mean: 0.0013, changed: 0.0018 },
  "mission:360x800": { mean: 0.0014, changed: 0.0019 },
  "mission:360x500": { mean: 0.0016, changed: 0.0022 },
  "people:1440x900": { mean: 0.0026, changed: 0.0093 },
  "people:1024x768": { mean: 0.0029, changed: 0.0109 },
  "people:390x844": { mean: 0.0025, changed: 0.0013 },
  "people:360x800": { mean: 0.0025, changed: 0.0013 },
  "people:360x500": { mean: 0.0024, changed: 0.0013 },
  "ship:1440x900": { mean: 0.0027, changed: 0.0105 },
  "ship:1024x768": { mean: 0.0024, changed: 0.0083 },
  "ship:390x844": { mean: 0.0032, changed: 0.0079 },
  "ship:360x800": { mean: 0.0031, changed: 0.0076 },
  "ship:360x500": { mean: 0.0024, changed: 0.0043 },
  "settings:1440x900": { mean: 0.0272, changed: 0.0327 },
  "settings:1024x768": { mean: 0.0227, changed: 0.0263 },
  "settings:390x844": { mean: 0.0338, changed: 0.0428 },
  "settings:360x800": { mean: 0.0356, changed: 0.048 },
  "settings:360x500": { mean: 0.0178, changed: 0.0232 },
});

await rm(ARTIFACT_ROOT, { recursive: true, force: true });
await mkdir(ARTIFACT_ROOT, { recursive: true });

const runtime = liveRoot ? await startLiveSonder(path.resolve(liveRoot)) : await startStaticServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORTS[0] });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const failures = { console: [], page: [], request: [], response: [] };
page.on("console", (message) => {
  if (message.type() === "error") failures.console.push(message.text());
});
page.on("pageerror", (error) => failures.page.push(String(error?.stack || error)));
page.on("requestfailed", (request) => failures.request.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`));
page.on("response", (response) => {
  if (response.status() >= 400) failures.response.push(`${response.status()} ${response.request().method()} ${response.url()}`);
});

const evidence = { mode: runtime.mode, baseUrl: runtime.baseUrl, referenceRoot: REFERENCE_ROOT, captures: [], metrics: [], typography: [], breakpoints: [], comparisons: [] };
const visualFailures = [];
try {
  if (runtime.mode === "live-sonder") await prepareLiveHost(context, runtime.baseUrl);
  await openOnboarding(page, runtime);
  await assertFocusEntry(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await assertCommonContract(page, "onboarding", viewport, "campaign");
    await assertSourceStructure(page, "onboarding", viewport);
    await assertExactRouteContract(page, "onboarding");
    await captureTypography(page, "onboarding", viewport);
    await capture(page, "onboarding", viewport);
  }

  await page.keyboard.press("Escape");
  await page.locator(".directive-expanded-shell").waitFor({ state: "detached" });
  await assertFocusRestored(page);

  if (runtime.mode === "live-sonder") await provisionLiveCampaign(page, context, runtime.baseUrl);
  else await page.goto(`${runtime.baseUrl}${HARNESS_PATH}`);
  await openDirective(page);
  await assertRovingNavigation(page);
  await assertNormalMotionHeroOrbit(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const route of ROUTES) {
      await page.locator(`[data-route-id="${route}"]`).click();
      await page.locator(`.directive-expanded-shell[data-active-route="${route}"]`).waitFor();
      await assertCommonContract(page, route, viewport);
      await assertSourceStructure(page, route, viewport);
      await assertExactRouteContract(page, route);
      await captureTypography(page, route, viewport);
      await assertSuccessfulMedia(page);
      if (route === "ship" && viewport.width <= 640) await assertMobileShipDisclosure(page);
      await capture(page, route, viewport);
    }
  }

  await assertCampaignLibrary(page);
  await assertBreakpointBoundaries(page);
  await assertReducedMotion(page);
  await page.keyboard.press("Escape");
  await page.locator(".directive-expanded-shell").waitFor({ state: "detached" });
  await assertFocusRestored(page);
  await assertNoRuntimeFailures(failures);
  assert.equal(evidence.captures.length, 32, "review must capture onboarding and five routes at five viewports plus the authoritative campaign browser states");
  await BunlessWriteJson(path.join(ARTIFACT_ROOT, "results.json"), evidence);
  assert.deepEqual(visualFailures, [], `full-resolution Directive comparisons failed:\n${visualFailures.join("\n")}`);
  console.log(`PASS: ${runtime.mode}; ${evidence.captures.length} screenshots; no browser/runtime failures`);
} finally {
  await context.close();
  await browser.close();
  await runtime.close();
}

async function openOnboarding(targetPage, activeRuntime) {
  const suffix = activeRuntime.mode === "live-sonder" ? "/" : `${HARNESS_PATH}?onboarding=1`;
  await targetPage.goto(`${activeRuntime.baseUrl}${suffix}`, { waitUntil: "networkidle" });
  await openDirective(targetPage);
}

async function openDirective(targetPage) {
  const launcher = targetPage.locator('[data-ext-button="directive-launch"]');
  await launcher.waitFor();
  await launcher.click();
  await targetPage.locator(".directive-expanded-shell").waitFor();
  await targetPage.waitForFunction(() => document.querySelectorAll("[data-route-id]").length === 5);
}

async function assertFocusEntry(targetPage) {
  await targetPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(
    await targetPage.evaluate(() => document.activeElement?.matches(".directive-close-action")),
    true,
    "opening Directive must focus the actual close control",
  );
  await targetPage.keyboard.press("Shift+Tab");
  assert.equal(await targetPage.evaluate(() => document.activeElement?.dataset.routeId), "campaign",
    "Shift+Tab from the first modal control must wrap to the last modal control");
  await targetPage.keyboard.press("Tab");
  assert.equal(await targetPage.evaluate(() => document.activeElement?.matches(".directive-close-action")), true,
    "Tab from the last modal control must wrap to the first modal control");
  const focusTarget = targetPage.locator('[data-route-id="campaign"]');
  await focusTarget.focus();
  const focusStyle = await focusTarget.evaluate((node) => {
    const style = getComputedStyle(node);
    return { visible: node.matches(":focus-visible"), outlineWidth: parseFloat(style.outlineWidth) || 0 };
  });
  assert.equal(focusStyle.visible, true, "keyboard-focused route controls must match :focus-visible");
  assert.ok(focusStyle.outlineWidth >= 2, `focus ring must be visible, got ${focusStyle.outlineWidth}px`);
}

async function assertFocusRestored(targetPage) {
  await targetPage.waitForFunction(
    () => document.activeElement?.matches('[data-ext-button="directive-launch"]'),
  );
  assert.equal(
    await targetPage.evaluate(() => document.activeElement?.matches('[data-ext-button="directive-launch"]')),
    true,
    "closing Directive must restore focus to the current launcher",
  );
}

async function assertRovingNavigation(targetPage) {
  const campaign = targetPage.locator('[data-route-id="campaign"]');
  await campaign.click();
  await campaign.focus();
  await targetPage.keyboard.press("ArrowRight");
  assert.equal(await targetPage.locator(".directive-expanded-shell").getAttribute("data-active-route"), "mission");
  assert.equal(await targetPage.evaluate(() => document.activeElement?.dataset.routeId), "mission");
  await targetPage.locator('[data-route-id="campaign"]').click();
}

async function assertCampaignLibrary(targetPage) {
  await targetPage.setViewportSize(VIEWPORTS[0]);
  await targetPage.locator('[data-route-id="campaign"]').click();
  await targetPage.locator(".campaign-dashboard").waitFor();
  await targetPage.locator(".campaign-browser-command").click();
  await targetPage.locator('.campaign-browser[data-campaign-view="browser"]').waitFor();
  const futureKey = `package:${DIRECTIVE_CAMPAIGN_LIBRARY[1].packageId}`;
  await targetPage.locator(`[data-campaign-record-key="${futureKey}"]`).click();
  await targetPage.locator(`[data-campaign-record-key="${futureKey}"][aria-pressed="true"]`).waitFor();

  const library = await targetPage.locator(".campaign-browser").evaluate((browser) => ({
    titles: [...browser.querySelectorAll('.campaign-desktop-master [data-campaign-record-key^="package:"] .campaign-row-copy strong')].map((node) => node.textContent.trim()),
    descriptions: [...browser.querySelectorAll('.campaign-desktop-master [data-campaign-record-key^="package:"] .campaign-row-copy > span')].map((node) => node.textContent.trim()),
    grayFilters: [...browser.querySelectorAll('[data-campaign-availability="coming-later"] .directive-media-frame')].map((node) => getComputedStyle(node).filter),
    selectedDescription: browser.querySelector(".campaign-desktop-detail [data-campaign-description]")?.textContent.trim(),
    comingLater: browser.querySelector(".campaign-desktop-detail .campaign-status")?.textContent.trim(),
    newCampaignDisabled: browser.querySelector(".campaign-desktop-detail .campaign-command-primary")?.disabled,
  }));
  assert.deepEqual(library.titles, DIRECTIVE_CAMPAIGN_LIBRARY.map(({ title }) => title), "campaign library titles and order must be exact");
  assert.deepEqual(library.descriptions, DIRECTIVE_CAMPAIGN_LIBRARY.map(({ description }) => description), "campaign library teaser descriptions must be exact");
  assert.ok(library.grayFilters.length >= 5 && library.grayFilters.every((value) => /grayscale\(1\)/.test(value)),
    `future campaign teaser art must be visibly greyed: ${JSON.stringify(library.grayFilters)}`);
  assert.equal(library.selectedDescription, DIRECTIVE_CAMPAIGN_LIBRARY[1].description, "selected future campaign must show its exact description");
  assert.equal(library.comingLater, "Coming later", "future campaign detail must state Coming later");
  assert.equal(library.newCampaignDisabled, true, "future campaign creation must remain natively disabled");

  for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
    await targetPage.setViewportSize(viewport);
    if (viewport.mode === "mobile") {
      const trigger = targetPage.locator(`[data-mobile-record-key="${futureKey}"]`);
      assert.equal(await trigger.getAttribute("aria-expanded"), "true", "selected future campaign must remain open in mobile disclosure mode");
      assert.equal(await targetPage.locator(`#${await trigger.getAttribute("aria-controls")}`).isVisible(), true,
        "selected future campaign description must be visible on mobile");
    }
    await capture(targetPage, "campaign-browser", viewport, {
      referenceStem: "campaign-browser-static-covers",
      thresholdRoute: "campaign-browser",
      scrollRecordSelector: viewport.mode === "mobile" ? `[data-mobile-record-container-key="${futureKey}"]` : null,
    });
  }
  await targetPage.locator(".campaign-browser-back-command").click();
  await targetPage.locator(".campaign-dashboard").waitFor();
}

async function assertCommonContract(targetPage, surface, viewport, expectedRoute = surface) {
  const metrics = await targetPage.locator(".directive-expanded-shell").evaluate((shell, expectedRoute) => {
    const controls = [...shell.querySelectorAll("[data-route-id]")];
    const routeBar = shell.querySelector(".directive-route-bar");
    const rail = shell.querySelector(".directive-lcars-rail");
    const body = shell.querySelector(".directive-route-body");
    const shellStyle = getComputedStyle(shell);
    const visibleInteractive = [...shell.querySelectorAll("button, input, select, textarea, summary")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((node) => ({
        label: node.getAttribute("aria-label") || node.textContent.trim().replace(/\s+/g, " ").slice(0, 80) || node.tagName,
        height: node.getBoundingClientRect().height,
        minHeight: getComputedStyle(node).minHeight,
        boxSizing: getComputedStyle(node).boxSizing,
      }));
    const scrollOwners = [shell, body, ...shell.querySelectorAll('[data-directive-scroll-owner="true"]')]
      .filter(Boolean)
      .map((node) => ({ className: node.className, overflow: node.scrollWidth - node.clientWidth }));
    return {
      expectedRoute,
      activeRoute: shell.dataset.activeRoute,
      labels: controls.map((node) => node.textContent.trim()),
      selected: controls.filter((node) => node.getAttribute("aria-selected") === "true").map((node) => node.dataset.routeId),
      canvas: shellStyle.getPropertyValue("--directive-expanded-bg").trim().toLowerCase(),
      commandOrange: shellStyle.getPropertyValue("--directive-orange").trim().toLowerCase(),
      rail: rail ? { display: getComputedStyle(rail).display, rect: rail.getBoundingClientRect().toJSON(), segments: rail.children.length } : null,
      routeBar: routeBar ? { display: getComputedStyle(routeBar).display, rect: routeBar.getBoundingClientRect().toJSON() } : null,
      shellRect: shell.getBoundingClientRect().toJSON(),
      controls: visibleInteractive,
      scrollOwners,
    };
  }, expectedRoute);

  assert.deepEqual(metrics.labels, ROUTE_LABELS, "route order must remain exact");
  assert.equal(metrics.activeRoute, expectedRoute, "shell active route must match rendered route");
  assert.deepEqual(metrics.selected, [expectedRoute], "exactly one route control must be selected");
  assert.equal(metrics.canvas, "#05070b", "Directive canvas token must be #05070b");
  assert.equal(metrics.commandOrange, "#e56f24", "Directive command-orange token must remain exact");
  assert.equal(metrics.rail?.segments, 5, "LCARS rail must contain five segments");
  assert.ok(metrics.controls.length > 0, "the rendered surface must expose controls");
  for (const owner of metrics.scrollOwners) {
    assert.ok(owner.overflow <= 1, `${owner.className} has ${owner.overflow}px Directive-owned horizontal overflow`);
  }
  if (viewport.width > 640) {
    assert.equal(metrics.rail?.display, "grid", "desktop must show the segmented LCARS rail");
    assert.ok(metrics.rail.rect.width >= 40, `desktop rail must retain its 40px measure, got ${metrics.rail.rect.width}`);
  } else {
    const shelfGap = metrics.shellRect.bottom - metrics.routeBar.rect.bottom;
    assert.ok(shelfGap >= -1 && shelfGap <= 12, `mobile route shelf must sit at the bottom edge, gap ${shelfGap}px`);
    assert.ok(metrics.routeBar.rect.width > viewport.width * 0.75, "mobile route shelf must span the workspace");
  }
  evidence.metrics.push({ viewport: `${viewport.width}x${viewport.height}`, surface, ...metrics });
}

async function assertMobileShipDisclosure(targetPage) {
  const first = targetPage.locator(".ship-task-button").first();
  const panelId = (await first.getAttribute("aria-controls"))?.split(/\s+/).find((value) => value.startsWith("ship-task-mobile-panel-"));
  assert.ok(panelId, "mobile Ship assignment must control a route-local disclosure panel");
  const panel = targetPage.locator(`#${panelId}`);
  assert.equal(await panel.isVisible(), false, "mobile Ship disclosure starts collapsed");
  assert.equal(await first.getAttribute("aria-expanded"), "false", "collapsed mobile Ship assignment must expose a matching accessibility state");
  await first.click();
  assert.equal(await first.getAttribute("aria-expanded"), "true", "mobile Ship assignment must expose its disclosure state");
  assert.equal(await panel.isVisible(), true, "mobile Ship assignment detail must be visible after activation");
  assert.ok((await panel.textContent())?.trim(), "mobile Ship disclosure must contain the selected assignment detail");
  await first.click();
  assert.equal(await panel.isVisible(), false, "mobile Ship disclosure must collapse on a second activation");
  assert.equal(await first.getAttribute("aria-expanded"), "false", "collapsed mobile Ship assignment must restore aria-expanded=false");
}

async function assertSourceStructure(targetPage, surface, viewport) {
  const expected = {
    onboarding: [".directive-expanded-campaign", '.campaign-browser[data-campaign-view="browser"]', ".campaign-journal"],
    campaign: [".directive-expanded-campaign", ".campaign-dashboard", ".campaign-dashboard-hero"],
    mission: [".directive-expanded-mission", ".mission-index-panel", ".mission-detail", ".mission-objective-list"],
    people: [".directive-expanded-people", ".people-journal", ".people-roster", ".people-detail"],
    ship: [".directive-expanded-ship", ".ship-cohesion-workspace", ".ship-cohesion-orbit", ".ship-task-nav"],
    settings: [".directive-expanded-settings", ".settings-content", ".settings-section"],
  }[surface];
  assert.ok(expected, `unknown source structure surface: ${surface}`);
  try {
    await targetPage.locator(expected[0]).waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(`${surface} source structure did not render: ${JSON.stringify(failures)}`, { cause: error });
  }

  const structure = await targetPage.locator(".directive-expanded-shell").evaluate((shell, selectors) => {
    const overlay = shell.closest(".directive-runtime-overlay");
    const host = shell.parentElement;
    const backdrop = overlay?.querySelector(":scope > .directive-runtime-backdrop");
    const rail = shell.querySelector(".directive-lcars-rail");
    const shellStyle = getComputedStyle(shell);
    const railStyle = getComputedStyle(rail);
    const owners = [...shell.querySelectorAll('[data-directive-scroll-owner="true"]')];
    return {
      overlayOpen: Boolean(overlay?.classList.contains("directive-runtime-overlay-open")),
      panelHost: Boolean(host?.classList.contains("directive-runtime-panel-host")),
      backdrop: Boolean(backdrop),
      backdropPosition: backdrop ? getComputedStyle(backdrop).position : null,
      shellRect: shell.getBoundingClientRect().toJSON(),
      shellPosition: shellStyle.position,
      shellRadius: parseFloat(shellStyle.borderTopRightRadius) || 0,
      railWidth: rail.getBoundingClientRect().width,
      railDisplay: railStyle.display,
      owners: owners.map((owner) => ({
        className: owner.className,
        overflowY: getComputedStyle(owner).overflowY,
      })),
      missing: selectors.filter((selector) => !shell.querySelector(selector)),
    };
  }, expected);

  assert.equal(structure.overlayOpen, true, "Directive must render inside the open source overlay");
  assert.equal(structure.panelHost, true, "Directive shell must be a direct child of the source panel host");
  assert.equal(structure.backdrop, true, "Directive source overlay must retain its backdrop");
  assert.equal(structure.backdropPosition, "absolute", "Directive backdrop must cover the host viewport");
  assert.deepEqual(structure.missing, [], `${surface} must use the authoritative source hierarchy`);
  assert.ok(structure.owners.length > 0, `${surface} must own an internal scroll region`);
  assert.ok(
    structure.owners.some((owner) => ["auto", "scroll"].includes(owner.overflowY)),
    `${surface} must scroll inside the framed console`,
  );
  if (surface === "settings") {
    const settingsPatterns = await targetPage.locator(".settings-section").evaluateAll((sections) => sections.map((section) => {
      const value = (node) => {
        if (!node) return null;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          color: style.color,
          background: style.backgroundColor,
          family: style.fontFamily,
          size: style.fontSize,
          weight: style.fontWeight,
          lineHeight: style.lineHeight,
          textTransform: style.textTransform,
          marginTop: style.marginTop,
          padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        };
      };
      const style = getComputedStyle(section);
      const rect = section.getBoundingClientRect();
      const facts = section.querySelector(".settings-facts");
      const factStyle = facts ? getComputedStyle(facts) : null;
      return {
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        borderWidth: style.borderLeftWidth,
        borderColor: style.borderLeftColor,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        eyebrow: value(section.querySelector(".settings-section-head > span")),
        heading: value(section.querySelector(".settings-section-head > h2")),
        summary: value(section.querySelector(".settings-section-head > p")),
        bodyCopy: value(section.querySelector(":scope > p")),
        facts: facts ? {
          display: factStyle.display,
          gap: factStyle.gap,
          marginTop: factStyle.marginTop,
          rect: value(facts).rect,
          items: [...facts.children].map((item) => ({
            box: value(item),
            label: value(item.querySelector("span")),
            value: value(item.querySelector("strong")),
          })),
        } : null,
        controls: section.querySelectorAll("button, input, select, textarea").length,
        overflow: [...section.querySelectorAll("*")].filter((node) => {
          const child = node.getBoundingClientRect();
          return child.left < rect.left - .5 || child.right > rect.right + .5;
        }).map((node) => node.className || node.tagName),
      };
    }));
    assert.equal(settingsPatterns.length, 2, "Settings must preserve the two-card Directive presentation shell");
    const expectedPadding = viewport.width <= 420 ? ["12px", "12px", "12px", "12px"] : ["15px", "17px", "15px", "17px"];
    for (const settingsPattern of settingsPatterns) {
      assert.equal(settingsPattern.borderWidth, "6px", "Settings cards must retain Directive's exact accent rail width");
      assert.equal(settingsPattern.borderColor, "rgb(239, 127, 114)", "Settings cards must use Directive settings coral");
      assert.equal(settingsPattern.borderRadius, "6px", "Settings cards must retain Directive's exact corner radius");
      assert.equal(settingsPattern.background, "rgb(13, 16, 24)", "Settings cards must use Directive panel color");
      assert.deepEqual(settingsPattern.padding, expectedPadding, "Settings cards must retain Directive's responsive inner spacing");
      assert.ok(settingsPattern.rect.width > 0 && settingsPattern.rect.height > 0, "Settings cards must occupy measurable layout boxes");
      assert.deepEqual(settingsPattern.overflow, [], "Settings option content must remain inside its Directive card");
      assert.equal(settingsPattern.controls, 0, "Sonder authority records must not silently introduce host-owned controls");
      assert.equal(settingsPattern.eyebrow.color, "rgb(239, 127, 114)");
      assert.match(settingsPattern.eyebrow.family, /Roboto Condensed/);
      assert.equal(settingsPattern.eyebrow.size, "9px");
      assert.equal(settingsPattern.eyebrow.weight, "800");
      assert.equal(settingsPattern.eyebrow.textTransform, "uppercase");
      assert.equal(settingsPattern.heading.color, "rgb(248, 239, 224)");
      assert.match(settingsPattern.heading.family, /Roboto Condensed/);
      assert.equal(settingsPattern.heading.size, "22px");
      assert.equal(settingsPattern.heading.weight, "800");
      assert.equal(settingsPattern.heading.marginTop, "3px");
      assert.equal(settingsPattern.summary.color, "rgba(248, 239, 224, 0.68)");
      assert.equal(settingsPattern.summary.size, "11px");
      assert.equal(settingsPattern.summary.lineHeight, "15.4px");
      assert.equal(settingsPattern.summary.marginTop, "6px");
    }
    assert.ok(Math.abs(settingsPatterns[1].rect.top - settingsPatterns[0].rect.bottom - 10) <= .5,
      "Settings cards must retain the exact 10px Directive stack gap");
    assert.ok(Math.abs(settingsPatterns[0].rect.left - settingsPatterns[1].rect.left) <= .5
      && Math.abs(settingsPatterns[0].rect.right - settingsPatterns[1].rect.right) <= .5,
    "Settings cards must retain one exact full-width column");
    const facts = settingsPatterns[0].facts;
    assert.ok(facts, "Campaign authority must render its Sonder-specific options in the Directive facts pattern");
    assert.equal(facts.display, "grid");
    assert.equal(facts.gap, "7px");
    assert.equal(facts.marginTop, "11px");
    assert.equal(facts.items.length, 3);
    assert.ok(Math.max(...facts.items.map((item) => item.box.rect.width)) - Math.min(...facts.items.map((item) => item.box.rect.width)) <= 1,
      "Settings fact options must preserve equal Directive columns");
    for (const item of facts.items) {
      assert.deepEqual(item.box.padding, ["8px", "8px", "8px", "8px"]);
      assert.equal(item.box.background, "rgb(20, 18, 28)");
      assert.equal(item.label.color, "rgba(248, 239, 224, 0.68)");
      assert.equal(item.label.size, "8px");
      assert.equal(item.label.textTransform, "uppercase");
      assert.equal(item.value.color, "rgb(248, 239, 224)");
      assert.equal(item.value.size, "11px");
      assert.equal(item.value.marginTop, "3px");
    }
    assert.equal(settingsPatterns[1].bodyCopy.color, "rgba(248, 239, 224, 0.68)");
    assert.equal(settingsPatterns[1].bodyCopy.size, "12px");
    assert.equal(settingsPatterns[1].bodyCopy.lineHeight, "17.4px");
    assert.equal(settingsPatterns[1].bodyCopy.marginTop, "11px");
  }

  if (viewport.width > 640) {
    assert.equal(structure.shellPosition, "absolute", "desktop source console must use absolute overlay framing");
    assert.ok(structure.shellRect.width >= 900 && structure.shellRect.width <= 942,
      `desktop console must preserve the source 940px measure, got ${structure.shellRect.width}`);
    assert.ok(structure.shellRect.top >= 15 && structure.shellRect.bottom <= viewport.height - 15,
      `desktop console must float with source insets, got y=${structure.shellRect.top}..${structure.shellRect.bottom}`);
    assert.ok(structure.shellRadius >= 13, `desktop console must keep the rounded source frame, got ${structure.shellRadius}px`);
    assert.ok(Math.abs(structure.railWidth - 40) <= 1, `desktop rail must be 40px, got ${structure.railWidth}`);
  } else {
    assert.equal(structure.railDisplay, "grid", "mobile must retain the five-segment LCARS rail");
    assert.ok(Math.abs(structure.railWidth - 24) <= 1, `mobile rail must be 24px, got ${structure.railWidth}`);
    assert.ok(Math.abs(structure.shellRect.width - viewport.width) <= 1,
      `mobile console must match the viewport width, got ${structure.shellRect.width}`);
    assert.ok(Math.abs(structure.shellRect.height - viewport.height) <= 1,
      `mobile console must match the viewport height, got ${structure.shellRect.height}`);
  }

  if (surface === "campaign") {
    const campaignGeometry = await targetPage.locator(".campaign-dashboard").evaluate((dashboard) => {
      const heroCopy = dashboard.querySelector(".campaign-hero-copy");
      const actions = dashboard.querySelector(".campaign-dashboard-actions");
      const routeBar = dashboard.closest(".directive-expanded-shell")?.querySelector(".directive-route-bar");
      const rect = (node) => node?.getBoundingClientRect().toJSON() || null;
      return {
        dashboard: rect(dashboard),
        heroCopy: rect(heroCopy),
        actions: rect(actions),
        routeBar: rect(routeBar),
      };
    });
    assert.ok(campaignGeometry.heroCopy && campaignGeometry.actions && campaignGeometry.routeBar,
      "Campaign source dashboard must include identity, command strip, and route shelf");
    assert.ok(campaignGeometry.heroCopy.top >= campaignGeometry.dashboard.top
      && campaignGeometry.heroCopy.bottom <= campaignGeometry.actions.top + 1,
    `Campaign identity must remain over the hero above commands, got ${JSON.stringify(campaignGeometry)}`);
    assert.ok(campaignGeometry.actions.bottom <= campaignGeometry.routeBar.top + 1,
      `Campaign commands must remain visible above the route shelf, got ${JSON.stringify(campaignGeometry)}`);
  }
}

async function assertExactRouteContract(targetPage, surface) {
  const contract = await targetPage.locator(".directive-expanded-shell").evaluate((shell, route) => {
    const text = (selector) => shell.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ") || null;
    const texts = (selector) => [...shell.querySelectorAll(selector)].map((node) => node.textContent.trim().replace(/\s+/g, " "));
    const actions = (selector) => [...shell.querySelectorAll(selector)].map((node) => ({
      action: node.dataset.campaignAction || null,
      label: node.getAttribute("aria-label") || node.textContent.trim().replace(/\s+/g, " "),
      disabled: Boolean(node.disabled),
    }));
    return {
      route,
      brand: text(".directive-brand"),
      campaignTitles: texts('.campaign-desktop-master [data-campaign-record-key^="package:"] .campaign-row-copy strong'),
      campaignHeading: text(".campaign-dashboard-heading h2"),
      campaignTitle: text(".campaign-hero-copy h2"),
      campaignActions: actions(".campaign-dashboard [data-campaign-action]"),
      missionTitle: text(".mission-desktop-detail .mission-hero h2"),
      missionGroups: texts(".mission-desktop-detail .mission-section-heading h3"),
      peopleToolbar: text(".people-desktop-journal .people-collection-toolbar strong"),
      peopleCategory: text('.people-desktop-journal [data-category-id="ships-company"] .collection-category-copy strong'),
      peopleNames: texts('.people-desktop-journal [data-category-id="ships-company"] .people-row-copy strong').slice(0, 3),
      shipName: text(".ship-cohesion-identity h2"),
      shipCohesion: text(".ship-cohesion-score strong"),
      shipTasks: texts(".ship-task-button strong").slice(0, 2),
      settingsHeadings: texts(".settings-content > .settings-section h2"),
      settingsSections: shell.querySelectorAll(".settings-content > .settings-section").length,
    };
  }, surface);

  assert.equal(contract.brand, "DIRECTIVE", `${surface} must preserve the exact product wordmark`);
  if (surface === "onboarding") {
    assert.deepEqual(contract.campaignTitles, DIRECTIVE_CAMPAIGN_LIBRARY.map(({ title }) => title),
      "onboarding must render every authored campaign package in exact order");
  } else if (surface === "campaign") {
    assert.equal(contract.campaignHeading, "Current Campaign");
    assert.equal(contract.campaignTitle, "Ashes of Peace");
    assert.deepEqual(contract.campaignActions.map(({ action, label }) => [action, label]), [
      ["campaigns", "Campaigns"], ["continue", "Continue"], ["save", "Save Game"],
      ["load", "Load Game"], ["delete", "Delete campaign"],
    ]);
  } else if (surface === "mission") {
    assert.equal(contract.missionTitle, "Prelude: A Ship Underway");
    assert.equal(contract.missionGroups[0], "Primary objectives");
    assert.deepEqual(contract.missionGroups.filter((label) => label === "Optional objectives"),
      contract.missionGroups.includes("Optional objectives") ? ["Optional objectives"] : []);
  } else if (surface === "people") {
    assert.equal(contract.peopleToolbar, "Personnel records");
    assert.equal(contract.peopleCategory, "Ship's Company");
    assert.deepEqual(contract.peopleNames, [
      runtime.mode === "live-sonder" ? "Avery Quill" : "Sam Vickers",
      "Mara Whitaker", "Kieran Vale",
    ]);
  } else if (surface === "ship") {
    assert.equal(contract.shipName, "U.S.S. Breckenridge");
    assert.equal(contract.shipCohesion, runtime.mode === "live-sonder" ? "Cohesion 75" : "Cohesion 35");
    assert.deepEqual(contract.shipTasks, ["Sensor Calibration", "Systems Integration"]);
  } else if (surface === "settings") {
    assert.equal(contract.settingsSections, 2);
    assert.deepEqual(contract.settingsHeadings, ["Directive campaign authority", "Sonder configuration"]);
  }
}

async function captureTypography(targetPage, surface, viewport) {
  await targetPage.evaluate(() => document.fonts.ready);
  const records = await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
    const selectors = [".directive-brand", ".directive-route-name-label", ".directive-route-body h1, .directive-route-body h2, .directive-route-body h3"];
    return selectors.map((selector) => {
      const node = shell.querySelector(selector);
      if (!node) return { selector, missing: true };
      const style = getComputedStyle(node);
      return {
        selector,
        family: style.fontFamily,
        size: style.fontSize,
        weight: style.fontWeight,
        style: style.fontStyle,
        transform: style.textTransform,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
      };
    });
  });
  assert.equal(records.some((record) => record.missing), false, `${surface} must expose representative Directive typography nodes`);
  assert.match(records[0].family, /Roboto Condensed/, "Directive brand must use the official condensed display stack");
  assert.ok(records.every((record) => /Bahnschrift|Roboto Condensed|Arial Narrow/.test(record.family)),
    `${surface} must retain Directive's authored condensed font stacks`);

  const platformFonts = await platformFontsFor(".directive-brand");
  assert.ok(platformFonts.length > 0, "Chromium must report a platform font for the Directive brand");
  assert.ok(platformFonts.some((font) => /Bahnschrift|Roboto(?:-|\s).*Condensed|Arial(?:-|\s).*Narrow/i.test(`${font.familyName || ""} ${font.postScriptName || ""}`)),
    `Directive brand resolved to an unexpected platform font: ${JSON.stringify(platformFonts)}`);
  evidence.typography.push({ viewport: `${viewport.width}x${viewport.height}`, surface, records, platformFonts });
}

async function platformFontsFor(selector) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  assert.ok(nodeId, `cannot inspect platform font for ${selector}`);
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map(({ familyName, postScriptName, glyphCount, isCustomFont }) => ({ familyName, postScriptName, glyphCount, isCustomFont }));
}

async function assertBreakpointBoundaries(targetPage) {
  const widths = [...new Set(BREAKPOINTS.flatMap((value) => [Math.floor(value - 0.01), Math.ceil(value + 0.01)]))]
    .sort((left, right) => left - right);
  for (const width of widths) {
    const height = width <= 640 ? 844 : 900;
    await targetPage.setViewportSize({ width, height });
    for (const route of ROUTES) {
      await targetPage.locator(`[data-route-id="${route}"]`).click();
      const boundary = await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
        const body = shell.querySelector(".directive-route-body");
        const shelf = shell.querySelector(".directive-route-bar");
        const shellRect = shell.getBoundingClientRect();
        const bodyRect = body?.getBoundingClientRect();
        const shelfRect = shelf?.getBoundingClientRect();
        return {
          route: shell.dataset.activeRoute,
          shell: shellRect.toJSON(),
          body: bodyRect?.toJSON() || null,
          shelf: shelfRect?.toJSON() || null,
          shellOverflowX: shell.scrollWidth - shell.clientWidth,
          bodyOverflowX: body ? body.scrollWidth - body.clientWidth : 0,
          documentOverflowX: document.documentElement.scrollWidth - innerWidth,
          documentOverflowElements: [...document.querySelectorAll("body *")]
            .map((node) => ({ node, rect: node.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.right > innerWidth + 1)
            .sort((left, right) => right.rect.right - left.rect.right)
            .slice(0, 12)
            .map(({ node, rect }) => ({
              tag: node.tagName,
              id: node.id,
              className: typeof node.className === "string" ? node.className : "",
              directiveOwned: shell.contains(node),
              clippedByDirectiveAncestor: (() => {
                if (!shell.contains(node)) return false;
                for (let owner = node.parentElement; owner && shell.contains(owner); owner = owner.parentElement) {
                  const style = getComputedStyle(owner);
                  if ([style.overflowX, style.overflowY, style.overflow].some((value) => ["hidden", "clip", "auto", "scroll"].includes(value))) return true;
                }
                return false;
              })(),
              rect: rect.toJSON(),
            })),
        };
      });
      assert.equal(boundary.route, route, `${route} must remain active at ${width}px`);
      assert.ok(boundary.shell.left >= -1 && boundary.shell.right <= width + 1,
        `${route} shell must stay inside the ${width}px viewport`);
      assert.ok(boundary.body && boundary.body.width > 0 && boundary.body.height > 0,
        `${route} body must remain visible at ${width}px`);
      assert.ok(boundary.shelf && boundary.shelf.left >= boundary.shell.left - 1 && boundary.shelf.right <= boundary.shell.right + 1,
        `${route} shelf must remain inside its shell at ${width}px`);
      assert.ok(boundary.shellOverflowX <= 1 && boundary.bodyOverflowX <= 1,
        `${route} Directive-owned shell and body must not overflow horizontally at ${width}px: ${JSON.stringify(boundary)}`);
      const unclippedDirectiveOverflow = boundary.documentOverflowElements
        .filter((item) => item.directiveOwned && !item.clippedByDirectiveAncestor);
      assert.deepEqual(unclippedDirectiveOverflow, [],
        `${route} has visible Directive-owned page overflow at ${width}px: ${JSON.stringify(unclippedDirectiveOverflow)}`);
      if (runtime.mode === "deterministic-harness") {
        assert.ok(boundary.documentOverflowX <= 1,
          `${route} deterministic page must not overflow at ${width}px: ${JSON.stringify(boundary.documentOverflowElements)}`);
      }
      evidence.breakpoints.push({ width, route, ...boundary });
    }
  }
}

async function assertSuccessfulMedia(targetPage) {
  await targetPage.waitForTimeout(250);
  const images = await targetPage.locator(".directive-expanded-shell img").evaluateAll((nodes) => nodes
    .filter((image) => image.getClientRects().length > 0 && getComputedStyle(image).visibility !== "hidden")
    .map((image) => ({
    src: image.currentSrc || image.src,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    hidden: image.hidden,
  })));
  for (const image of images) {
    assert.equal(image.complete, true, `rendered media did not finish loading: ${image.src}`);
    assert.equal(image.hidden, false, `rendered media unexpectedly fell back: ${image.src}`);
    assert.ok(image.naturalWidth > 0, `rendered media failed to decode: ${image.src}`);
  }
}

async function assertReducedMotion(targetPage) {
  await targetPage.emulateMedia({ reducedMotion: "reduce" });
  const motion = await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
    const segment = shell.querySelector(".directive-lcars-rail-segment");
    const animated = [...shell.querySelectorAll("*")];
    return {
      railBefore: getComputedStyle(segment, "::before").animationName,
      railAfter: getComputedStyle(segment, "::after").animationName,
      excessive: animated.map((node) => {
        const style = getComputedStyle(node);
        return {
          className: node.className,
          animation: maxSeconds(style.animationDuration),
          transition: maxSeconds(style.transitionDuration),
        };
      }).filter((record) => record.animation > 0.001 || record.transition > 0.001),
    };
    function maxSeconds(value) {
      return Math.max(0, ...String(value).split(",").map((part) => {
        const token = part.trim();
        return token.endsWith("ms") ? parseFloat(token) / 1000 : parseFloat(token) || 0;
      }));
    }
  });
  assert.equal(motion.railBefore, "none", "reduced motion must stop rail power-down animation");
  assert.equal(motion.railAfter, "none", "reduced motion must stop rail relay animation");
  assert.deepEqual(motion.excessive, [], "reduced motion must collapse Directive animation and transition durations");
  await targetPage.emulateMedia({ reducedMotion: "no-preference" });
}

async function assertNormalMotionHeroOrbit(targetPage) {
  await targetPage.emulateMedia({ reducedMotion: "no-preference" });
  await targetPage.setViewportSize(VIEWPORTS[0]);
  await targetPage.locator('[data-route-id="campaign"]').click();
  const hero = targetPage.locator(".campaign-dashboard .campaign-hero");
  await hero.waitFor();
  const box = await hero.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "normal-motion Campaign hero must have interactive geometry");
  const baseline = await hero.evaluate((node) => {
    const scene = node.querySelector(".directive-hero-scene-has-cruise");
    const foreground = scene?.querySelector('[data-hero-scene-layer="foreground"]');
    const style = scene ? getComputedStyle(scene) : null;
    return {
      animationNames: scene?.getAnimations({ subtree: true })
        .filter((animation) => animation.constructor.name === "CSSAnimation")
        .map((animation) => animation.animationName) || [],
      shipX: style?.getPropertyValue("--directive-hero-orbit-ship-x").trim() || "",
      shipY: style?.getPropertyValue("--directive-hero-orbit-ship-y").trim() || "",
      yaw: style?.getPropertyValue("--directive-hero-orbit-card-yaw").trim() || "",
      transform: foreground ? getComputedStyle(foreground).transform : "",
    };
  });
  for (const name of [
    "directive-hero-ship-drift", "directive-hero-stars-far-cruise",
    "directive-hero-stars-near-cruise", "directive-hero-windows-live",
    "directive-hero-nacelles-pulse", "directive-hero-sunlight-pulse",
  ]) {
    assert.ok(baseline.animationNames.includes(name), `normal-motion Campaign hero must run production animation ${name}`);
  }
  await targetPage.mouse.move(box.x + box.width * .8, box.y + box.height * .25);
  await targetPage.waitForTimeout(450);
  const engaged = await hero.evaluate((node) => {
    const scene = node.querySelector(".directive-hero-scene-has-cruise");
    const foreground = scene.querySelector('[data-hero-scene-layer="foreground"]');
    const style = getComputedStyle(scene);
    return {
      engaged: node.classList.contains("is-hero-orbit-engaged"),
      mouse: node.classList.contains("is-hero-orbit-mouse"),
      shipX: parseFloat(style.getPropertyValue("--directive-hero-orbit-ship-x")) || 0,
      shipY: parseFloat(style.getPropertyValue("--directive-hero-orbit-ship-y")) || 0,
      yaw: parseFloat(style.getPropertyValue("--directive-hero-orbit-card-yaw")) || 0,
      transform: getComputedStyle(foreground).transform,
    };
  });
  assert.equal(engaged.engaged, true, "pointer movement must engage the production hero orbit");
  assert.equal(engaged.mouse, true, "mouse movement must select the production mouse response");
  assert.ok(engaged.shipX > 0 && engaged.shipY < 0 && engaged.yaw > 0,
    `production orbit variables must respond directionally, got ${JSON.stringify(engaged)}`);
  assert.notEqual(engaged.transform, baseline.transform, "production orbit must alter the rendered ship transform");
  await targetPage.mouse.move(0, 0);
  await targetPage.waitForTimeout(600);
  const reset = await hero.evaluate((node) => {
    const style = getComputedStyle(node.querySelector(".directive-hero-scene-has-cruise"));
    return {
      engaged: node.classList.contains("is-hero-orbit-engaged"),
      shipX: parseFloat(style.getPropertyValue("--directive-hero-orbit-ship-x")) || 0,
      shipY: parseFloat(style.getPropertyValue("--directive-hero-orbit-ship-y")) || 0,
      yaw: parseFloat(style.getPropertyValue("--directive-hero-orbit-card-yaw")) || 0,
    };
  });
  assert.equal(reset.engaged, false, "leaving the production hero must clear its engaged state");
  assert.ok(Math.abs(reset.shipX) <= .001 && Math.abs(reset.shipY) <= .001 && Math.abs(reset.yaw) <= .001,
    `leaving the production hero must restore its neutral orbit frame, got ${JSON.stringify(reset)}`);
}

async function assertNoRuntimeFailures(observed) {
  assert.deepEqual(observed.response, [], "HTTP error responses must be empty");
  assert.deepEqual(observed.console, [], "browser console errors must be empty");
  assert.deepEqual(observed.page, [], "page errors must be empty");
  assert.deepEqual(observed.request, [], "failed requests must be empty");
}

async function capture(targetPage, name, viewport, {
  referenceStem = name,
  thresholdRoute = name,
  scrollRecordSelector = null,
} = {}) {
  const filename = `actual-${name}-${viewport.width}x${viewport.height}.png`;
  await targetPage.emulateMedia({ reducedMotion: "no-preference" });
  await targetPage.mouse.move(0, 0);
  await targetPage.locator('[data-directive-scroll-owner="true"]').evaluateAll((owners) => {
    for (const owner of owners) {
      owner.scrollTop = 0;
      owner.scrollLeft = 0;
    }
  });
  if (scrollRecordSelector) {
    await targetPage.locator(scrollRecordSelector).evaluate((node) => {
      const owner = node.closest('[data-directive-scroll-owner="true"]');
      if (!owner) throw new Error("campaign record has no Directive scroll owner");
      owner.scrollTop += node.getBoundingClientRect().top - owner.getBoundingClientRect().top;
    });
  }
  await targetPage.waitForTimeout(200);
  const frozenAnimations = await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
    const animations = shell.getAnimations({ subtree: true })
      .filter((animation) => animation.constructor.name === "CSSAnimation");
    return animations.map((animation) => {
      animation.pause();
      animation.currentTime = 0;
      return animation.animationName;
    });
  });
  if (thresholdRoute === "campaign") {
    for (const animationName of [
      "directive-hero-ship-drift", "directive-hero-stars-far-cruise",
      "directive-hero-stars-near-cruise", "directive-hero-windows-live",
      "directive-hero-nacelles-pulse", "directive-hero-sunlight-pulse",
    ]) {
      assert.ok(frozenAnimations.includes(animationName),
        `${name} raster must freeze the production animation ${animationName}`);
    }
  }
  await targetPage.evaluate(() => document.fonts.ready);
  const comparisonMask = thresholdRoute === "settings"
    ? await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
      const shellRect = shell.getBoundingClientRect();
      const contentSpecific = [
        ...shell.querySelectorAll(".settings-section-head > span, .settings-section-head > h2, .settings-section-head > p"),
        shell.querySelector(".settings-content > .settings-section:first-child .settings-facts"),
        shell.querySelector(".settings-content > .settings-section:nth-child(2) > p"),
      ].filter(Boolean);
      return contentSpecific.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(rect.left - shellRect.left - 1)),
          y: Math.max(0, Math.floor(rect.top - shellRect.top - 1)),
          width: Math.max(0, Math.ceil(rect.width + 2)),
          height: Math.max(0, Math.ceil(rect.height + 2)),
        };
      });
    })
    : [];
  const screenshot = await targetPage.locator(".directive-expanded-shell").screenshot({ path: path.join(ARTIFACT_ROOT, filename) });
  await targetPage.locator(".directive-expanded-shell").evaluate((shell) => {
    for (const animation of shell.getAnimations({ subtree: true })) {
      if (animation.constructor.name === "CSSAnimation" && animation.playState === "paused") animation.play();
    }
  });
  evidence.metrics.push({ kind: "production-animation-freeze", route: name, viewport: viewport.label, animationNames: frozenAnimations });
  evidence.captures.push(filename);
  if ((ROUTES.includes(name) || name === "campaign-browser") && runtime.mode === "deterministic-harness") {
    const referenceName = `${referenceStem}-${viewport.width}x${viewport.height}.png`;
    const referencePath = path.join(REFERENCE_ROOT, referenceName);
    await stat(referencePath);
    const comparison = await compareReferenceImage(targetPage, screenshot, await readFile(referencePath), viewport, comparisonMask);
    const referenceFilename = `reference-${name}-${viewport.width}x${viewport.height}.png`;
    const differenceFilename = `difference-${name}-${viewport.width}x${viewport.height}.png`;
    await writeFile(path.join(ARTIFACT_ROOT, referenceFilename), Buffer.from(comparison.referencePngBase64, "base64"));
    await writeFile(path.join(ARTIFACT_ROOT, differenceFilename), Buffer.from(comparison.differencePngBase64, "base64"));
    delete comparison.referencePngBase64;
    delete comparison.differencePngBase64;
    const threshold = visualThreshold(thresholdRoute, viewport);
    if (comparison.normalizedDifference > threshold.mean) {
      visualFailures.push(`${name} ${viewport.label} mean ${comparison.normalizedDifference} > ${threshold.mean}`);
    }
    if (comparison.changedPixelRatio > threshold.changed) {
      visualFailures.push(`${name} ${viewport.label} changed ${comparison.changedPixelRatio} > ${threshold.changed}`);
    }
    evidence.comparisons.push({ route: name, viewport: `${viewport.width}x${viewport.height}`, actual: filename, reference: referenceFilename, difference: differenceFilename, sourceReference: referencePath, threshold, ...comparison });
  }
}

function visualThreshold(route, viewport) {
  const key = `${route}:${viewport.width}x${viewport.height}`;
  const limit = PROVEN_VISUAL_LIMITS[key];
  assert.ok(limit, `no inspected full-resolution tolerance is registered for ${key}`);
  return { ...limit, basis: "2026-08-19 inspected full-resolution production-animation phase-zero raster" };
}

async function compareReferenceImage(targetPage, actual, reference, viewport, maskRects = []) {
  return targetPage.evaluate(async ({ actualBase64, referenceBase64, referenceCrop, maskRects }) => {
    const decode = (base64) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/png;base64,${base64}`;
    });
    const [actualImage, referenceImage] = await Promise.all([decode(actualBase64), decode(referenceBase64)]);
    const pixels = (image, crop) => {
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      return context.getImageData(0, 0, crop.width, crop.height).data;
    };
    const actualCrop = { x: 0, y: 0, width: actualImage.width, height: actualImage.height };
    if (actualCrop.width !== referenceCrop.width || actualCrop.height !== referenceCrop.height) {
      throw new Error(`shell clip geometry differs: actual ${actualCrop.width}x${actualCrop.height}; reference ${referenceCrop.width}x${referenceCrop.height}`);
    }
    const actualPixels = pixels(actualImage, actualCrop);
    const referencePixels = pixels(referenceImage, referenceCrop);
    const referenceCanvas = document.createElement("canvas");
    referenceCanvas.width = referenceCrop.width;
    referenceCanvas.height = referenceCrop.height;
    const referenceContext = referenceCanvas.getContext("2d");
    referenceContext.drawImage(referenceImage, referenceCrop.x, referenceCrop.y, referenceCrop.width, referenceCrop.height, 0, 0, referenceCrop.width, referenceCrop.height);
    const differenceCanvas = document.createElement("canvas");
    differenceCanvas.width = referenceCrop.width;
    differenceCanvas.height = referenceCrop.height;
    const differenceContext = differenceCanvas.getContext("2d");
    const differenceImage = differenceContext.createImageData(referenceCrop.width, referenceCrop.height);
    let difference = 0;
    let changedPixels = 0;
    let pixelCount = 0;
    let maskedPixels = 0;
    for (let index = 0; index < actualPixels.length; index += 4) {
      const pixelIndex = index / 4;
      const x = pixelIndex % referenceCrop.width;
      const y = Math.floor(pixelIndex / referenceCrop.width);
      const masked = maskRects.some((rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
      if (masked) {
        differenceImage.data[index] = Math.round(actualPixels[index] * 0.18);
        differenceImage.data[index + 1] = Math.round(actualPixels[index + 1] * 0.18);
        differenceImage.data[index + 2] = Math.round(actualPixels[index + 2] * 0.18);
        differenceImage.data[index + 3] = 255;
        maskedPixels += 1;
        continue;
      }
      const red = Math.abs(actualPixels[index] - referencePixels[index]);
      const green = Math.abs(actualPixels[index + 1] - referencePixels[index + 1]);
      const blue = Math.abs(actualPixels[index + 2] - referencePixels[index + 2]);
      const peak = Math.max(red, green, blue);
      difference += red + green + blue;
      if (peak > 16) changedPixels += 1;
      differenceImage.data[index] = peak > 16 ? 255 : Math.round(actualPixels[index] * 0.18);
      differenceImage.data[index + 1] = peak > 16 ? Math.max(0, 220 - peak * 2) : Math.round(actualPixels[index + 1] * 0.18);
      differenceImage.data[index + 2] = peak > 16 ? 0 : Math.round(actualPixels[index + 2] * 0.18);
      differenceImage.data[index + 3] = 255;
      pixelCount += 1;
    }
    differenceContext.putImageData(differenceImage, 0, 0);
    return {
      comparedPixels: pixelCount,
      maskedPixels,
      maskRects,
      crop: referenceCrop,
      normalizedDifference: Number((difference / (pixelCount * 3 * 255)).toFixed(5)),
      changedPixelRatio: Number((changedPixels / pixelCount).toFixed(5)),
      referencePngBase64: referenceCanvas.toDataURL("image/png").split(",")[1],
      differencePngBase64: differenceCanvas.toDataURL("image/png").split(",")[1],
    };
  }, {
    actualBase64: actual.toString("base64"),
    referenceBase64: reference.toString("base64"),
    maskRects,
    referenceCrop: viewport.width > 640
      ? { x: Math.round((viewport.width - 940) / 2), y: 16, width: 940, height: viewport.height - 32 }
      : { x: 0, y: 0, width: viewport.width, height: viewport.height },
  });
}

async function prepareLiveHost(browserContext, baseUrl) {
  let response = await browserContext.request.post(`${baseUrl}/api/auth/setup`, {
    data: { username: "directive-review", password: "directive-review-password" },
  });
  assert.equal(response.status(), 200, `scratch Sonder account setup failed: ${response.status()} ${await response.text()}`);
  response = await browserContext.request.post(`${baseUrl}/api/extensions/directive/enable`);
  assert.equal(response.status(), 200, `Directive enable failed: ${response.status()} ${await response.text()}`);
}

async function provisionLiveCampaign(targetPage, browserContext, baseUrl) {
  const response = await browserContext.request.post(`${baseUrl}/api/extensions/directive/x/start`, {
    data: {
      name: "Avery Quill",
      pronouns_or_address: "they/them",
      species: "Human",
      age_band: "mid-career",
      appearance: "A composed officer with close-cropped dark hair.",
      career_background: "operations-logistics",
      formative_experience: "dominion-war-fleet-service",
      assignment_reason: "requested-by-captain",
      insight_trait: "analytical",
      connection_trait: "candid",
      execution_trait: "decisive",
      flaw: "guarded",
      simulation_mode: "Exploration",
    },
  });
  assert.equal(response.status(), 200, `Directive campaign provisioning failed: ${response.status()} ${await response.text()}`);
  const made = await response.json();
  assert.ok(Number.isInteger(made.chat_id), "Directive campaign start must return a chat id");
  await targetPage.evaluate(async (chatId) => window.Sonder.chats.open(chatId), made.chat_id);
  await targetPage.waitForFunction((chatId) => window.Sonder.state().chatId === chatId, made.chat_id);
}

async function startLiveSonder(sonderRoot) {
  assert.ok((await stat(path.join(sonderRoot, "app.py"))).isFile(), `SONDER_ENGINE_ROOT is not a Sonder checkout: ${sonderRoot}`);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "directive-ui-review-"));
  const extensionsRoot = path.join(temporaryRoot, "extensions");
  const staged = path.join(extensionsRoot, "directive");
  await mkdir(staged, { recursive: true });
  for (const entry of ["manifest.json", "extension.py", "directive", "packages", "ui", "assets"]) {
    await cp(path.join(ROOT, entry), path.join(staged, entry), { recursive: true });
  }
  const port = await freePort();
  const python = process.env.DIRECTIVE_REVIEW_PYTHON || (process.platform === "win32" ? "C:\\Python313\\python.exe" : "python3");
  const child = spawn(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: sonderRoot,
    env: {
      ...process.env,
      ENGINE_DB: path.join(temporaryRoot, "sonder-review.db"),
      SONDER_EXTENSIONS: extensionsRoot,
      FICTION_ENGINE_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForUrl(`${baseUrl}/api/auth/status`, child, () => output);
  } catch (error) {
    child.kill();
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
  return {
    mode: "live-sonder",
    baseUrl,
    async close() {
      child.kill();
      await new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        setTimeout(resolve, 5000).unref();
      });
      await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const assetPrefix = "/api/extensions/directive/asset/";
      const relative = pathname.startsWith(assetPrefix)
        ? pathname.slice(assetPrefix.length)
        : pathname === "/" ? HARNESS_PATH.slice(1) : pathname.slice(1);
      const filePath = path.resolve(ROOT, relative);
      if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) throw new Error("path escaped review root");
      const content = await readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(content);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    mode: "deterministic-harness",
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
  })[extension] || "application/octet-stream";
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForUrl(url, child, readOutput) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Sonder exited before startup (${child.exitCode})\n${readOutput()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Sonder did not start within 30 seconds\n${readOutput()}`);
}

async function BunlessWriteJson(filePath, value) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
