function deepMerge(a, b) {
  const result = { ...a };
  if (!b) {
    return result;
  }
  for (const key in b) {
    if (b[key] && typeof b[key] === "object" && !Array.isArray(b[key]) && typeof a[key] === "object") {
      result[key] = deepMerge(a[key], b[key]);
    } else {
      result[key] = b[key];
    }
  }
  return result;
}
var ThemeEnum = /* @__PURE__ */ ((ThemeEnum2) => {
  ThemeEnum2["DARK"] = "dark";
  ThemeEnum2["LIGHT"] = "light";
  ThemeEnum2["AUTO"] = "auto";
  return ThemeEnum2;
})(ThemeEnum || {});
function createTheme({
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme
}) {
  return (theme) => {
    defaultTheme = flattenThemeStyles(defaultTheme);
    darkTheme = flattenThemeStyles(darkTheme || {});
    lightTheme = flattenThemeStyles(lightTheme || {});
    let style = defaultTheme;
    if (theme === "dark" /* DARK */) {
      style = deepMerge(style, darkTheme);
    }
    if (theme === "light" /* LIGHT */) {
      style = deepMerge(style, lightTheme);
    }
    return style;
  };
}
function flattenThemeStyles(themeStyles, parentSelector) {
  const flattened = {};
  for (const [selectors, styles] of Object.entries(themeStyles)) {
    for (const selector of selectors.split(",")) {
      if (typeof styles === "object" && !Array.isArray(styles)) {
        const fullSelector = fixSelector(parentSelector ? `${parentSelector} ${selector}` : selector);
        const nestedStyles = flattenThemeStyles(styles, fullSelector);
        Object.assign(flattened, nestedStyles);
      } else {
        if (parentSelector) {
          flattened[parentSelector] = { ...flattened[parentSelector], [selector]: styles };
        } else {
          flattened[selector] = styles;
        }
      }
    }
  }
  return flattened;
}
function fixSelector(selector) {
  return selector.replace(/\s&/g, "");
}
function cursorInRange(view, from, to) {
  const selection = view.state.selection.main;
  return selection.from <= to && selection.to >= from;
}
function selectionOverlapsRange(view, from, to) {
  for (const range of view.state.selection.ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}
function toggleMarkdownStyle(marker) {
  return (view) => {
    const { state } = view;
    const { from, to, empty } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);
    const markerLen = marker.length;
    const beforeFrom = Math.max(0, from - markerLen);
    const afterTo = Math.min(state.doc.length, to + markerLen);
    const textBefore = state.sliceDoc(beforeFrom, from);
    const textAfter = state.sliceDoc(to, afterTo);
    const isWrapped = textBefore === marker && textAfter === marker;
    if (isWrapped) {
      view.dispatch({
        changes: [
          { from: beforeFrom, to: from, insert: "" },
          { from: to, to: afterTo, insert: "" }
        ],
        selection: { anchor: beforeFrom, head: beforeFrom + selectedText.length }
      });
    } else if (empty) {
      view.dispatch({
        changes: { from, to, insert: marker + marker },
        selection: { anchor: from + markerLen }
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: marker + selectedText + marker },
        selection: { anchor: from + markerLen, head: to + markerLen }
      });
    }
    return true;
  };
}
export {
  ThemeEnum,
  createTheme,
  cursorInRange,
  deepMerge,
  fixSelector,
  flattenThemeStyles,
  selectionOverlapsRange,
  toggleMarkdownStyle
};
