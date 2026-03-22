import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const hrLineDecoration = Decoration.line({ class: "cm-draftly-hr-line" });
const hrMarkDecoration = Decoration.replace({});
class HRPlugin extends DecorationPlugin {
  /**
   * Constructor - calls super constructor
   */
  constructor() {
    super();
    this.name = "hr";
    this.version = "1.0.0";
    this.decorationPriority = 10;
    this.requiredNodes = ["HorizontalRule"];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Build horizontal rule decorations by iterating the syntax tree
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name !== "HorizontalRule") {
          return;
        }
        const line = view.state.doc.lineAt(from);
        decorations.push(hrLineDecoration.range(line.from));
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (!cursorInNode) {
          const markEnd = Math.min(to, line.to);
          decorations.push(hrMarkDecoration.range(from, markEnd));
        }
      }
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderToHTML(node, _children) {
    if (node.name !== "HorizontalRule") {
      return null;
    }
    return `<hr class="cm-draftly-hr-line" />
`;
  }
}
const theme = createTheme({
  default: {
    // Line styling — displays a centered horizontal line
    ".cm-draftly-hr-line": {
      display: "flex",
      alignItems: "center",
      paddingTop: "0.75em",
      paddingBottom: "0.75em",
      border: "none",
      "&::after": {
        content: '""',
        flex: "1",
        height: "2px",
        background: "currentColor",
        opacity: "0.3"
      }
    }
  }
});
export {
  HRPlugin
};
