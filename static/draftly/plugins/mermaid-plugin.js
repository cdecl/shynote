import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme, ThemeEnum } from "../editor/index.js";
import { tags } from "@lezer/highlight";
import mermaid from "mermaid";
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  suppressErrorRendering: true
});
let mermaidCounter = 0;
async function renderMermaid(definition, options = {}, defaultTheme = "default") {
  try {
    const id = `draftly-mermaid-${mermaidCounter++}`;
    let finalDefinition = definition;
    const mermaidConfig = {};
    if (options.theme) {
      mermaidConfig.theme = options.theme;
    } else {
      mermaidConfig.theme = defaultTheme;
    }
    if (Object.keys(mermaidConfig).length > 0) {
      const jsonConfig = JSON.stringify(mermaidConfig);
      finalDefinition = `%%{init: ${jsonConfig} }%%
${definition}`;
    }
    const { svg } = await mermaid.render(id, finalDefinition);
    return { svg, error: null };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return { svg: "", error: errorMsg };
  }
}
function parseAttributes(fenceLine) {
  const attributes = {};
  const regex = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(fenceLine)) !== null && match[1] && match[2]) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}
const mermaidMarkDecorations = {
  "mermaid-block-start": Decoration.line({ class: "cm-draftly-mermaid-block-start" }),
  "mermaid-block-end": Decoration.line({ class: "cm-draftly-mermaid-block-end" }),
  "mermaid-block": Decoration.line({ class: "cm-draftly-mermaid-block" }),
  "mermaid-block-rendered": Decoration.line({ class: "cm-draftly-mermaid-block-rendered" }),
  "mermaid-marker": Decoration.mark({ class: "cm-draftly-mermaid-marker" }),
  "mermaid-hidden": Decoration.mark({ class: "cm-draftly-mermaid-hidden" })
};
class MermaidBlockWidget extends WidgetType {
  constructor(definition, attributes, defaultTheme, from, to) {
    super();
    this.definition = definition;
    this.attributes = attributes;
    this.defaultTheme = defaultTheme;
    this.from = from;
    this.to = to;
  }
  eq(other) {
    return other.definition === this.definition && JSON.stringify(other.attributes) === JSON.stringify(this.attributes) && other.defaultTheme === this.defaultTheme && other.from === this.from && other.to === this.to;
  }
  toDOM(view) {
    const div = document.createElement("div");
    div.className = "cm-draftly-mermaid-rendered";
    div.style.cursor = "pointer";
    div.innerHTML = `<div class="cm-draftly-mermaid-loading">Rendering diagram\u2026</div>`;
    renderMermaid(this.definition, this.attributes, this.defaultTheme).then(({ svg, error }) => {
      if (error) {
        div.className += " cm-draftly-mermaid-error";
        div.innerHTML = `<span>[Mermaid Error: ${error}]</span>`;
      } else {
        div.innerHTML = svg;
      }
    });
    div.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true
      });
      view.focus();
    });
    return div;
  }
  ignoreEvent(event) {
    return event.type !== "click";
  }
}
const mermaidBlockParser = {
  name: "MermaidBlock",
  before: "FencedCode",
  parse(cx, line) {
    const text = line.text;
    const trimmed = text.slice(line.pos).trimStart();
    if (!trimmed.startsWith("```mermaid")) return false;
    const startLine = cx.lineStart;
    let endPos = -1;
    let closeBacktickStart = -1;
    while (cx.nextLine()) {
      const currentText = line.text;
      const currentLineStart = cx.lineStart;
      const lastLineEnd = currentLineStart + currentText.length;
      const trimmedLine = currentText.trim();
      if (trimmedLine === "```") {
        endPos = lastLineEnd;
        closeBacktickStart = currentLineStart + currentText.indexOf("```");
        cx.nextLine();
        break;
      }
    }
    if (endPos === -1) {
      return false;
    }
    const openMarkEnd = startLine + text.indexOf("```mermaid") + 10;
    const openMark = cx.elt("MermaidBlockMark", startLine, openMarkEnd);
    const closeMark = cx.elt("MermaidBlockMark", closeBacktickStart, closeBacktickStart + 3);
    cx.addElement(cx.elt("MermaidBlock", startLine, endPos, [openMark, closeMark]));
    return true;
  }
};
class MermaidPlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "mermaid";
    this.version = "1.0.0";
    this.decorationPriority = 25;
    this.requiredNodes = ["MermaidBlock", "MermaidBlockMark"];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Return markdown parser extensions for mermaid syntax
   */
  getMarkdownConfig() {
    return {
      defineNodes: [
        { name: "MermaidBlock", block: true },
        { name: "MermaidBlockMark", style: tags.processingInstruction }
      ],
      parseBlock: [mermaidBlockParser]
    };
  }
  /**
   * Build decorations for mermaid blocks
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    const config = this.context?.config;
    const currentTheme = config?.theme === ThemeEnum.DARK ? "dark" : "default";
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name === "MermaidBlock") {
          const content = view.state.sliceDoc(from, to);
          const lines = content.split("\n");
          const definition = lines.slice(1, -1).join("\n").trim();
          const docLines = content.split("\n");
          const fenceLine = docLines[0] || "";
          const attributes = parseAttributes(fenceLine);
          const nodeLineStart = view.state.doc.lineAt(from);
          const nodeLineEnd = view.state.doc.lineAt(to);
          const cursorInRange = ctx.selectionOverlapsRange(nodeLineStart.from, nodeLineEnd.to);
          const totalCodeLines = nodeLineEnd.number - nodeLineStart.number - 1;
          const lineNumWidth = String(totalCodeLines).length;
          let codeLineIndex = 1;
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            const isFenceLine = i === nodeLineStart.number || i === nodeLineEnd.number;
            const relativeLineNum = codeLineIndex;
            decorations.push(mermaidMarkDecorations["mermaid-block"].range(line.from));
            if (!cursorInRange) decorations.push(mermaidMarkDecorations["mermaid-block-rendered"].range(line.from));
            if (i === nodeLineStart.number)
              decorations.push(mermaidMarkDecorations["mermaid-block-start"].range(line.from));
            if (i === nodeLineEnd.number)
              decorations.push(mermaidMarkDecorations["mermaid-block-end"].range(line.from));
            if (!isFenceLine) {
              decorations.push(
                Decoration.line({
                  attributes: {
                    "data-line-num": String(relativeLineNum),
                    style: `--line-num-width: ${lineNumWidth}ch`
                  }
                }).range(line.from)
              );
            }
            if (!isFenceLine) {
              codeLineIndex++;
            }
          }
          decorations.push(
            Decoration.widget({
              widget: new MermaidBlockWidget(definition, attributes, currentTheme, from, to),
              side: 1,
              block: false
            }).range(to)
          );
          if (cursorInRange) {
            for (let child = node.node.firstChild; child; child = child.nextSibling) {
              if (child.name === "MermaidBlockMark") {
                decorations.push(mermaidMarkDecorations["mermaid-marker"].range(child.from, child.to));
              }
            }
          } else {
            decorations.push(mermaidMarkDecorations["mermaid-hidden"].range(from, to));
          }
        }
      }
    });
  }
  /**
   * Render mermaid to HTML for preview mode
   *
   * Renders the actual mermaid diagram to SVG HTML
   */
  async renderToHTML(node, _children, ctx) {
    if (node.name === "MermaidBlock") {
      const content = ctx.sliceDoc(node.from, node.to);
      const lines = content.split("\n");
      const definition = lines.length > 1 ? lines.slice(1, -1).join("\n").trim() : "";
      const fenceLine = lines[0] || "";
      const attributes = parseAttributes(fenceLine);
      const config = this.context?.config;
      const currentTheme = config?.theme === ThemeEnum.DARK ? "dark" : "default";
      const { svg, error } = await renderMermaid(definition, attributes, currentTheme);
      if (error) {
        return `<div class="cm-draftly-mermaid-error">${ctx.sanitize(`[Mermaid Error: ${error}]`)}</div>`;
      }
      return `<div class="cm-draftly-mermaid-rendered">${svg}</div>`;
    }
    if (node.name === "MermaidBlockMark") {
      return "";
    }
    return null;
  }
}
const theme = createTheme({
  default: {
    // Raw mermaid block lines (monospace)
    ".cm-draftly-mermaid-block:not(.cm-draftly-mermaid-block-rendered)": {
      "--radius": "0.375rem",
      position: "relative",
      fontFamily: "inherit",
      fontSize: "inherit",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      padding: "0 1rem !important",
      paddingLeft: "calc(var(--line-num-width, 2ch) + 1rem) !important",
      lineHeight: "1.5",
      borderLeft: "1px solid var(--color-border)",
      borderRight: "1px solid var(--color-border)"
    },
    ".cm-draftly-mermaid-block-start:not(.cm-draftly-mermaid-block-rendered)": {
      overflow: "hidden",
      borderTopLeftRadius: "var(--radius)",
      borderTopRightRadius: "var(--radius)",
      borderTop: "1px solid var(--color-border)"
    },
    ".cm-draftly-mermaid-block-end:not(.cm-draftly-mermaid-block-rendered)": {
      overflow: "hidden",
      borderBottomLeftRadius: "var(--radius)",
      borderBottomRightRadius: "var(--radius)",
      borderBottom: "1px solid var(--color-border)"
    },
    ".cm-draftly-mermaid-block:not(.cm-draftly-mermaid-block-rendered)::before": {
      content: "attr(data-line-num)",
      position: "absolute",
      left: "0.5rem",
      top: "0.2rem",
      width: "var(--line-num-width, 2ch)",
      textAlign: "right",
      color: "#6a737d",
      opacity: "0.6",
      fontFamily: "inherit",
      fontSize: "inherit",
      userSelect: "none"
    },
    ".cm-draftly-mermaid-block.cm-draftly-mermaid-block-rendered br": {
      display: "none"
    },
    // Mermaid markers (```mermaid / ```)
    ".cm-draftly-mermaid-marker": {
      color: "#6a737d",
      fontFamily: "inherit"
    },
    // Hidden mermaid syntax (when cursor is not in range)
    ".cm-draftly-mermaid-hidden": {
      display: "none"
    },
    // Rendered mermaid container
    ".cm-draftly-mermaid-rendered": {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "1em 0",
      borderRadius: "4px",
      overflow: "auto"
    },
    // SVG inside rendered container
    ".cm-draftly-mermaid-rendered svg": {
      maxWidth: "100%",
      height: "auto",
      aspectRatio: "auto"
    },
    // Loading state
    ".cm-draftly-mermaid-loading": {
      display: "inline-block",
      padding: "0.5em 1em",
      color: "#6a737d",
      fontSize: "inherit",
      fontStyle: "italic",
      fontFamily: "inherit"
    },
    // Error styling
    ".cm-draftly-mermaid-error": {
      display: "inline-block",
      padding: "0.25em 0.5em",
      backgroundColor: "rgba(255, 0, 0, 0.1)",
      color: "#d73a49",
      borderRadius: "4px",
      fontSize: "inherit",
      fontStyle: "italic",
      fontFamily: "inherit"
    }
  },
  dark: {
    ".cm-draftly-mermaid-block:not(.cm-draftly-mermaid-block-rendered)": {
      backgroundColor: "rgba(255, 255, 255, 0.03)"
    },
    ".cm-draftly-mermaid-marker": {
      color: "#8b949e"
    },
    ".cm-draftly-mermaid-loading": {
      color: "#8b949e"
    },
    ".cm-draftly-mermaid-error": {
      backgroundColor: "rgba(255, 0, 0, 0.15)",
      color: "#f85149"
    }
  }
});
export {
  MermaidPlugin
};
