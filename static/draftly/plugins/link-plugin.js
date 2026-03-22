import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const linkMarkDecorations = {
  "link-text": Decoration.mark({ class: "cm-draftly-link-text" }),
  "link-marker": Decoration.mark({ class: "cm-draftly-link-marker" }),
  "link-url": Decoration.mark({ class: "cm-draftly-link-url" }),
  "link-hidden": Decoration.mark({ class: "cm-draftly-link-hidden" })
};
function parseLinkMarkdown(content) {
  const match = content.match(/^\[([^\]]*)\]\(([^"\s)]+)(?:\s+"([^"]*)")?\s*\)$/);
  if (!match) return null;
  const result = {
    text: match[1] || "",
    url: match[2]
  };
  if (match[3] !== void 0) {
    result.title = match[3];
  }
  return result;
}
class LinkTooltipWidget extends WidgetType {
  constructor(url, from, to) {
    super();
    this.url = url;
    this.from = from;
    this.to = to;
  }
  eq(other) {
    return other.url === this.url && other.from === this.from && other.to === this.to;
  }
  toDOM(view) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-draftly-link-wrapper";
    wrapper.style.cursor = "pointer";
    const tooltip = document.createElement("span");
    tooltip.className = "cm-draftly-link-tooltip";
    tooltip.textContent = this.url;
    wrapper.appendChild(tooltip);
    wrapper.addEventListener("mouseenter", () => {
      tooltip.classList.add("cm-draftly-link-tooltip-visible");
    });
    wrapper.addEventListener("mouseleave", () => {
      tooltip.classList.remove("cm-draftly-link-tooltip-visible");
    });
    wrapper.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        window.open(this.url, "_blank", "noopener,noreferrer");
      } else {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true
        });
        view.focus();
      }
    });
    return wrapper;
  }
  ignoreEvent(event) {
    return event.type !== "click" && event.type !== "mouseenter" && event.type !== "mouseleave";
  }
}
class LinkPlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "link";
    this.version = "1.0.0";
    this.decorationPriority = 22;
    this.requiredNodes = ["Link"];
    /**
     * URL regex pattern
     */
    this.urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Keyboard shortcuts for link formatting
   */
  getKeymap() {
    return [
      {
        key: "Mod-k",
        run: (view) => this.toggleLink(view),
        preventDefault: true
      }
    ];
  }
  /**
   * Toggle link on selection
   * - If text is selected and is a URL: [](url) with cursor in brackets
   * - If text is selected (not URL): [text]() with cursor in parentheses
   * - If nothing selected: []() with cursor in brackets
   * - If already a link: remove syntax, leave plain text
   */
  toggleLink(view) {
    const { state } = view;
    const { from, to, empty } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);
    const linkMatch = selectedText.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1] || "";
      view.dispatch({
        changes: { from, to, insert: linkText },
        selection: { anchor: from, head: from + linkText.length }
      });
      return true;
    }
    const lineStart = state.doc.lineAt(from).from;
    const lineEnd = state.doc.lineAt(to).to;
    const lineText = state.sliceDoc(lineStart, lineEnd);
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    let match;
    while ((match = linkRegex.exec(lineText)) !== null) {
      const matchFrom = lineStart + match.index;
      const matchTo = matchFrom + match[0].length;
      if (from >= matchFrom && to <= matchTo) {
        const linkText = match[1] || "";
        view.dispatch({
          changes: { from: matchFrom, to: matchTo, insert: linkText },
          selection: { anchor: matchFrom, head: matchFrom + linkText.length }
        });
        return true;
      }
    }
    if (empty) {
      view.dispatch({
        changes: { from, insert: "[]()" },
        selection: { anchor: from + 1 }
      });
    } else if (this.urlPattern.test(selectedText)) {
      const newText = `[](${selectedText})`;
      view.dispatch({
        changes: { from, to, insert: newText },
        selection: { anchor: from + 1 }
      });
    } else {
      const newText = `[${selectedText}]()`;
      view.dispatch({
        changes: { from, to, insert: newText },
        selection: { anchor: from + selectedText.length + 3 }
      });
    }
    return true;
  }
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name === "Link") {
          const content = view.state.sliceDoc(from, to);
          const parsed = parseLinkMarkdown(content);
          if (!parsed) return;
          const cursorInRange = ctx.selectionOverlapsRange(from, to);
          if (cursorInRange) {
            this.decorateRawLink(node.node, decorations, view);
          } else {
            decorations.push(linkMarkDecorations["link-hidden"].range(from, to));
            decorations.push(
              Decoration.widget({
                widget: new LinkTooltipWidget(parsed.url, from, to),
                side: 1
              }).range(to)
            );
            decorations.push(
              Decoration.replace({
                widget: new LinkTextWidget(parsed.text, parsed.url, from, to, parsed.title)
              }).range(from, to)
            );
          }
        }
      }
    });
  }
  /**
   * Decorate raw link markdown when cursor is in range
   */
  decorateRawLink(node, decorations, view) {
    const content = view.state.sliceDoc(node.from, node.to);
    decorations.push(linkMarkDecorations["link-marker"].range(node.from, node.from + 1));
    const bracketParen = content.indexOf("](");
    if (bracketParen !== -1) {
      if (bracketParen > 1) {
        decorations.push(linkMarkDecorations["link-text"].range(node.from + 1, node.from + bracketParen));
      }
      decorations.push(
        linkMarkDecorations["link-marker"].range(node.from + bracketParen, node.from + bracketParen + 2)
      );
      const urlChild = node.getChild("URL");
      if (urlChild) {
        decorations.push(linkMarkDecorations["link-url"].range(urlChild.from, urlChild.to));
      }
      decorations.push(linkMarkDecorations["link-marker"].range(node.to - 1, node.to));
    }
  }
  /**
   * Render link to HTML for preview mode
   */
  renderToHTML(node, _children, ctx) {
    if (node.name !== "Link") return null;
    const content = ctx.sliceDoc(node.from, node.to);
    const parsed = parseLinkMarkdown(content);
    if (!parsed) return null;
    const textContent = ctx.sanitize(parsed.text);
    const urlAttr = ctx.sanitize(parsed.url);
    const titleAttr = parsed.title ? ` title="${ctx.sanitize(parsed.title)}"` : "";
    return `<a class="cm-draftly-link" href="${urlAttr}"${titleAttr} target="_blank" rel="noopener noreferrer">${textContent}</a>`;
  }
}
class LinkTextWidget extends WidgetType {
  constructor(text, url, from, to, title) {
    super();
    this.text = text;
    this.url = url;
    this.from = from;
    this.to = to;
    this.title = title;
  }
  eq(other) {
    return other.text === this.text && other.url === this.url && other.from === this.from && other.to === this.to && other.title === this.title;
  }
  toDOM(view) {
    const span = document.createElement("span");
    span.className = "cm-draftly-link-styled";
    span.textContent = this.text;
    span.style.cursor = "pointer";
    if (this.title) {
      span.title = this.title;
    }
    const tooltip = document.createElement("span");
    tooltip.className = "cm-draftly-link-tooltip";
    tooltip.textContent = this.url;
    span.appendChild(tooltip);
    span.addEventListener("mouseenter", () => {
      tooltip.classList.add("cm-draftly-link-tooltip-visible");
    });
    span.addEventListener("mouseleave", () => {
      tooltip.classList.remove("cm-draftly-link-tooltip-visible");
    });
    span.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        window.open(this.url, "_blank", "noopener,noreferrer");
      } else {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true
        });
        view.focus();
      }
    });
    return span;
  }
  ignoreEvent(event) {
    return event.type !== "click" && event.type !== "mouseenter" && event.type !== "mouseleave";
  }
}
const theme = createTheme({
  default: {
    // Link text
    ".cm-draftly-link-text": {
      color: "#0366d6"
    },
    // Link markers ([ ] ( ))
    ".cm-draftly-link-marker": {
      color: "#6a737d",
      fontFamily: "inherit"
    },
    // URL in raw markdown
    ".cm-draftly-link-url": {
      color: "#6a737d",
      fontStyle: "italic"
    },
    // Hidden markdown syntax
    ".cm-draftly-link-hidden": {
      display: "none"
    },
    // Styled link when cursor is not in range
    ".cm-draftly-link-styled": {
      color: "#0366d6",
      textDecoration: "underline",
      position: "relative",
      cursor: "pointer"
    },
    ".cm-draftly-link-styled:hover": {
      color: "#0056b3"
    },
    // Preview link styling
    ".cm-draftly-link": {
      color: "#0366d6",
      textDecoration: "underline"
    },
    ".cm-draftly-link:hover": {
      color: "#0056b3"
    },
    // Tooltip styling
    ".cm-draftly-link-tooltip": {
      display: "none",
      position: "absolute",
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#24292e",
      color: "#ffffff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "inherit",
      whiteSpace: "nowrap",
      zIndex: "1000",
      pointerEvents: "none",
      marginBottom: "4px",
      maxWidth: "300px",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    ".cm-draftly-link-tooltip-visible": {
      display: "block"
    }
  },
  dark: {
    ".cm-draftly-link-text": {
      color: "#58a6ff"
    },
    ".cm-draftly-link-marker": {
      color: "#8b949e"
    },
    ".cm-draftly-link-url": {
      color: "#8b949e"
    },
    ".cm-draftly-link-styled": {
      color: "#58a6ff"
    },
    ".cm-draftly-link-styled:hover": {
      color: "#79c0ff"
    },
    ".cm-draftly-link": {
      color: "#58a6ff"
    },
    ".cm-draftly-link:hover": {
      color: "#79c0ff"
    },
    ".cm-draftly-link-tooltip": {
      backgroundColor: "#30363d",
      color: "#c9d1d9"
    }
  }
});
export {
  LinkPlugin
};
