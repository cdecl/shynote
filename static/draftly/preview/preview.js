import { ThemeEnum } from "../editor/utils.js";
import { PreviewRenderer } from "./renderer.js";
async function preview(markdown, config = {}) {
  const {
    plugins = [],
    markdown: markdownConfig = [],
    wrapperClass = "draftly-preview",
    wrapperTag = "article",
    sanitize = true,
    theme = ThemeEnum.AUTO,
    syntaxTheme
  } = config;
  const renderer = new PreviewRenderer(markdown, plugins, markdownConfig, theme, sanitize, syntaxTheme);
  const content = await renderer.render();
  const classAttr = wrapperClass ? ` class="${wrapperClass}"` : "";
  return `<${wrapperTag}${classAttr}>
${content}</${wrapperTag}>`;
}
export {
  preview
};
