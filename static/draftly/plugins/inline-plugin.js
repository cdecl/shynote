import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
import { toggleMarkdownStyle } from "../editor/utils.js";
import { tags } from "@lezer/highlight";
import { createWrapSelectionInputHandler } from "../lib.js";
const INLINE_TYPES = {
  Emphasis: "emphasis",
  StrongEmphasis: "strong",
  Strikethrough: "strikethrough",
  Subscript: "subscript",
  Superscript: "superscript",
  Highlight: "highlight"
};
const inlineMarkDecorations = {
  emphasis: Decoration.mark({ class: "cm-draftly-emphasis" }),
  strong: Decoration.mark({ class: "cm-draftly-strong" }),
  strikethrough: Decoration.mark({ class: "cm-draftly-strikethrough" }),
  subscript: Decoration.mark({ class: "cm-draftly-subscript" }),
  superscript: Decoration.mark({ class: "cm-draftly-superscript" }),
  highlight: Decoration.mark({ class: "cm-draftly-highlight" }),
  // Markers (* _ ~~ ^ ~ ==)
  "inline-mark": Decoration.replace({})
};
const EQUALS = 61;
let Punctuation = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~\xA1\u2010-\u2027]/;
try {
  Punctuation = new RegExp("[\\p{S}|\\p{P}]", "u");
} catch {
}
const HighlightDelim = { resolve: "Highlight", mark: "HighlightMark" };
const highlightParser = {
  name: "Highlight",
  parse(cx, next, pos) {
    if (next !== EQUALS || cx.char(pos + 1) !== EQUALS) return -1;
    if (cx.char(pos + 2) === EQUALS) return -1;
    const before = cx.slice(pos - 1, pos);
    const after = cx.slice(pos + 2, pos + 3);
    const sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after);
    const pBefore = Punctuation.test(before), pAfter = Punctuation.test(after);
    return cx.addDelimiter(
      HighlightDelim,
      pos,
      pos + 2,
      !sAfter && (!pAfter || sBefore || pBefore),
      !sBefore && (!pBefore || sAfter || pAfter)
    );
  }
};
class InlinePlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "inline";
    this.version = "1.0.0";
    this.decorationPriority = 20;
    this.requiredNodes = [
      "Emphasis",
      "StrongEmphasis",
      "Strikethrough",
      "Subscript",
      "Superscript",
      "Highlight",
      "EmphasisMark",
      "StrikethroughMark",
      "SubscriptMark",
      "SuperscriptMark",
      "HighlightMark"
    ];
    this.marks = [];
    for (const mark of Object.keys(INLINE_TYPES)) {
      this.marks.push(...this.getMarkerNames(mark));
    }
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Keyboard shortcuts for inline formatting
   */
  getKeymap() {
    return [
      {
        key: "Mod-b",
        run: toggleMarkdownStyle("**"),
        preventDefault: true
      },
      {
        key: "Mod-i",
        run: toggleMarkdownStyle("*"),
        preventDefault: true
      },
      {
        key: "Mod-Shift-s",
        run: toggleMarkdownStyle("~~"),
        preventDefault: true
      },
      {
        key: "Mod-,",
        run: toggleMarkdownStyle("~"),
        preventDefault: true
      },
      {
        key: "Mod-.",
        run: toggleMarkdownStyle("^"),
        preventDefault: true
      },
      {
        key: "Mod-Shift-h",
        run: toggleMarkdownStyle("=="),
        preventDefault: true
      }
    ];
  }
  /**
   * Intercepts inline marker typing to wrap selected text.
   *
   * If user types inline markers while text is selected, wraps each selected
   * range with the appropriate marker:
   * - * _ ~ ^ -> marker + selected + marker
   * - = -> ==selected==
   */
  getExtensions() {
    return [createWrapSelectionInputHandler({ "*": "*", _: "_", "~": "~", "^": "^", "=": "==" })];
  }
  /**
   * Return markdown parser extensions for highlight syntax (==text==)
   */
  getMarkdownConfig() {
    return {
      defineNodes: [
        { name: "Highlight", style: tags.emphasis },
        { name: "HighlightMark", style: tags.processingInstruction }
      ],
      parseInline: [highlightParser]
    };
  }
  /**
   * Build inline decorations by iterating the syntax tree
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        const inlineType = INLINE_TYPES[name];
        if (!inlineType) {
          return;
        }
        decorations.push(inlineMarkDecorations[inlineType].range(from, to));
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (!cursorInNode) {
          const markerNames = this.getMarkerNames(name);
          for (const markerName of markerNames) {
            const marks = node.node.getChildren(markerName);
            for (const mark of marks) {
              decorations.push(inlineMarkDecorations["inline-mark"].range(mark.from, mark.to));
            }
          }
        }
      }
    });
  }
  /**
   * Get the marker node names for a given inline type
   */
  getMarkerNames(nodeType) {
    switch (nodeType) {
      case "Emphasis":
      case "StrongEmphasis":
        return ["EmphasisMark"];
      case "Strikethrough":
        return ["StrikethroughMark"];
      case "Subscript":
        return ["SubscriptMark"];
      case "Superscript":
        return ["SuperscriptMark"];
      case "Highlight":
        return ["HighlightMark"];
      default:
        return [];
    }
  }
  renderToHTML(node, children) {
    if (this.marks.includes(node.name)) {
      return "";
    }
    const inlineType = INLINE_TYPES[node.name];
    if (!inlineType) {
      return null;
    }
    const className = inlineMarkDecorations[inlineType].spec.class;
    return `<span class="${className}">${children}</span>`;
  }
}
const theme = createTheme({
  default: {
    // Emphasis (italic)
    ".cm-draftly-emphasis": {
      fontStyle: "italic"
    },
    // Strong (bold)
    ".cm-draftly-strong": {
      fontWeight: "bold"
    },
    // Strikethrough
    ".cm-draftly-strikethrough": {
      textDecoration: "line-through",
      opacity: "0.7"
    },
    // Subscript
    ".cm-draftly-subscript": {
      fontSize: "inherit",
      verticalAlign: "sub"
    },
    // Superscript
    ".cm-draftly-superscript": {
      fontSize: "inherit",
      verticalAlign: "super"
    },
    // Highlight
    ".cm-draftly-highlight": {
      backgroundColor: "rgba(255, 213, 0, 0.35)",
      borderRadius: "2px",
      padding: "1px 2px"
    }
  }
});
export {
  InlinePlugin
};
