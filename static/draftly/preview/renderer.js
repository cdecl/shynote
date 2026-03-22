import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { ThemeEnum } from "../editor/utils.js";
import { createPreviewContext } from "./context.js";
import { defaultRenderers, escapeHtml } from "./default-renderers.js";
import { resolveSyntaxHighlighters } from "./syntax-theme.js";
class PreviewRenderer {
  constructor(doc, plugins = [], markdown2, theme = ThemeEnum.AUTO, sanitize = true, syntaxTheme) {
    this.doc = doc;
    this.theme = theme;
    this.plugins = plugins;
    this.markdown = markdown2;
    this.sanitizeHtml = sanitize;
    this.syntaxTheme = syntaxTheme;
    this.renderers = { ...defaultRenderers };
    const syntaxHighlighters = resolveSyntaxHighlighters(this.syntaxTheme, true);
    this.ctx = createPreviewContext(doc, theme, this.renderChildren.bind(this), sanitize, syntaxHighlighters);
    this.nodeToPlugins = this.buildNodePluginMap();
  }
  /**
   * Build a map from node names to plugins that handle them
   */
  buildNodePluginMap() {
    const map = /* @__PURE__ */ new Map();
    for (const plugin of this.plugins) {
      if (plugin.renderToHTML && plugin.requiredNodes.length > 0) {
        for (const nodeName of plugin.requiredNodes) {
          const list = map.get(nodeName) || [];
          list.push(plugin);
          map.set(nodeName, list);
        }
      }
    }
    return map;
  }
  /**
   * Render the document to HTML
   */
  async render() {
    const extensions = [
      ...this.markdown,
      ...this.plugins.map((p) => p.getMarkdownConfig()).filter((ext) => ext !== null)
    ];
    const markdownSupport = markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions,
      addKeymap: true,
      completeHTMLTags: true,
      pasteURLAsLink: true
    });
    const parser = markdownSupport.language.parser;
    const tree = parser.parse(this.doc);
    return await this.renderNode(tree.topNode);
  }
  /**
   * Render a single node to HTML
   */
  async renderNode(node) {
    const plugins = this.nodeToPlugins.get(node.name);
    if (plugins) {
      for (const plugin of plugins) {
        const children = await this.renderChildren(node);
        const result = await plugin.renderToHTML(node, children, this.ctx);
        if (result !== null) {
          return result;
        }
      }
    }
    const renderer = this.renderers[node.name];
    if (renderer) {
      const children = await this.renderChildren(node);
      return renderer(node, children, this.ctx);
    }
    if (node.firstChild) {
      return await this.renderChildren(node);
    }
    return this.ctx.sliceDoc(node.from, node.to);
  }
  /**
   * Render all children of a node, including text between nodes
   */
  async renderChildren(node) {
    let result = "";
    let pos = node.from;
    let child = node.firstChild;
    while (child) {
      if (child.from > pos) {
        result += escapeHtml(this.ctx.sliceDoc(pos, child.from));
      }
      result += await this.renderNode(child);
      pos = child.to;
      child = child.nextSibling;
    }
    if (pos < node.to) {
      result += escapeHtml(this.ctx.sliceDoc(pos, node.to));
    }
    return result;
  }
}
export {
  PreviewRenderer
};
