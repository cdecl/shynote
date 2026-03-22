import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
import * as emoji from "node-emoji";
function shortcodeToEmoji(raw) {
  const rendered = emoji.emojify(raw);
  return rendered !== raw ? rendered : null;
}
class EmojiWidget extends WidgetType {
  constructor(rendered) {
    super();
    this.rendered = rendered;
  }
  eq(other) {
    return other.rendered === this.rendered;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-draftly-emoji";
    span.textContent = this.rendered;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}
const emojiMarkDecorations = {
  "emoji-source": Decoration.mark({ class: "cm-draftly-emoji-source" })
};
class EmojiPlugin extends DecorationPlugin {
  constructor() {
    super();
    this.name = "emoji";
    this.version = "1.0.0";
    this.decorationPriority = 20;
    this.requiredNodes = ["Emoji", "EmojiMark"];
  }
  /**
   * Plugin theme
   */
  get theme() {
    return theme;
  }
  /**
   * Build emoji decorations by iterating the syntax tree
   */
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name !== "Emoji") {
          return;
        }
        const raw = view.state.sliceDoc(from, to);
        const rendered = shortcodeToEmoji(raw);
        if (!rendered) {
          return;
        }
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (cursorInNode) {
          decorations.push(emojiMarkDecorations["emoji-source"].range(from, to));
          return;
        }
        decorations.push(
          Decoration.replace({
            widget: new EmojiWidget(rendered)
          }).range(from, to)
        );
      }
    });
  }
  renderToHTML(node, children, ctx) {
    if (node.name === "EmojiMark") {
      return "";
    }
    if (node.name !== "Emoji") {
      return null;
    }
    const raw = ctx.sliceDoc(node.from, node.to);
    const rendered = shortcodeToEmoji(raw);
    if (!rendered) {
      return `<span class="cm-draftly-emoji-source">${children}</span>`;
    }
    return `<span class="cm-draftly-emoji">${rendered}</span>`;
  }
}
const theme = createTheme({
  default: {
    ".cm-draftly-emoji": {
      fontFamily: "inherit",
      fontVariantEmoji: "emoji",
      lineHeight: "inherit"
    },
    ".cm-draftly-emoji-source": {
      fontFamily: "inherit",
      lineHeight: "inherit"
    }
  }
});
export {
  EmojiPlugin
};
