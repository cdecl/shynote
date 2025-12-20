# Implementation Plan - Sync with GEMINI.md

Goal: Update the project to match requirements in `GEMINI.md`:
1.  Maintain artifacts in `docs/`.
2.  Implement Obsidian-like Split View (Editor | Preview).
3.  Implement Folder-based navigation.

## User Review Required
> [!NOTE]
> **Filesystem Sync**: I will copy the current `implementation_plan.md` and `walkthrough.md` to `docs/` in the repo.
> **Markdown Rendering**: I will add `marked.js` via CDN for the preview pane.

## Proposed Changes

### Documentation
- Create `docs/implementation_plan.md` (Copy of this)
- Create `docs/walkthrough.md` (Copy of existing)

### Frontend (Split View)
#### [MODIFY] [static/index.html](file:///Users/cdecl/dev/shynotes/static/index.html)
- Add `marked` library script.
- Change right panel to grid/flex with two columns: Textarea (Editor) + Div (Preview).
- Preview div shows `marked(content)`.

#### [MODIFY] [static/app.js](file:///Users/cdecl/dev/shynotes/static/app.js)
- Compute `compiledMarkdown` property.

### Backend (Folder Support)
#### [MODIFY] [src/models.py](file:///Users/cdecl/dev/shynotes/src/models.py)
- Add `Folder` class.
- Update `Note` to add `folder_id` ForeignKey.

#### [MODIFY] [src/schemas.py](file:///Users/cdecl/dev/shynotes/src/schemas.py)
- Schema updates for Folder.

#### [MODIFY] [src/main.py](file:///Users/cdecl/dev/shynotes/src/main.py)
- APIs for Folders (CRUD).

#### [MODIFY] [static/app.js](file:///Users/cdecl/dev/shynotes/static/app.js)
- Fetch folders.
- Organize notes by folder in the Left Sidebar.

## Verification Plan
1.  Verify `docs/` exists and contains markdown files.
2.  Verify Split View renders markdown correctly.
3.  Verify creating/deleting folders and listing notes within them.
