import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
function createWrapSelectionInputHandler(markers) {
  return EditorView.inputHandler.of((view, _from, _to, text) => {
    const wrapper = markers[text];
    if (!wrapper) return false;
    const { state } = view;
    if (state.selection.ranges.every((range) => range.empty)) {
      return false;
    }
    const transaction = state.changeByRange((range) => {
      if (range.empty) {
        return { range };
      }
      const selectedText = state.sliceDoc(range.from, range.to);
      const insertText = `${wrapper}${selectedText}${wrapper}`;
      const changes = { from: range.from, to: range.to, insert: insertText };
      const start = range.from + wrapper.length;
      const end = start + selectedText.length;
      return { changes, range: EditorSelection.range(start, end) };
    });
    view.dispatch(transaction);
    return true;
  });
}
export {
  createWrapSelectionInputHandler
};
