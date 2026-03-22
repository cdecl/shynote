import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const HEADING_TYPES = ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6"];
const headingMarkDecorations = {
  "heading-1": Decoration.mark({ class: "cm-draftly-h1" }),
  "heading-2": Decoration.mark({ class: "cm-draftly-h2" }),
  "heading-3": Decoration.mark({ class: "cm-draftly-h3" }),
  "heading-4": Decoration.mark({ class: "cm-draftly-h4" }),
  "heading-5": Decoration.mark({ class: "cm-draftly-h5" }),
  "heading-6": Decoration.mark({ class: "cm-draftly-h6" }),
  "header-mark-class": Decoration.mark({ class: "cm-draftly-header-mark" }),
  "heading-mark": Decoration.replace({})
};
const headingLineDecorations = {
  "heading-1": Decoration.line({ class: "cm-draftly-line-h1" }),
  "heading-2": Decoration.line({ class: "cm-draftly-line-h2" }),
  "heading-3": Decoration.line({ class: "cm-draftly-line-h3" }),
  "heading-4": Decoration.line({ class: "cm-draftly-line-h4" }),
  "heading-5": Decoration.line({ class: "cm-draftly-line-h5" }),
  "heading-6": Decoration.line({ class: "cm-draftly-line-h6" })
};
class HeadingPlugin extends DecorationPlugin {
  /**
   * Constructor - calls super constructor
   */
  constructor() {
    super();
    this.name = "heading";
    this.version = "1.0.0";
    this.decorationPriority = 10;
    this.requiredNodes = [
      "ATXHeading1",
      "ATXHeading2",
      "ATXHeading3",
      "ATXHeading4",
      "ATXHeading5",
      "ATXHeading6",
      "HeaderMark"
    ];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Build heading decorations by iterating the syntax tree
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (!HEADING_TYPES.includes(name)) {
          return;
        }
        const level = parseInt(name.slice(-1), 10);
        const headingClass = `heading-${level}`;
        const lineClass = `heading-${level}`;
        const line = view.state.doc.lineAt(from);
        decorations.push(headingLineDecorations[lineClass].range(line.from));
        decorations.push(headingMarkDecorations[headingClass].range(from, to));
        const headingMark = node.node.getChild("HeaderMark");
        if (headingMark) {
          const markEnd = Math.min(headingMark.to + 1, line.to);
          const cursorInNode = ctx.selectionOverlapsRange(from, to);
          if (!cursorInNode) {
            decorations.push(headingMarkDecorations["heading-mark"].range(headingMark.from, markEnd));
          } else {
            decorations.push(headingMarkDecorations["header-mark-class"].range(headingMark.from, markEnd));
          }
        }
      }
    });
  }
  renderToHTML(node, children) {
    if (node.name === "HeaderMark") {
      return "";
    }
    if (!HEADING_TYPES.includes(node.name)) {
      return null;
    }
    const level = parseInt(node.name.slice(-1), 10);
    const lineClass = headingLineDecorations[`heading-${level}`].spec.class;
    const headingClass = headingMarkDecorations[`heading-${level}`].spec.class;
    return `<div class="${lineClass}">
      <h${level} class="${headingClass}">${children}</h${level}>
    </div>
`;
  }
}
const theme = createTheme({
  default: {
    ".cm-draftly-h1": {
      fontSize: "2em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    ".cm-draftly-h2": {
      fontSize: "1.75em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    ".cm-draftly-h3": {
      fontSize: "1.5em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    ".cm-draftly-h4": {
      fontSize: "1.25em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    ".cm-draftly-h5": {
      fontSize: "1em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    ".cm-draftly-h6": {
      fontSize: "0.75em",
      fontWeight: "bold",
      fontFamily: "inherit",
      textDecoration: "none"
    },
    // Heading line styles
    ".cm-draftly-line-h1": {
      paddingTop: "1.5em",
      paddingBottom: "0.5em"
    },
    ".cm-draftly-line-h2": {
      paddingTop: "1.25em",
      paddingBottom: "0.5em"
    },
    ".cm-draftly-line-h3, .cm-draftly-line-h4, .cm-draftly-line-h5, .cm-draftly-line-h6": {
      paddingTop: "1em",
      paddingBottom: "0.5em"
    },
    ".cm-draftly-header-mark": {
      opacity: 0.5
    }
  }
});
export {
  HeadingPlugin
};
