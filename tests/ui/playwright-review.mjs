import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", "playwright-ui-alignment");
const DIRECTIVE_SOURCE_ROOT = path.resolve(process.env.DIRECTIVE_SOURCE_ROOT || path.join(ROOT, "..", "..", "..", "Directive"));
const REFERENCE_ROOT = path.join(DIRECTIVE_SOURCE_ROOT, "artifacts", "expanded-interface-conformance");
const HARNESS_PATH = "/tests/ui/fixtures/directive-harness.html";
const ROUTES = ["campaign", "mission", "people", "ship", "settings"];
const ROUTE_LABELS = ["Campaign", "Mission", "People", "Ship", "Settings"];
const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

await rm(ARTIFACT_ROOT, { recursive: true, force: true });
await mkdir(ARTIFACT_ROOT, { recursive: true });

const liveRoot = process.env.SONDER_ENGINE_ROOT;
const runtime = liveRoot ? await startLiveSonder(path.resolve(liveRoot)) : await startStaticServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORTS[0] });
const page = await context.newPage();
const failures = { console: [], page: [], request: [], response: [] };
page.on("console", (message) => {
  if (message.type() === "error") failures.console.push(message.text());
});
page.on("pageerror", (error) => failures.page.push(String(error?.stack || error)));
page.on("requestfailed", (request) => failures.request.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`));
page.on("response", (response) => {
  if (response.status() >= 400) failures.response.push(`${response.status()} ${response.request().method()} ${response.url()}`);
});

const evidence = { mode: runtime.mode, baseUrl: runtime.baseUrl, referenceRoot: REFERENCE_ROOT, captures: [], metrics: [], comparisons: [] };
try {
  if (runtime.mode === "live-sonder") await prepareLiveHost(context, runtime.baseUrl);
  await openOnboarding(page, runtime);
  await assertFocusEntry(page);
  await assertCommonContract(page, "onboarding", VIEWPORTS[0], "campaign");
  await assertSourceStructure(page, "onboarding", VIEWPORTS[0]);
  await capture(page, "onboarding", VIEWPORTS[0]);
  await page.setViewportSize(VIEWPORTS[1]);
  await assertCommonContract(page, "onboarding", VIEWPORTS[1], "campaign");
  await assertSourceStructure(page, "onboarding", VIEWPORTS[1]);
  await capture(page, "onboarding", VIEWPORTS[1]);

  await page.keyboard.press("Escape");
  await page.locator(".directive-expanded-shell").waitFor({ state: "detached" });
  await assertFocusRestored(page);

  if (runtime.mode === "live-sonder") await provisionLiveCampaign(page, context, runtime.baseUrl);
  else await page.goto(`${runtime.baseUrl}${HARNESS_PATH}`);
  await openDirective(page);
  await assertRovingNavigation(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const route of ROUTES) {
      await page.locator(`[data-route-id="${route}"]`).click();
      await page.locator(`.directive-expanded-shell[data-active-route="${route}"]`).waitFor();
      await assertCommonContract(page, route, viewport);
      await assertSourceStructure(page, route, viewport);
      await assertSuccessfulMedia(page);
      if (route === "ship" && viewport.width <= 640) await assertMobileShipDisclosure(page);
      await capture(page, route, viewport);
    }
  }

  await assertReducedMotion(page);
  await page.keyboard.press("Escape");
  await page.locator(".directive-expanded-shell").waitFor({ state: "detached" });
  await assertFocusRestored(page);
  await assertNoRuntimeFailures(failures);
  assert.equal(evidence.captures.length, 12, "review must capture onboarding plus five routes at both viewports");
  await BunlessWriteJson(path.join(ARTIFACT_ROOT, "results.json"), evidence);
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
  const undersized = metrics.controls.filter((control) => control.height < 43.5);
  assert.deepEqual(
    undersized,
    [],
    `controls must be at least 44px: ${undersized.map((control) => `${control.label} (${control.height}px; min ${control.minHeight}; ${control.boxSizing})`).join(", ")}`,
  );
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
    onboarding: [".directive-expanded-campaign", ".directive-creator-form"],
    campaign: [".directive-expanded-campaign", ".campaign-dashboard", ".campaign-dashboard-hero"],
    mission: [".directive-expanded-mission", ".mission-index-panel", ".mission-detail", ".mission-objective-list"],
    people: [".directive-expanded-people", ".people-journal", ".people-roster", ".people-detail"],
    ship: [".directive-expanded-ship", ".ship-cohesion-workspace", ".ship-cohesion-orbit", ".ship-task-nav"],
    settings: [".directive-expanded-settings", ".settings-content", ".settings-section"],
  }[surface];
  assert.ok(expected, `unknown source structure surface: ${surface}`);

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

async function assertSuccessfulMedia(targetPage) {
  await targetPage.waitForFunction(() => [...document.querySelectorAll(".directive-expanded-shell img")].every((image) => image.complete));
  const images = await targetPage.locator(".directive-expanded-shell img").evaluateAll((nodes) => nodes.map((image) => ({
    src: image.currentSrc || image.src,
    naturalWidth: image.naturalWidth,
    hidden: image.hidden,
  })));
  for (const image of images) {
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

async function assertNoRuntimeFailures(observed) {
  assert.deepEqual(observed.response, [], "HTTP error responses must be empty");
  assert.deepEqual(observed.console, [], "browser console errors must be empty");
  assert.deepEqual(observed.page, [], "page errors must be empty");
  assert.deepEqual(observed.request, [], "failed requests must be empty");
}

async function capture(targetPage, name, viewport) {
  const filename = `${name}-${viewport.label}-${viewport.width}x${viewport.height}.png`;
  await targetPage.mouse.move(0, 0);
  await targetPage.waitForTimeout(200);
  const screenshot = await targetPage.screenshot({ path: path.join(ARTIFACT_ROOT, filename) });
  evidence.captures.push(filename);
  if (ROUTES.includes(name)) {
    const referenceName = `${name}-${viewport.width}x${viewport.height}.png`;
    const referencePath = path.join(REFERENCE_ROOT, referenceName);
    await stat(referencePath);
    const comparison = await compareReferenceImage(targetPage, screenshot, await readFile(referencePath), viewport);
    const threshold = visualThreshold(name, viewport.label);
    assert.ok(comparison.normalizedDifference <= threshold,
      `${name} ${viewport.label} must remain within the authoritative Directive visual envelope: ${comparison.normalizedDifference} > ${threshold}`);
    evidence.comparisons.push({ route: name, viewport: `${viewport.width}x${viewport.height}`, reference: referencePath, threshold, ...comparison });
  }
}

function visualThreshold(route, viewportLabel) {
  const thresholds = {
    campaign: { desktop: 0.08, mobile: 0.09 },
    mission: { desktop: 0.04, mobile: 0.08 },
    people: { desktop: 0.08, mobile: 0.13 },
    ship: { desktop: 0.09, mobile: 0.09 },
    settings: { desktop: 0.08, mobile: 0.10 },
  };
  return thresholds[route][viewportLabel];
}

async function compareReferenceImage(targetPage, actual, reference, viewport) {
  return targetPage.evaluate(async ({ actualBase64, referenceBase64, crop }) => {
    const decode = (base64) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/png;base64,${base64}`;
    });
    const [actualImage, referenceImage] = await Promise.all([decode(actualBase64), decode(referenceBase64)]);
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 96, 96);
      return context.getImageData(0, 0, 96, 96).data;
    };
    const actualPixels = pixels(actualImage);
    const referencePixels = pixels(referenceImage);
    let difference = 0;
    for (let index = 0; index < actualPixels.length; index += 4) {
      difference += Math.abs(actualPixels[index] - referencePixels[index]);
      difference += Math.abs(actualPixels[index + 1] - referencePixels[index + 1]);
      difference += Math.abs(actualPixels[index + 2] - referencePixels[index + 2]);
    }
    return { normalizedDifference: Number((difference / (96 * 96 * 3 * 255)).toFixed(5)) };
  }, {
    actualBase64: actual.toString("base64"),
    referenceBase64: reference.toString("base64"),
    crop: viewport.width > 640 ? { x: 250, y: 16, width: 940, height: 868 } : { x: 0, y: 0, width: viewport.width, height: viewport.height },
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
