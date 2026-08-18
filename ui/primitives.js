export function createElement(tagName, className = "") {
  const value = document.createElement(tagName);
  if (className) value.className = className;
  return value;
}

export function appendText(element, value) {
  element.append(document.createTextNode(String(value ?? "")));
  return element;
}

export function setClassState(element, className, enabled) {
  const names = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
  if (enabled) names.add(className);
  else names.delete(className);
  element.className = [...names].join(" ");
  return element;
}

export function createVectorGlyph(glyphId, className = "") {
  const glyph = createElement("span", `directive-vector-glyph${className ? ` ${className}` : ""}`);
  glyph.dataset.glyph = glyphId;
  glyph.setAttribute("aria-hidden", "true");
  return glyph;
}
