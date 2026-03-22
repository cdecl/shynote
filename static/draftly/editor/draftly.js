import { Prec } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { createDraftlyViewExtension } from "./view-plugin.js";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { ThemeEnum } from "./utils.js";
import { markdownResetExtension } from "./theme.js";
function draftly(config = {}) {
  const {
    theme: configTheme = ThemeEnum.AUTO,
    baseStyles = true,
    plugins = [],
    extensions = [],
    keymap: configKeymap = [],
    disableViewPlugin = false,
    defaultKeybindings = true,
    history: configHistory = true,
    indentWithTab: configIndentWithTab = true,
    highlightActiveLine: configHighlightActiveLine = true,
    lineWrapping: configLineWrapping = true,
    onNodesChange: configOnNodesChange = void 0
  } = config;
  const allPlugins = [...plugins];
  const pluginExtensions = [];
  const pluginKeymaps = [];
  const markdownExtensions = [];
  const pluginContext = { config };
  if (!disableViewPlugin) {
    for (const plugin of allPlugins) {
      plugin.onRegister(pluginContext);
      const exts = plugin.getExtensions();
      if (exts.length > 0) {
        pluginExtensions.push(...exts);
      }
      const keys = plugin.getKeymap();
      if (keys.length > 0) {
        pluginKeymaps.push(...keys);
      }
      const theme = plugin.theme;
      if (baseStyles && theme && typeof theme === "function") {
        pluginExtensions.push(EditorView.theme(theme(configTheme)));
      }
      const md = plugin.getMarkdownConfig();
      if (md) {
        markdownExtensions.push(md);
      }
    }
  }
  if (config.markdown) {
    markdownExtensions.push(...config.markdown);
  }
  const markdownSupport = markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    extensions: markdownExtensions,
    addKeymap: true,
    completeHTMLTags: true,
    pasteURLAsLink: true
  });
  const baseExtensions = [
    ...defaultKeybindings ? [keymap.of(defaultKeymap)] : [],
    ...configHistory ? [history(), keymap.of(historyKeymap)] : [],
    ...configIndentWithTab ? [indentOnInput(), keymap.of([indentWithTab])] : [],
    ...configHighlightActiveLine && disableViewPlugin ? [highlightActiveLine()] : []
  ];
  const draftlyExtensions = [];
  if (!disableViewPlugin) {
    draftlyExtensions.push(createDraftlyViewExtension(configTheme, baseStyles, allPlugins, configOnNodesChange));
    draftlyExtensions.push(Prec.highest(markdownResetExtension));
  }
  if (!disableViewPlugin || configLineWrapping) draftlyExtensions.push(EditorView.lineWrapping);
  const composedExtensions = [
    // Core markdown support (highest priority)
    Prec.high(markdownSupport),
    Prec.high(keymap.of(markdownKeymap)),
    // draftly view plugin for rich rendering
    draftlyExtensions,
    // Core CodeMirror extensions
    baseExtensions,
    // Plugin extensions & keymaps
    pluginExtensions,
    pluginKeymaps.length > 0 ? keymap.of(pluginKeymaps) : [],
    // Config keymaps & extensions
    configKeymap.length > 0 ? keymap.of(configKeymap) : [],
    extensions
  ];
  return composedExtensions;
}
export {
  draftly
};
