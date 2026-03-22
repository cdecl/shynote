import { classHighlighter } from "@lezer/highlight";
const MAX_WALK_DEPTH = 8;
function generateSyntaxThemeCSS(syntaxTheme, _wrapperClass) {
  if (!syntaxTheme) return "";
  const styles = extractRuntimeHighlightStyles(syntaxTheme);
  if (!styles.length) return "";
  const cssChunks = [];
  for (const style of styles) {
    const rules = style.module?.getRules();
    if (!rules) continue;
    cssChunks.push(rules);
  }
  if (!cssChunks.length) return "";
  return Array.from(new Set(cssChunks)).join("\n");
}
function resolveSyntaxHighlighters(syntaxTheme, includeLegacyClassHighlighter = true) {
  const resolved = [];
  if (includeLegacyClassHighlighter) {
    resolved.push(classHighlighter);
  }
  const styles = extractRuntimeHighlightStyles(syntaxTheme);
  for (const style of styles) {
    if (typeof style.style === "function") {
      resolved.push(style);
    }
  }
  return Array.from(new Set(resolved));
}
function extractRuntimeHighlightStyles(input) {
  if (!input) return [];
  const values = Array.isArray(input) ? input : [input];
  const styles = [];
  const visited = /* @__PURE__ */ new WeakSet();
  for (const value of values) {
    walk(value, 0, visited, styles);
  }
  return styles;
}
function walk(value, depth, visited, out) {
  if (value === null || value === void 0) return;
  if (depth > MAX_WALK_DEPTH) return;
  if (isRuntimeHighlightStyle(value)) {
    out.push(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, depth + 1, visited, out);
    }
    return;
  }
  if (typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);
  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    try {
      walk(value[key], depth + 1, visited, out);
    } catch {
    }
  }
}
function isRuntimeHighlightStyle(value) {
  if (!value || typeof value !== "object") return false;
  const style = value;
  return Array.isArray(style.specs) && typeof style.style === "function";
}
export {
  generateSyntaxThemeCSS,
  resolveSyntaxHighlighters
};
