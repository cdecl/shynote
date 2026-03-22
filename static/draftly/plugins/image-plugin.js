import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const imageMarkDecorations = {
  "image-block": Decoration.line({ class: "cm-draftly-image-block" }),
  "image-marker": Decoration.mark({ class: "cm-draftly-image-marker" }),
  "image-alt": Decoration.mark({ class: "cm-draftly-image-alt" }),
  "image-url": Decoration.mark({ class: "cm-draftly-image-url" }),
  "image-hidden": Decoration.mark({ class: "cm-draftly-image-hidden" })
};
function parseImageMarkdown(content) {
  const match = content.match(/^!\[([^\]]*)\]\(([^"\s)]+)(?:\s+"([^"]*)")?\s*\)$/);
  if (!match) return null;
  const result = {
    alt: match[1] || "",
    url: match[2]
  };
  if (match[3] !== void 0) {
    result.title = match[3];
  }
  return result;
}
class ImageWidget extends WidgetType {
  constructor(url, alt, from, to, title) {
    super();
    this.url = url;
    this.alt = alt;
    this.from = from;
    this.to = to;
    this.title = title;
  }
  eq(other) {
    return other.url === this.url && other.alt === this.alt && other.from === this.from && other.to === this.to && other.title === this.title;
  }
  toDOM(view) {
    const figure = document.createElement("figure");
    figure.className = "cm-draftly-image-figure";
    figure.setAttribute("role", "figure");
    figure.style.cursor = "pointer";
    if (this.title) {
      figure.setAttribute("aria-label", this.title);
    }
    figure.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true
      });
      view.focus();
    });
    const img = document.createElement("img");
    img.className = "cm-draftly-image";
    img.src = this.url;
    img.alt = this.alt;
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    if (this.title) {
      img.title = this.title;
    }
    img.onerror = () => {
      img.style.display = "none";
      const errorSpan = document.createElement("span");
      errorSpan.className = "cm-draftly-image-error";
      errorSpan.setAttribute("role", "alert");
      errorSpan.textContent = `[Image not found: ${this.alt || this.url}]`;
      figure.appendChild(errorSpan);
    };
    figure.appendChild(img);
    if (this.title) {
      const figcaption = document.createElement("figcaption");
      figcaption.className = "cm-draftly-image-caption";
      figcaption.textContent = this.title;
      figure.appendChild(figcaption);
    }
    return figure;
  }
  ignoreEvent(event) {
    return event.type !== "click";
  }
}
class ImagePlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "image";
    this.version = "1.0.0";
    this.decorationPriority = 25;
    this.requiredNodes = ["Image"];
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
   * Keyboard shortcuts for image formatting
   */
  getKeymap() {
    return [
      {
        key: "Mod-Shift-i",
        run: (view) => this.toggleImage(view),
        preventDefault: true
      }
    ];
  }
  /**
   * Toggle image on selection
   * - If text selected and is a URL: ![Alt Text](url) with cursor in brackets
   * - If text selected (not URL): ![text]() with cursor in parentheses
   * - If nothing selected: ![Alt Text]() with cursor in parentheses
   * - If already an image: remove syntax, leave just the URL
   */
  toggleImage(view) {
    const { state } = view;
    const { from, to, empty } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);
    const imageMatch = selectedText.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
    if (imageMatch) {
      const imageUrl = imageMatch[2] || "";
      view.dispatch({
        changes: { from, to, insert: imageUrl },
        selection: { anchor: from, head: from + imageUrl.length }
      });
      return true;
    }
    const lineStart = state.doc.lineAt(from).from;
    const lineEnd = state.doc.lineAt(to).to;
    const lineText = state.sliceDoc(lineStart, lineEnd);
    const imageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
    let match;
    while ((match = imageRegex.exec(lineText)) !== null) {
      const matchFrom = lineStart + match.index;
      const matchTo = matchFrom + match[0].length;
      if (from >= matchFrom && to <= matchTo) {
        const imageUrl = match[2] || "";
        view.dispatch({
          changes: { from: matchFrom, to: matchTo, insert: imageUrl },
          selection: { anchor: matchFrom, head: matchFrom + imageUrl.length }
        });
        return true;
      }
    }
    if (empty) {
      const defaultAlt = "Alt Text";
      const newText = `![${defaultAlt}]()`;
      view.dispatch({
        changes: { from, insert: newText },
        selection: { anchor: from + defaultAlt.length + 4 }
        // After ![Alt Text](
      });
    } else if (this.urlPattern.test(selectedText)) {
      const defaultAlt = "Alt Text";
      const newText = `![${defaultAlt}](${selectedText})`;
      view.dispatch({
        changes: { from, to, insert: newText },
        selection: { anchor: from + 2, head: from + 2 + defaultAlt.length }
        // Select "Alt Text"
      });
    } else {
      const newText = `![${selectedText}]()`;
      view.dispatch({
        changes: { from, to, insert: newText },
        selection: { anchor: from + selectedText.length + 4 }
        // After ![text](
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
        if (name === "Image") {
          const content = view.state.sliceDoc(from, to);
          const parsed = parseImageMarkdown(content);
          if (!parsed) return;
          const cursorInRange = ctx.selectionOverlapsRange(from, to);
          decorations.push(imageMarkDecorations["image-block"].range(from));
          decorations.push(
            Decoration.widget({
              widget: new ImageWidget(parsed.url, parsed.alt, from, to, parsed.title),
              side: 1,
              // Place after the position
              block: false
              // Don't create a new line
            }).range(to)
          );
          if (cursorInRange) {
            this.decorateRawImage(node.node, decorations, view);
          } else {
            decorations.push(imageMarkDecorations["image-hidden"].range(from, to));
          }
        }
      }
    });
  }
  /**
   * Decorate raw image markdown when cursor is in range
   */
  decorateRawImage(node, decorations, view) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "URL") {
        decorations.push(imageMarkDecorations["image-url"].range(child.from, child.to));
      }
    }
    const content = view.state.sliceDoc(node.from, node.to);
    const bangBracket = node.from;
    if (content.startsWith("![")) {
      decorations.push(imageMarkDecorations["image-marker"].range(bangBracket, bangBracket + 2));
    }
    const altEnd = content.indexOf("](");
    if (altEnd !== -1) {
      const altStart = 2;
      if (altEnd > altStart) {
        decorations.push(imageMarkDecorations["image-alt"].range(node.from + altStart, node.from + altEnd));
      }
      decorations.push(imageMarkDecorations["image-marker"].range(node.from + altEnd, node.from + altEnd + 2));
      decorations.push(imageMarkDecorations["image-marker"].range(node.to - 1, node.to));
    }
  }
  /**
   * Render image to HTML for preview mode using figure/figcaption
   */
  renderToHTML(node, _children, ctx) {
    if (node.name !== "Image") return null;
    const content = ctx.sliceDoc(node.from, node.to);
    const parsed = parseImageMarkdown(content);
    if (!parsed) return null;
    const altAttr = ctx.sanitize(parsed.alt);
    const titleAttr = parsed.title ? ` title="${ctx.sanitize(parsed.title)}"` : "";
    const ariaLabel = parsed.title ? ` aria-label="${ctx.sanitize(parsed.title)}"` : "";
    let html = `<figure class="cm-draftly-image-figure" role="figure"${ariaLabel}>`;
    html += `<img class="cm-draftly-image" src="${ctx.sanitize(parsed.url)}" alt="${altAttr}"${titleAttr} loading="lazy" decoding="async" />`;
    if (parsed.title) {
      html += `<figcaption class="cm-draftly-image-caption">${ctx.sanitize(parsed.title)}</figcaption>`;
    }
    html += `</figure>`;
    return html;
  }
}
const theme = createTheme({
  default: {
    ".cm-draftly-image-block br": {
      display: "none"
    },
    // Image markers (! [ ] ( ))
    ".cm-draftly-image-marker": {
      color: "#6a737d",
      fontFamily: "inherit"
    },
    // Alt text
    ".cm-draftly-image-alt": {
      color: "#22863a",
      fontStyle: "italic"
    },
    // URL
    ".cm-draftly-image-url": {
      color: "#0366d6",
      textDecoration: "underline"
    },
    // Hidden markdown syntax (when cursor is not in range)
    ".cm-draftly-image-hidden": {
      display: "none"
    },
    // Figure container
    ".cm-draftly-image-figure": {
      display: "flex",
      flexDirection: "column",
      alignItems: "start",
      maxWidth: "100%",
      padding: "0"
    },
    // Image element
    ".cm-draftly-image": {
      maxWidth: "100%",
      maxHeight: "800px",
      height: "auto",
      borderRadius: "4px"
    },
    // Figcaption
    ".cm-draftly-image-caption": {
      display: "block",
      width: "100%",
      fontSize: "inherit",
      color: "#6a737d",
      marginTop: "0.5em",
      textAlign: "center",
      fontStyle: "italic"
    },
    // Error state
    ".cm-draftly-image-error": {
      display: "inline-block",
      padding: "0.5em 1em",
      backgroundColor: "rgba(255, 0, 0, 0.1)",
      color: "#d73a49",
      borderRadius: "4px",
      fontSize: "inherit",
      fontStyle: "italic"
    }
  },
  dark: {
    ".cm-draftly-image-marker": {
      color: "#8b949e"
    },
    ".cm-draftly-image-alt": {
      color: "#7ee787"
    },
    ".cm-draftly-image-url": {
      color: "#58a6ff"
    },
    ".cm-draftly-image-caption": {
      color: "#8b949e"
    },
    ".cm-draftly-image-error": {
      backgroundColor: "rgba(255, 0, 0, 0.15)",
      color: "#f85149"
    }
  }
});
export {
  ImagePlugin
};
