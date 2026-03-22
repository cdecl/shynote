import { ThemeEnum } from "../editor/utils.js";
import { generateSyntaxThemeCSS } from "./syntax-theme.js";
const baseStyles = `.draftly-preview {
  padding: 0 0.5rem;
}`;
function generateCSS(config = {}) {
  const {
    plugins = [],
    theme = ThemeEnum.AUTO,
    wrapperClass = "draftly-preview",
    includeBase = true,
    syntaxTheme
  } = config;
  const cssChunks = [];
  if (includeBase) {
    if (wrapperClass !== "draftly-preview") {
      cssChunks.push(baseStyles.replace(/\.draftly-preview/g, `.${wrapperClass}`));
    } else {
      cssChunks.push(baseStyles);
    }
  }
  const syntaxCSS = generateSyntaxThemeCSS(syntaxTheme, wrapperClass);
  if (syntaxCSS) {
    cssChunks.push("/* syntax-theme */\n" + syntaxCSS);
  }
  for (const plugin of plugins) {
    const pluginCSS = plugin.getPreviewStyles(theme, wrapperClass);
    if (pluginCSS) cssChunks.push(`/* ${plugin.name} - ${plugin.version} */
` + pluginCSS);
  }
  return cssChunks.join("\n\n");
}
export {
  generateCSS
};
