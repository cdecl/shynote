import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
import { tags } from "@lezer/highlight";
import katex from "katex";
import { createWrapSelectionInputHandler } from "../lib.js";
function injectKatexStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-draftly-katex="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/static/draftly/katex.min.css";
  link.setAttribute("data-draftly-katex", "true");
  document.head.appendChild(link);
}
injectKatexStyles();
const DOLLAR = 36;
const mathMarkDecorations = {
  "math-block": Decoration.line({ class: "cm-draftly-math-block" }),
  "math-inline": Decoration.mark({ class: "cm-draftly-math-inline" }),
  "math-marker": Decoration.mark({ class: "cm-draftly-math-marker" }),
  "math-hidden": Decoration.mark({ class: "cm-draftly-math-hidden" })
};
function renderMath(latex, displayMode) {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: "#d73a49",
      trust: false,
      strict: false
    });
    return { html, error: null };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return { html: "", error: errorMsg };
  }
}
class InlineMathWidget extends WidgetType {
  constructor(latex, from, to) {
    super();
    this.latex = latex;
    this.from = from;
    this.to = to;
  }
  eq(other) {
    return other.latex === this.latex && other.from === this.from && other.to === this.to;
  }
  toDOM(view) {
    const span = document.createElement("span");
    span.className = "cm-draftly-math-rendered cm-draftly-math-rendered-inline";
    span.style.cursor = "pointer";
    const { html, error } = renderMath(this.latex, false);
    if (error) {
      span.className += " cm-draftly-math-error";
      span.textContent = `[Math Error: ${error}]`;
    } else {
      span.innerHTML = html;
    }
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true
      });
      view.focus();
    });
    return span;
  }
  ignoreEvent(event) {
    return event.type !== "click";
  }
}
class MathBlockWidget extends WidgetType {
  constructor(latex, from, to) {
    super();
    this.latex = latex;
    this.from = from;
    this.to = to;
  }
  eq(other) {
    return other.latex === this.latex && other.from === this.from && other.to === this.to;
  }
  toDOM(view) {
    const div = document.createElement("div");
    div.className = "cm-draftly-math-rendered cm-draftly-math-rendered-block";
    div.style.cursor = "pointer";
    const { html, error } = renderMath(this.latex, true);
    if (error) {
      div.className += " cm-draftly-math-error";
      div.textContent = `[Math Error: ${error}]`;
    } else {
      div.innerHTML = html;
    }
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
const inlineMathParser = {
  name: "InlineMath",
  parse(cx, next, pos) {
    if (next !== DOLLAR) return -1;
    if (cx.char(pos + 1) === DOLLAR) return -1;
    let end = pos + 1;
    while (end < cx.end) {
      const char = cx.char(end);
      if (char === DOLLAR) {
        if (cx.char(end + 1) !== DOLLAR) {
          const content = cx.slice(pos + 1, end);
          if (content.trim().length === 0) return -1;
          const openMark = cx.elt("InlineMathMark", pos, pos + 1);
          const closeMark = cx.elt("InlineMathMark", end, end + 1);
          const inlineMath = cx.elt("InlineMath", pos, end + 1, [openMark, closeMark]);
          return cx.addElement(inlineMath);
        }
        return -1;
      }
      if (char === 92) {
        end += 2;
        continue;
      }
      end++;
    }
    return -1;
  }
};
const mathBlockParser = {
  name: "MathBlock",
  parse(cx, line) {
    const text = line.text;
    const trimmed = text.slice(line.pos).trimStart();
    if (!trimmed.startsWith("$$")) return false;
    const startLine = cx.lineStart;
    let endPos = -1;
    let lastLineEnd = startLine + line.text.length;
    while (cx.nextLine()) {
      const currentText = line.text;
      lastLineEnd = cx.lineStart + currentText.length;
      if (currentText.trimEnd().endsWith("$$")) {
        endPos = lastLineEnd;
        cx.nextLine();
        break;
      }
    }
    if (endPos === -1) {
      return false;
    }
    const openMark = cx.elt("MathBlockMark", startLine, startLine + text.indexOf("$$") + 2);
    const closeMark = cx.elt("MathBlockMark", endPos - 2, endPos);
    cx.addElement(cx.elt("MathBlock", startLine, endPos, [openMark, closeMark]));
    return true;
  }
};
class MathPlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "math";
    this.version = "1.0.0";
    this.decorationPriority = 25;
    this.requiredNodes = ["InlineMath", "MathBlock", "InlineMathMark", "MathBlockMark"];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Intercepts dollar typing to wrap selected text as inline math.
   *
   * If user types '$' while text is selected, wraps each selected range
   * with single dollars (selected -> $selected$).
   */
  getExtensions() {
    return [createWrapSelectionInputHandler({ "$": "$" })];
  }
  /**
   * Return markdown parser extensions for math syntax
   */
  getMarkdownConfig() {
    return {
      defineNodes: [
        { name: "InlineMath", style: tags.emphasis },
        { name: "InlineMathMark", style: tags.processingInstruction },
        { name: "MathBlock", block: true },
        { name: "MathBlockMark", style: tags.processingInstruction }
      ],
      parseInline: [inlineMathParser],
      parseBlock: [mathBlockParser]
    };
  }
  /**
   * Build decorations for math expressions
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name === "InlineMath") {
          const content = view.state.sliceDoc(from, to);
          const latex = content.slice(1, -1);
          const cursorInRange = ctx.selectionOverlapsRange(from, to);
          if (cursorInRange) {
            decorations.push(mathMarkDecorations["math-inline"].range(from, to));
            for (let child = node.node.firstChild; child; child = child.nextSibling) {
              if (child.name === "InlineMathMark") {
                decorations.push(mathMarkDecorations["math-marker"].range(child.from, child.to));
              }
            }
          } else {
            decorations.push(
              Decoration.replace({
                widget: new InlineMathWidget(latex, from, to)
              }).range(from, to)
            );
          }
        }
        if (name === "MathBlock") {
          const content = view.state.sliceDoc(from, to);
          const lines = content.split("\n");
          const latex = lines.slice(1, -1).join("\n").trim();
          const singleLine = !content.includes("\n");
          const latexContent = singleLine ? content.slice(2, -2).trim() : latex;
          const nodeLineStart = view.state.doc.lineAt(from);
          const nodeLineEnd = view.state.doc.lineAt(to);
          const cursorInRange = ctx.selectionOverlapsRange(nodeLineStart.from, nodeLineEnd.to);
          decorations.push(mathMarkDecorations["math-block"].range(from));
          decorations.push(
            Decoration.widget({
              widget: new MathBlockWidget(latexContent, from, to),
              side: 1,
              block: false
            }).range(to)
          );
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            decorations.push(mathMarkDecorations["math-block"].range(line.from));
          }
          if (cursorInRange) {
            for (let child = node.node.firstChild; child; child = child.nextSibling) {
              if (child.name === "MathBlockMark") {
                decorations.push(mathMarkDecorations["math-marker"].range(child.from, child.to));
              }
            }
          } else {
            decorations.push(mathMarkDecorations["math-hidden"].range(from, to));
          }
        }
      }
    });
  }
  /**
   * Render math to HTML for preview mode
   */
  renderToHTML(node, _children, ctx) {
    if (node.name === "InlineMath") {
      const content = ctx.sliceDoc(node.from, node.to);
      const latex = content.slice(1, -1);
      const { html, error } = renderMath(latex, false);
      if (error) {
        return `<span class="cm-draftly-math-error">[Math Error: ${ctx.sanitize(error)}]</span>`;
      }
      return `<span class="cm-draftly-math-rendered cm-draftly-math-rendered-inline">${html}</span>`;
    }
    if (node.name === "MathBlock") {
      const content = ctx.sliceDoc(node.from, node.to);
      const lines = content.split("\n");
      const latex = lines.length > 1 ? lines.slice(1, -1).join("\n").trim() : content.slice(2, -2).trim();
      const { html, error } = renderMath(latex, true);
      if (error) {
        return `<div class="cm-draftly-math-error">[Math Error: ${ctx.sanitize(error)}]</div>`;
      }
      return `<div class="cm-draftly-math-rendered cm-draftly-math-rendered-block">${html}</div>`;
    }
    if (node.name === "InlineMathMark" || node.name === "MathBlockMark") {
      return "";
    }
    return null;
  }
}
const theme = createTheme({
  default: {
    ".cm-draftly-math-block": {
      fontFamily: "inherit"
    },
    ".cm-draftly-math-block br": {
      display: "none"
    },
    // Math markers ($ $$)
    ".cm-draftly-math-marker": {
      color: "#6a737d",
      fontFamily: "inherit"
    },
    // Inline math styling when editing
    ".cm-draftly-math-inline": {
      fontFamily: "inherit",
      fontSize: "inherit"
    },
    // Hidden math syntax (when cursor is not in range)
    ".cm-draftly-math-hidden": {
      display: "none"
    },
    // Hidden line (for multi-line blocks)
    ".cm-draftly-hidden-line": {
      display: "none"
    },
    // Rendered math container (both inline and block)
    ".cm-draftly-math-rendered": {
      fontFamily: "inherit"
    },
    // Inline rendered math
    ".cm-draftly-math-rendered-inline": {
      display: "inline",
      verticalAlign: "baseline"
    },
    // Block rendered math (display mode)
    ".cm-draftly-math-rendered-block": {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "1em 0",
      backgroundColor: "rgba(0, 0, 0, 0.02)",
      borderRadius: "4px",
      overflow: "auto"
    },
    // Math error styling
    ".cm-draftly-math-error": {
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
    ".cm-draftly-math-marker": {
      color: "#8b949e"
    },
    ".cm-draftly-math-rendered-block": {
      backgroundColor: "rgba(255, 255, 255, 0.02)"
    },
    ".cm-draftly-math-error": {
      backgroundColor: "rgba(255, 0, 0, 0.15)",
      color: "#f85149"
    }
  }
});
export {
  MathPlugin
};
