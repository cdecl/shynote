import { EditorView, ViewPlugin } from "@codemirror/view";
import { Facet, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { cursorInRange, selectionOverlapsRange, ThemeEnum } from "./utils.js";
import { draftlyBaseTheme } from "./theme.js";
const DraftlyPluginsFacet = Facet.define({
  combine: (values) => values.flat()
});
const draftlyOnNodesChangeFacet = Facet.define({
  combine: (values) => values.find((v) => v !== void 0)
});
const draftlyThemeFacet = Facet.define({
  combine: (values) => values.find((v) => v !== void 0) || ThemeEnum.AUTO
});
function buildDecorations(view, plugins = []) {
  const builder = new RangeSetBuilder();
  const decorations = [];
  if (plugins.length > 0) {
    const ctx = {
      view,
      decorations,
      selectionOverlapsRange: (from, to) => selectionOverlapsRange(view, from, to),
      cursorInRange: (from, to) => cursorInRange(view, from, to)
    };
    const sortedPlugins = [...plugins].sort((a, b) => a.decorationPriority - b.decorationPriority);
    for (const plugin of sortedPlugins) {
      try {
        plugin.buildDecorations(ctx);
      } catch {
      }
    }
  }
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  for (const decoration of decorations) {
    builder.add(decoration.from, decoration.to, decoration.value);
  }
  return builder.finish();
}
class draftlyViewPluginClass {
  constructor(view) {
    this.plugins = view.state.facet(DraftlyPluginsFacet);
    this.onNodesChange = view.state.facet(draftlyOnNodesChangeFacet);
    this.decorations = buildDecorations(view, this.plugins);
    for (const plugin of this.plugins) {
      plugin.onViewReady(view);
    }
    if (this.onNodesChange && typeof this.onNodesChange === "function") {
      this.onNodesChange(this.buildNodes(view));
    }
  }
  update(update) {
    this.plugins = update.view.state.facet(DraftlyPluginsFacet);
    this.onNodesChange = update.view.state.facet(draftlyOnNodesChangeFacet);
    for (const plugin of this.plugins) {
      plugin.onViewUpdate(update);
    }
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildDecorations(update.view, this.plugins);
      if (this.onNodesChange) {
        this.onNodesChange(this.buildNodes(update.view));
      }
    }
  }
  buildNodes(view) {
    const tree = syntaxTree(view.state);
    const roots = [];
    const stack = [];
    tree.iterate({
      enter: (nodeRef) => {
        const node = {
          from: nodeRef.from,
          to: nodeRef.to,
          name: nodeRef.name,
          children: [],
          isSelected: selectionOverlapsRange(view, nodeRef.from, nodeRef.to)
        };
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else {
          roots.push(node);
        }
        stack.push(node);
      },
      leave: () => {
        stack.pop();
      }
    });
    return roots;
  }
}
const draftlyViewPlugin = ViewPlugin.fromClass(draftlyViewPluginClass, {
  decorations: (v) => v.decorations,
  provide: () => []
});
const draftlyEditorClass = EditorView.editorAttributes.of({ class: "cm-draftly" });
function createDraftlyViewExtension(theme = ThemeEnum.AUTO, baseStyles = true, plugins = [], onNodesChange) {
  return [
    draftlyEditorClass,
    DraftlyPluginsFacet.of(plugins),
    draftlyOnNodesChangeFacet.of(onNodesChange),
    draftlyThemeFacet.of(theme),
    draftlyViewPlugin,
    ...baseStyles ? [draftlyBaseTheme] : []
  ];
}
export {
  DraftlyPluginsFacet,
  createDraftlyViewExtension,
  draftlyOnNodesChangeFacet,
  draftlyThemeFacet,
  draftlyViewPlugin
};
