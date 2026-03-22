import { EditorView } from "@codemirror/view";
const draftlyBaseTheme = EditorView.theme({
  // Container styles - only apply when view plugin is enabled
  "&.cm-draftly": {
    fontSize: "inherit",
    lineHeight: "inherit",
    backgroundColor: "transparent !important"
  },
  "&.cm-draftly .cm-content": {
    width: "100%",
    maxWidth: "inherit",
    padding: "0 0.5rem",
    margin: "0",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit"
  },
  "&.cm-draftly .cm-content .cm-line": {
    paddingInline: 0
  },
  "&.cm-draftly .cm-content .cm-widgetBuffer": {
    display: "none !important"
  }
});
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
const markdownResetStyle = HighlightStyle.define([
  {
    tag: [
      t.heading,
      t.strong,
      t.emphasis,
      t.strikethrough,
      t.link,
      t.url,
      t.quote,
      t.list,
      t.meta,
      t.contentSeparator,
      t.labelName
    ],
    color: "inherit",
    fontWeight: "inherit",
    fontStyle: "inherit",
    textDecoration: "none"
  }
]);
const markdownResetExtension = syntaxHighlighting(markdownResetStyle, { fallback: false });
export {
  draftlyBaseTheme,
  markdownResetExtension
};
