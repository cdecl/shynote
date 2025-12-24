# CodeMirror 6 Migration Plan

This plan details the steps to replace the existing `<textarea>` based editor with **CodeMirror 6**, using CDN modules (`esm.sh`) for a build-free implementation.

## 1. Objectives
- **Replace Editor**: Swap `textarea` with `CodeMirror 6 EditorView`.
- **Maintain Features**:
  - Two-way binding (Vue state <-> Editor content).
  - Dark Mode support (dynamic theme switching).
  - Markdown syntax highlighting.
  - Keyboard shortcuts (Standard + Markdown).
  - Floating Toolbar (Selection-based).
  - List continuation and indentation handling (Built-in or improved in CM6).

## 2. Technical Strategy
### CDN Import (ES Modules)
We will use `esm.sh` to import CodeMirror 6 packages directly in `app.js`.
```javascript
import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, rectRect, crosshairCursor, lineNumbers, highlightActiveLineGutter } from "https://esm.sh/@codemirror/view@6.23.0"
import { EditorState, Compartment } from "https://esm.sh/@codemirror/state@6.4.0"
import { markdown, markdownLanguage } from "https://esm.sh/@codemirror/lang-markdown@6.2.3"
import { languages } from "https://esm.sh/@codemirror/language-data@6.4.0"
import { defaultKeymap, history, historyKeymap } from "https://esm.sh/@codemirror/commands@6.3.3"
import { searchKeymap, highlightSelectionMatches } from "https://esm.sh/@codemirror/search@6.5.5"
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2"
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "https://esm.sh/@codemirror/language@6.10.0"
import { closeBrackets, closeBracketsKeymap } from "https://esm.sh/@codemirror/autocomplete@6.12.0"
```

### Editor Initialization
- **Container**: Allow CodeMirror to fill the `.editor-container` div.
- **State Management**:
  - Use a `Compartment` for Theme (Switch between default light and `oneDark`).
  - Use `EditorView.updateListener` to sync changes back to `selectedNote.value.content`.
  - When `selectedNote` changes, use `view.setState()` to load the new document cleanly (resetting undo history for the new note, which is expected behavior).

### Floating Toolbar
- Use the `updateListener` to detect selection changes.
- If `state.selection.main.empty` is false:
  - Get coordinates via `view.coordsAtPos(state.selection.main.from)`.
  - Update Vue state (`toolbarPosition`, `showToolbar`) to render the existing floating toolbar overlay.

## 3. Implementation Steps

### Phase 1: Preparation
- [x] Create this plan.
- [ ] Update `index.html` to replace `<textarea>` with a container `<div>`.
- [ ] Add necessary CSS overrides for CodeMirror (height, font) in `index.html` or `style.css`.

### Phase 2: Core Implementation (`app.js`)
- [ ] Import CodeMirror 6 modules.
- [ ] Implement `setupCodeMirror(element)` function.
- [ ] Configure Extensions:
  - Theme (Dark/Light).
  - Markdown Language.
  - History & Keymaps.
  - Line Wrapping.
- [ ] Implement Data Sync (Vue Watchers <-> Dispatch).

### Phase 3: Features & Polish
- [ ] Re-connect Floating Toolbar logic using CodeMirror coordinates.
- [ ] Re-implement Formatting Commands (Bold, Italic, etc.) using `view.state.changeByRange` or standard commands.
- [ ] Verify Mobile interaction (Touch support is native in CM6).

## 4. Verification
- Typing performance.
- Saving to DB works.
- Dark mode toggles correctly.
- Mobile keyboard handles correctly.
