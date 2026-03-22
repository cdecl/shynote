import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const quoteMarkDecorations = {
  /** Decoration for the > marker */
  "quote-mark": Decoration.replace({}),
  /** Decoration for the quote content */
  "quote-content": Decoration.mark({ class: "cm-draftly-quote-content" })
};
const quoteLineDecorations = {
  /** Decoration for blockquote lines */
  "quote-line": Decoration.line({ class: "cm-draftly-quote-line" })
};
class QuotePlugin extends DecorationPlugin {
  /**
   * Constructor - calls super constructor
   */
  constructor() {
    super();
    this.name = "quote";
    this.version = "1.0.0";
    this.decorationPriority = 10;
    this.requiredNodes = ["Blockquote", "QuoteMark"];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Build blockquote decorations by iterating the syntax tree
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name !== "Blockquote") {
          return;
        }
        const startLine = view.state.doc.lineAt(from);
        const endLine = view.state.doc.lineAt(to);
        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          decorations.push(quoteLineDecorations["quote-line"].range(line.from));
        }
        decorations.push(quoteMarkDecorations["quote-content"].range(from, to));
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (!cursorInNode) {
          this.hideQuoteMarks(node.node, decorations, view);
        }
      }
    });
  }
  /**
   * Recursively find and hide quote marks
   */
  hideQuoteMarks(node, decorations, view) {
    let child = node.firstChild;
    while (child) {
      if (child.name === "QuoteMark") {
        const line = view.state.doc.lineAt(child.from);
        const markEnd = Math.min(child.to + 1, line.to);
        decorations.push(quoteMarkDecorations["quote-mark"].range(child.from, markEnd));
      }
      if (child.name === "Blockquote") {
        this.hideQuoteMarks(child, decorations, view);
      }
      child = child.nextSibling;
    }
  }
  renderToHTML(node, children) {
    if (node.name === "QuoteMark") {
      return "";
    }
    if (node.name !== "Blockquote") {
      return null;
    }
    return `<blockquote class="cm-draftly-quote-line"><div class="cm-draftly-quote-content">${children}</div></blockquote>
`;
  }
}
const theme = createTheme({
  default: {
    // Line styling with left border
    ".cm-draftly-quote-line": {
      borderLeft: "3px solid currentColor",
      paddingLeft: "1em !important",
      paddingTop: "0.25em !important",
      paddingBottom: "0.25em !important",
      marginLeft: "0.25em",
      opacity: "0.85"
    },
    // Quote content styling
    ".cm-draftly-quote-content": {
      fontStyle: "italic"
    }
  }
});
export {
  QuotePlugin
};
