import assert from "node:assert/strict";
import test from "node:test";

import { createShipCalloutLayout } from "../../ui/ship-callout-layout.js";

const input = {
  orbitRect: { x: 0, y: 0, width: 1000, height: 640 },
  imageRect: { x: 180, y: 80, width: 640, height: 480 },
  imageNaturalSize: { width: 1600, height: 1000 },
  anchors: {
    "forward-sensors": { x: 0.78, y: 0.47 },
    engineering: { x: 0.28, y: 0.34 },
  },
  shipId: "uss-breckenridge",
  tasks: [
    { id: "sensor", anchor: "forward-sensors" },
    { id: "systems", anchor: "engineering" },
  ],
  controlSizes: {
    sensor: { width: 220, height: 64 },
    systems: { width: 220, height: 64 },
  },
};

test("Directive Ship callouts solve from authored anchors at desktop and mobile breakpoints", () => {
  const desktop = createShipCalloutLayout({ ...input, mode: "desktop" });
  const mobile = createShipCalloutLayout({
    ...input,
    mode: "mobile",
    orbitRect: { x: 0, y: 0, width: 390, height: 360 },
    imageRect: { x: 45, y: 40, width: 300, height: 260 },
    controlSizes: {
      sensor: { width: 30, height: 30 },
      systems: { width: 30, height: 30 },
    },
  });

  assert.equal(desktop.valid, true);
  assert.equal(mobile.valid, true);
  assert.deepEqual(desktop.placements.map(({ anchor }) => anchor), ["forward-sensors", "engineering"]);
  assert.deepEqual(mobile.placements.map(({ anchor }) => anchor), ["forward-sensors", "engineering"]);
  assert.equal(desktop.crossingCount, 0);
  assert.equal(mobile.crossingCount, 0);
  assert.notDeepEqual(
    desktop.placements.map(({ slotId }) => slotId),
    mobile.placements.map(({ slotId }) => slotId),
  );
});
