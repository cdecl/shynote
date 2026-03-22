import { DraftlyPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
class ParagraphPlugin extends DraftlyPlugin {
  constructor() {
    super(...arguments);
    this.name = "paragraph";
    this.version = "1.0.0";
    this.requiredNodes = ["Paragraph"];
  }
  /**
   * Plugin theme for preview styling
   */
  get theme() {
    return theme;
  }
  renderToHTML(node, children) {
    if (node.name !== "Paragraph") {
      return null;
    }
    return `<p class="cm-draftly-paragraph">${children}</p>`;
  }
}
const theme = createTheme({
  default: {
    ".cm-draftly-paragraph": {
      paddingTop: "0.5em",
      paddingBottom: "0.5em"
    }
  }
});
export {
  ParagraphPlugin
};
