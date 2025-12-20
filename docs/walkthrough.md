# Walkthrough - Sync with GEMINI.md

I have updated the project to align with `GEMINI.md` requirements, introducing Folder support and a Split View editor.

## Changes

### Documentation
- Created `docs/` directory.
- Populated `docs/` with project artifacts.

### Sidebar & Folders
- **Folders**: Implemented folder creation and management.
- **Organization**: Notes can now be created within folders or at the root level.
- **UI**: Sidebar displaying folders and their contents hierarchically.

### Editor
- **Split View**: Implemented a side-by-side Editor and Markdown Preview.
- **Markdown**: Integrated `marked.js` for real-time markdown rendering.

### UI Improvements
- **Material Icons**: Integrated genuine **VS Code Material Icon Theme** SVGs for directories and Markdown files, providing a familiar and high-quality visual hierarchy.
- **Sidebar Toggle**: Added a collapsible sidebar feature with smooth transitions, controllable via a toggle button in the editor toolbar.

## Verification

### Browser Automation
I verified the following workflows:
1.  **Folder Creation**: Created "Projects" and "Ideas" folders.
2.  **Note Creation**: Created "ProjectPlan" inside "Projects".
3.  **Editing**: Verified markdown content (Headers, Lists, Bold text).
4.  **Preview**: Confirmed the Preview pane renders markdown correctly.
5.  **Navigation**: Verifed sidebar structure matches the folder hierarchy.

![Folder and Split View Verification](file:///Users/cdecl/.gemini/antigravity/brain/1d220aa3-893b-4506-aa3f-6ff27a9e7687/folder_split_feature_verification_retry_1766207215745.webp)
*Figure 1: Verification of Folders and Split View.*

## How to Run

```bash
./run.sh
```

**Note**: The database schema has been updated. If you encounter errors, you may need to reset the database:
```bash
rm shynotes.db
./run.sh
```
