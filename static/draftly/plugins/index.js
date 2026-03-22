import { ParagraphPlugin } from "./paragraph-plugin.js";
import { HeadingPlugin } from "./heading-plugin.js";
import { InlinePlugin } from "./inline-plugin.js";
import { LinkPlugin } from "./link-plugin.js";
import { ListPlugin } from "./list-plugin.js";
import { TablePlugin } from "./table-plugin.js";
import { HTMLPlugin } from "./html-plugin.js";
import { ImagePlugin } from "./image-plugin.js";
import { MathPlugin } from "./math-plugin.js";
import { MermaidPlugin } from "./mermaid-plugin.js";
import { CodePlugin } from "./code-plugin.js";
import { QuotePlugin } from "./quote-plugin.js";
import { HRPlugin } from "./hr-plugin.js";
import { EmojiPlugin } from "./emoji-plugin.js";
import { ParagraphPlugin as ParagraphPlugin2 } from "./paragraph-plugin.js";
import { HeadingPlugin as HeadingPlugin2 } from "./heading-plugin.js";
import { InlinePlugin as InlinePlugin2 } from "./inline-plugin.js";
import { LinkPlugin as LinkPlugin2 } from "./link-plugin.js";
import { ListPlugin as ListPlugin2 } from "./list-plugin.js";
import { TablePlugin as TablePlugin2 } from "./table-plugin.js";
import { HTMLPlugin as HTMLPlugin2 } from "./html-plugin.js";
import { ImagePlugin as ImagePlugin2 } from "./image-plugin.js";
import { MathPlugin as MathPlugin2 } from "./math-plugin.js";
import { MermaidPlugin as MermaidPlugin2 } from "./mermaid-plugin.js";
import { CodePlugin as CodePlugin2 } from "./code-plugin.js";
import { QuotePlugin as QuotePlugin2 } from "./quote-plugin.js";
import { HRPlugin as HRPlugin2 } from "./hr-plugin.js";
import { EmojiPlugin as EmojiPlugin2 } from "./emoji-plugin.js";
const essentialPlugins = [
  new ParagraphPlugin2(),
  new HeadingPlugin2(),
  new InlinePlugin2(),
  new LinkPlugin2(),
  new ListPlugin2(),
  new TablePlugin2(),
  new HTMLPlugin2(),
  new ImagePlugin2(),
  new MathPlugin2(),
  new MermaidPlugin2(),
  new CodePlugin2(),
  new QuotePlugin2(),
  new HRPlugin2(),
  new EmojiPlugin2()
];
const allPlugins = [...essentialPlugins];
export {
  CodePlugin,
  EmojiPlugin,
  HRPlugin,
  HTMLPlugin,
  HeadingPlugin,
  ImagePlugin,
  InlinePlugin,
  LinkPlugin,
  ListPlugin,
  MathPlugin,
  MermaidPlugin,
  ParagraphPlugin,
  QuotePlugin,
  TablePlugin,
  allPlugins,
  essentialPlugins
};
