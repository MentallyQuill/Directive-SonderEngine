import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET_ROOT = path.resolve(process.env.DIRECTIVE_TARGET_ROOT || ROOT);
const SOURCE_ROOT = path.resolve(process.env.DIRECTIVE_SOURCE_ROOT || "F:/git/Directive");
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", "playwright-creator-parity");
const VIEWPORTS = [
  { label: "desktop-wide", width: 1440, height: 900 },
  { label: "desktop-compact", width: 1024, height: 768 },
  { label: "phone-wide", width: 390, height: 844 },
  { label: "phone", width: 360, height: 800 },
  { label: "phone-short", width: 360, height: 500 },
];
const STEPS = ["identity", "service", "personality", "review"];
const COMPLETED = {
  identity: [],
  service: ["identity"],
  personality: ["identity", "service"],
  review: ["identity", "service", "personality"],
};
const VALUES = Object.freeze({
  name: "Avery Quill",
  pronouns_or_address: "Commander Quill",
  species: "human",
  age_band: "mid-career",
  appearance: "Close-cropped dark hair and a composed bearing.",
  career_background: "operations-logistics",
  formative_experience: "dominion-war-fleet-service",
  assignment_reason: "requested-by-captain",
  insight_trait: "analytical",
  connection_trait: "candid",
  execution_trait: "decisive",
  flaw: "guarded",
  service_summary: "Operations and logistics; shaped by Dominion War fleet service.",
  command_style: "Analytical, Candid, and Decisive; Guarded remains a pressure point.",
  brief_biography: "Avery Quill is a Human Starfleet Commander assigned as Executive Officer of the U.S.S. Breckenridge on stardate 53068.4. Their background in Operations and logistics and formative experience with Dominion War fleet service made them a credible choice for the Asterion Reach mission. Their command style is shaped by Analytical, Candid, and Decisive, while Guarded remains a pressure point they will need to manage in command.",
  public_reputation: "Avery Quill is regarded as a capable Commander whose Operations and logistics background makes the Breckenridge assignment plausible, though the crew is still learning what kind of XO they have received.",
  simulation_mode: "Command",
});
const STEP_FIELDS = {
  identity: ["name", "pronouns_or_address", "species", "age_band", "appearance"],
  service: ["career_background", "formative_experience", "assignment_reason"],
  personality: ["insight_trait", "connection_trait", "execution_trait", "flaw"],
};
const LIMITS = Object.freeze({
  mean: 0.009,
  changed: 0.045,
  basis: "2026-08-19 inspected authoritative Directive source raster at all creator breakpoints",
});

await rm(ARTIFACT_ROOT, { recursive: true, force: true });
await mkdir(ARTIFACT_ROOT, { recursive: true });
const targetServer = await startTargetServer();
const sourceServer = await startSourceServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORTS[0] });
const target = await context.newPage();
const source = await context.newPage();
const evidence = { target: targetServer.baseUrl, source: sourceServer.baseUrl, comparisons: [] };
const failures = [];

try {
  await target.goto(`${targetServer.baseUrl}/tests/ui/fixtures/directive-harness.html?onboarding=1`, { waitUntil: "networkidle" });
  await target.locator('[data-ext-button="directive-launch"]').click();
  await target.locator('.campaign-browser[data-campaign-view="browser"]').waitFor();
  await target.setViewportSize(VIEWPORTS[0]);
  await target.locator(".campaign-desktop-detail .campaign-command-primary").click();
  await target.locator('[data-creator-form="true"]').waitFor();

  for (const step of STEPS) {
    assert.equal(await target.locator('[data-creator-form="true"]').getAttribute("data-creator-active-step"), step);
    for (const viewport of VIEWPORTS) {
      await target.setViewportSize(viewport);
      await source.setViewportSize(viewport);
      await renderSourceCreator(source, sourceServer.baseUrl, step);
      await assertCreatorContract(target, step, viewport);
      await assertCreatorContract(source, step, viewport);
      await compareCreatorSurface(target, source, `creator-${step}`, viewport);
    }
    if (step !== "review") {
      await fillStep(target, step);
      await target.locator(".directive-creator-next-command").click();
    }
  }

  await captureAssistDialog(target, source, sourceServer.baseUrl);
  await writeFile(path.join(ARTIFACT_ROOT, "results.json"), JSON.stringify(evidence, null, 2));
  assert.deepEqual(failures, [], `Directive creator visual parity failed:\n${failures.join("\n")}`);
  assert.equal(evidence.comparisons.length, 21);
  console.log(`PASS: 21 authoritative creator comparisons; artifacts at ${ARTIFACT_ROOT}`);
} finally {
  await context.close();
  await browser.close();
  await targetServer.close();
  await sourceServer.close();
}

async function renderSourceCreator(page, baseUrl, step) {
  await page.goto(`${baseUrl}/production?route=campaign`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__directiveFixtureReady === true);
  await page.evaluate(async ({ step, completed, input, fontUrl }) => {
    const [{ createCharacterCreatorViewModel }, { renderCharacterCreatorPanel }] = await Promise.all([
      import("/src/runtime/campaign-start-controller.mjs"),
      import("/src/ui/character-creator-panel.js"),
    ]);
    const packageData = await fetch("/packages/bundled/breckenridge/ashes-of-peace.campaign-package.json").then((response) => response.json());
    const draft = {
      id: "draft.creator-parity",
      status: "inProgress",
      revision: 4,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
      acceptedAt: null,
      activeStep: step,
      autosave: {},
      input,
      progress: {
        completedSteps: completed,
        reviewReady: step === "review",
        readyForCampaignStart: step === "review",
      },
    };
    const creator = createCharacterCreatorViewModel({ packageData, draft });
    const body = document.querySelector('[data-directive-runtime-body="true"]');
    body.replaceChildren();
    if (!document.getElementById("creator-parity-fontawesome")) {
      const style = document.createElement("style");
      style.id = "creator-parity-fontawesome";
      style.textContent = `
        @font-face { font-family: "Directive Font Awesome 6 Free"; font-style: normal; font-weight: 900; src: url("${fontUrl}") format("woff2"); }
        .directive-expanded-shell .fa-solid { display: inline-block; font-family: "Directive Font Awesome 6 Free"; font-style: normal; font-weight: 900; line-height: 1; }
        .directive-expanded-shell .fa-arrow-right::before { content: "\\f061"; }
        .directive-expanded-shell .fa-arrow-left::before { content: "\\f060"; }
        .directive-expanded-shell .fa-check::before { content: "\\f00c"; }
        .directive-expanded-shell .fa-floppy-disk::before { content: "\\f0c7"; }
        .directive-expanded-shell .fa-image::before { content: "\\f03e"; }
        .directive-expanded-shell .fa-play::before { content: "\\f04b"; }
        .directive-expanded-shell .fa-rotate-right::before { content: "\\f2f9"; }
        .directive-expanded-shell .fa-trash-can::before { content: "\\f2ed"; }
        .directive-expanded-shell .fa-wand-magic-sparkles::before { content: "\\e2ca"; }
        .directive-expanded-shell .fa-xmark::before { content: "\\f00d"; }
      `;
      document.head.append(style);
    }
    const noop = async () => ({ ok: true });
    renderCharacterCreatorPanel(body, {
      creator,
      activePackage: packageData,
      media: { playerPortraitImportSupported: true },
    }, {
      returnCreatorToCampaignLibrary: noop,
      saveCreatorDraft: noop,
      discardCreatorDraft: noop,
      acceptCreatorDraftAndStartCampaign: noop,
      generateCreatorSectionDraft: noop,
      cancelCreatorSectionDraft: noop,
      importCreatorPortrait: noop,
      removeCreatorPortrait: noop,
      refresh: noop,
      setActiveTab: noop,
    });
  }, {
    step,
    completed: COMPLETED[step],
    input: nestedInput(step),
    fontUrl: `${targetServer.baseUrl}/api/extensions/directive/asset/assets/fonts/fa-solid-900.woff2`,
  });
  await waitForStableMedia(page);
}

function nestedInput(step) {
  const include = (candidate) => STEPS.indexOf(candidate) < STEPS.indexOf(step) || candidate === step;
  const input = {
    identity: {}, service: {}, personality: { traits: {} }, dossier: {},
    settings: { simulationMode: VALUES.simulation_mode },
  };
  if (include("service")) {
    Object.assign(input.identity, {
      name: VALUES.name,
      pronounsOrAddress: VALUES.pronouns_or_address,
      speciesId: VALUES.species,
      ageBandId: VALUES.age_band,
      appearance: VALUES.appearance,
    });
  }
  if (include("personality")) {
    Object.assign(input.service, {
      careerBackgroundId: VALUES.career_background,
      formativeExperienceId: VALUES.formative_experience,
      assignmentReasonId: VALUES.assignment_reason,
    });
  }
  if (step === "review") {
    input.personality.traits = {
      insight: VALUES.insight_trait,
      connection: VALUES.connection_trait,
      execution: VALUES.execution_trait,
    };
    input.personality.flawId = VALUES.flaw;
    Object.assign(input.dossier, {
      serviceSummary: VALUES.service_summary,
      traits: VALUES.command_style,
      briefBiography: VALUES.brief_biography,
      publicReputation: VALUES.public_reputation,
    });
  }
  return input;
}

async function fillStep(page, step) {
  for (const name of STEP_FIELDS[step]) {
    const control = page.locator(`[name="${name}"]`);
    if (await control.evaluate((node) => node.tagName === "SELECT")) await control.selectOption(VALUES[name]);
    else await control.fill(VALUES[name]);
  }
}

async function assertCreatorContract(page, step, viewport) {
  const contract = await page.locator('[data-creator-form="true"]').evaluate((form) => {
    const visibleSections = [...form.querySelectorAll("[data-creator-step]")].filter((node) => !node.hidden && getComputedStyle(node).display !== "none");
    const owner = form.closest('[data-directive-scroll-owner="true"]') || form;
    return {
      activeStep: form.dataset.creatorActiveStep,
      classes: form.className,
      steps: [...form.querySelectorAll("[data-creator-step-button]")].map((button) => ({
        label: button.querySelector("span:not(.directive-creator-step-state)")?.textContent.trim(),
        state: button.dataset.creatorStepState,
      })),
      visibleSections: visibleSections.map((node) => node.dataset.creatorStep),
      commands: [...form.querySelectorAll(".directive-creator-command-bar .directive-button")].map((button) => button.textContent.trim()),
      overflow: owner.scrollWidth - owner.clientWidth,
      controls: [...form.querySelectorAll("button, input, select, textarea")]
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return !node.closest(".directive-creator-portrait-actions")
            && rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
        })
        .map((node) => node.getBoundingClientRect().height),
    };
  });
  assert.equal(contract.activeStep, step);
  assert.match(contract.classes, /directive-creator-console/);
  assert.match(contract.classes, /directive-lcars-panel/);
  assert.deepEqual(contract.steps.map(({ label }) => label), ["Identity", "Service", "Personality", "Review"]);
  assert.deepEqual(contract.visibleSections, [step]);
  assert.ok(contract.commands.includes(step === "review" ? "Start Campaign" : `Next: ${STEPS[STEPS.indexOf(step) + 1][0].toUpperCase()}${STEPS[STEPS.indexOf(step) + 1].slice(1)}`));
  assert.ok(contract.overflow <= 1, `${step} has ${contract.overflow}px horizontal overflow at ${viewport.width}px`);
  if (viewport.width <= 640) {
    assert.ok(contract.controls.every((height) => height >= 40), `${step} has a mobile control shorter than 40px: ${contract.controls}`);
  }
}

async function compareCreatorSurface(targetPage, sourcePage, name, viewport) {
  await Promise.all([waitForStableMedia(targetPage), waitForStableMedia(sourcePage)]);
  await targetPage.mouse.move(0, 0);
  await sourcePage.mouse.move(0, 0);
  await resetScroll(targetPage);
  await resetScroll(sourcePage);
  const actual = await targetPage.locator(".directive-route-body").screenshot();
  const reference = await sourcePage.locator(".directive-route-body").screenshot();
  await compareAndRecord(targetPage, actual, reference, name, viewport);
}

async function captureAssistDialog(targetPage, sourcePage, sourceBaseUrl) {
  const viewport = VIEWPORTS[2];
  await targetPage.setViewportSize(viewport);
  await sourcePage.setViewportSize(viewport);
  await targetPage.locator('[data-creator-step-button="identity"]').click();
  await targetPage.evaluate(async () => {
    const { createCreatorAssistDialog } = await import("/ui/creator-assist-dialog.js");
    const dialog = createCreatorAssistDialog({
      sectionId: "identity",
      sectionLabel: "Identity",
      mode: "refine",
      opener: document.querySelector('[data-creator-section-wand="identity"]'),
    });
    dialog.showProgress("Generating with Reasoning from current details...");
  });
  await targetPage.locator('[data-creator-assist-modal="identity"][data-creator-assist-state="loading"]').waitFor();

  await renderSourceCreator(sourcePage, sourceBaseUrl, "identity");
  await sourcePage.evaluate(async () => {
    const { createCharacterCreatorAssistDialog } = await import("/src/ui/character-creator-assist-dialog.js");
    createCharacterCreatorAssistDialog({
      sectionId: "identity",
      sectionLabel: "Identity",
      mode: "refine",
      progressMessage: "Generating with Reasoning from current details...",
      opener: document.querySelector('[data-creator-section-wand="identity"]'),
    });
  });
  const actual = await targetPage.locator(".directive-creator-assist-dialog").screenshot();
  const reference = await sourcePage.locator(".directive-creator-assist-dialog").screenshot();
  await compareAndRecord(targetPage, actual, reference, "creator-assist", viewport);
  await targetPage.locator('[data-creator-assist-action="cancel"]').click();
}

async function compareAndRecord(page, actual, reference, name, viewport) {
  const comparison = await compareImages(page, actual, reference);
  const stem = `${name}-${viewport.width}x${viewport.height}`;
  await writeFile(path.join(ARTIFACT_ROOT, `actual-${stem}.png`), actual);
  await writeFile(path.join(ARTIFACT_ROOT, `reference-${stem}.png`), reference);
  await writeFile(path.join(ARTIFACT_ROOT, `difference-${stem}.png`), Buffer.from(comparison.differencePngBase64, "base64"));
  delete comparison.differencePngBase64;
  evidence.comparisons.push({ name, viewport: viewport.label, size: `${viewport.width}x${viewport.height}`, limits: LIMITS, ...comparison });
  if (comparison.normalizedDifference > LIMITS.mean) failures.push(`${stem}: mean ${comparison.normalizedDifference} > ${LIMITS.mean}`);
  if (comparison.changedPixelRatio > LIMITS.changed) failures.push(`${stem}: changed ${comparison.changedPixelRatio} > ${LIMITS.changed}`);
}

async function compareImages(page, actual, reference) {
  return page.evaluate(async ({ actualBase64, referenceBase64 }) => {
    const decode = (base64) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/png;base64,${base64}`;
    });
    const [left, right] = await Promise.all([decode(actualBase64), decode(referenceBase64)]);
    if (left.width !== right.width || left.height !== right.height) {
      throw new Error(`creator geometry differs: actual ${left.width}x${left.height}; reference ${right.width}x${right.height}`);
    }
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const a = pixels(left);
    const b = pixels(right);
    const canvas = document.createElement("canvas");
    canvas.width = left.width;
    canvas.height = left.height;
    const context = canvas.getContext("2d");
    const diff = context.createImageData(left.width, left.height);
    let sum = 0;
    let changed = 0;
    for (let index = 0; index < a.length; index += 4) {
      const red = Math.abs(a[index] - b[index]);
      const green = Math.abs(a[index + 1] - b[index + 1]);
      const blue = Math.abs(a[index + 2] - b[index + 2]);
      const delta = Math.max(red, green, blue);
      sum += red + green + blue;
      if (delta > 24) changed += 1;
      diff.data[index] = delta;
      diff.data[index + 1] = delta ? 32 : 0;
      diff.data[index + 2] = delta ? 255 - delta : 0;
      diff.data[index + 3] = 255;
    }
    context.putImageData(diff, 0, 0);
    const pixelCount = left.width * left.height;
    return {
      width: left.width,
      height: left.height,
      normalizedDifference: Number((sum / (pixelCount * 3 * 255)).toFixed(6)),
      changedPixelRatio: Number((changed / pixelCount).toFixed(6)),
      differencePngBase64: canvas.toDataURL("image/png").split(",")[1],
    };
  }, { actualBase64: actual.toString("base64"), referenceBase64: reference.toString("base64") });
}

async function resetScroll(page) {
  await page.locator('[data-directive-scroll-owner="true"]').evaluateAll((owners) => {
    for (const owner of owners) {
      owner.scrollTop = 0;
      owner.scrollLeft = 0;
    }
  });
}

async function waitForStableMedia(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      })));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function startTargetServer() {
  return startServer((pathname) => {
    const prefix = "/api/extensions/directive/asset/";
    const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
    return path.resolve(TARGET_ROOT, relative);
  }, TARGET_ROOT);
}

async function startSourceServer() {
  const fixtureRoot = path.join(SOURCE_ROOT, "tools", "fixtures");
  return startServer((pathname) => {
    if (pathname === "/production") return path.join(fixtureRoot, "expanded-interface-runtime.html");
    return path.resolve(SOURCE_ROOT, `.${pathname}`);
  }, SOURCE_ROOT);
}

async function startServer(resolvePath, allowedRoot) {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const filePath = resolvePath(pathname);
      if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("path escaped server root");
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}
