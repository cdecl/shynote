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

## Status: Completed

### Documentation
- [x] Create `docs/implementation_plan.md`
- [x] Create `docs/walkthrough.md`

### Frontend (Split View)
- [x] Add `marked` library script.
- [x] Change right panel to grid/flex with two columns.
- [x] Preview div shows `marked(content)`.

### Backend (Folder Support)
- [x] Add `Folder` model and relationships.
- [x] Update `Note` model with `folder_id`.
- [x] Implement Folder CRUD API.
- [x] Update frontend to organize notes by folder.

### UI Improvements (Added)
- [x] **Material Design**: Integrated `Material Symbols Rounded`.
- [x] **Icon Theme**: Implemented VS Code Material Icon Theme for folders/files (`.svg`).
- [x] **Sidebar Toggle**: Added collapsible sidebar functionality.
- [x] **Delete Actions**: Added delete buttons (trash icon) to folders and notes in the sidebar.
- [x] **Branding**: Updated logo to "SHYNOTE" and added header action icons.

### Deployment & Tools (Added)
- [x] **Service Script**: Refactored `run.sh` to support `start|stop|restart` background execution.

## Verification Plan
1.  Verify `docs/` exists and contains markdown files. (Done)
2.  Verify Split View renders markdown correctly. (Done)
3.  Verify creating/deleting folders and listing notes within them. (Done)
4.  Verify sidebar toggle and delete interactions. (Done)
