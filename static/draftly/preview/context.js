import DOMPurify from "dompurify";
function createPreviewContext(doc, theme, renderChildren, sanitizeHtml = true, syntaxHighlighters = []) {
  return {
    doc,
    theme,
    syntaxHighlighters,
    sliceDoc(from, to) {
      return doc.slice(from, to);
    },
    sanitize(html) {
      if (!sanitizeHtml) return html;
      if (typeof window !== "undefined") {
        return DOMPurify.sanitize(html);
      }
      return html;
    },
    renderChildren
  };
}
export {
  createPreviewContext
};
