function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const renderDocument = (_node, children) => {
  return children;
};
const defaultRenderers = {
  // Document structure
  Document: renderDocument
};
export {
  defaultRenderers,
  escapeHtml
};
