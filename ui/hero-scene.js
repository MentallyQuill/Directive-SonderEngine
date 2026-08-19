import { appendText, createElement } from "./primitives.js";

export function createCampaignHeroScene(media, className) {
  const scene = media.scene;
  const frame = createElement("figure", `${className} directive-hero-scene${scene.cruise ? " directive-hero-scene-has-cruise" : ""}`);
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", clean(media.alt) || "Campaign ship scene");
  frame.dataset.mediaKind = media.kind || "ship.hero";
  frame.dataset.mediaSubject = media.subjectId || "uss-breckenridge";
  frame.dataset.mediaVariant = "hero-scene";
  const placeholder = appendText(createElement("span", "directive-media-placeholder"), "Campaign media unavailable.");
  placeholder.hidden = true;
  let failed = false;
  const image = (classNameValue, source, layerName, shipLayer = false) => {
    const node = createElement("img", classNameValue);
    if (shipLayer) node.dataset.heroShipLayer = layerName;
    else node.dataset.heroSceneLayer = layerName;
      node.src = source;
      node.alt = "";
      node.loading = "lazy";
      node.decoding = "async";
      node.draggable = false;
      node.setAttribute("draggable", "false");
    node.setAttribute("aria-hidden", "true");
    node.addEventListener("error", () => {
      if (failed) return;
      failed = true;
      for (const rendered of frame.querySelectorAll("img")) rendered.hidden = true;
      placeholder.hidden = false;
    });
    return node;
  };
  frame.append(
    image("directive-hero-scene-layer", scene.layers.background, "background"),
    image("directive-hero-scene-layer", scene.layers.stars, "stars"),
  );
  if (scene.cruise) {
    for (const [name, source] of [["stars-far", scene.cruise.farStars], ["stars-near", scene.cruise.nearStars]]) {
      const field = createElement("span", "directive-hero-scene-layer directive-hero-cruise-stars");
      field.dataset.heroSceneLayer = name;
      field.style.setProperty("--directive-hero-star-texture", `url("${source}")`);
      field.setAttribute("aria-hidden", "true");
      frame.append(field);
    }
  }
  if (scene.emissive) {
    const card = createElement("span", "directive-hero-scene-layer directive-hero-ship-card");
    card.dataset.heroSceneLayer = "foreground";
    card.setAttribute("aria-hidden", "true");
    card.style.setProperty("--directive-hero-window-noise", `url("${scene.emissive.windowNoise}")`);
    card.append(
      image("directive-hero-ship-card-layer", scene.layers.foreground, "base", true),
      image("directive-hero-ship-card-layer", scene.emissive.windows, "windows", true),
      image("directive-hero-ship-card-layer", scene.emissive.nacelles, "nacelles", true),
    );
    frame.append(card);
  } else {
    frame.append(image("directive-hero-scene-layer", scene.layers.foreground, "foreground"));
  }
  if (scene.cruise?.sunlight) frame.append(image("directive-hero-scene-layer", scene.cruise.sunlight, "sunlight"));
  frame.append(placeholder);
  return frame;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
}
