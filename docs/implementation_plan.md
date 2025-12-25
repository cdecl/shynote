# Implementation Plan & Status

This document tracks the cumulative implementation details of the SHYNOTE project, from core foundation to latest advanced features.

## 1. Core Functionality & Architecture
**Date**: Initial Implementation ~ 2025-12-21
**Status**: Implemented

### Data Management Checklist
- [x] **Database Schema**:
    - [x] `Folders` table (id, name, user_id).
    - [x] `Notes` table (id, title, content, folder_id, user_id, timestamps).
    - [x] Relationships: Notes belong to Folders (optional) and Users.
- [x] **API Endpoints (FastAPI)**:
    - [x] `GET /api/folders`, `POST /api/folders`, `DELETE /api/folders/{id}`, `PUT /api/folders/{id}`.
    - [x] `GET /api/notes`, `POST /api/notes`, `PUT /api/notes/{id}`, `DELETE /api/notes/{id}`.

### Frontend Logic (Vue.js) Checklist
- [x] **State Management**: Reactive `notes` and `folders` arrays using Vue `ref`.
- [x] **Navigation**: Folder-based filtering of notes (`getFolderNotes`).
- [x] **Editor Integation**: 
    - [x] Split View (Editor + Live Preview).
    - [x] Real-time Markdown rendering with `marked.js`.
    - [x] Syntax Highlighting with `highlight.js`.

---

## 2. Editor Migration (CodeMirror 6)
**Date**: 2025-12-23
**Status**: Implemented

### Core Integration Checklist
- [x] **Core Integration**
  - [x] Add CodeMirror 6 CDN links (esm.sh: View, State, Lang-Markdown, Theme-OneDark)
  - [x] Initialize CodeMirror `EditorView` and `EditorState`
  - [x] Implement Two-way Binding with Vue State (UpdateListener + Watcher)
  - [x] Dynamic Theme Support (`Compartment` for One Dark / Light)
- [x] **Styling**:
    - [x] Full height container allowing scroll.
    - [x] Match application typography.

### Feature Porting Checklist
- [x] **Keymaps**:
    - [x] Default CodeMirror Keymaps (Standard, History).
    - [x] Custom Shortcuts (`Mod-S` Save, `Mod-F` Find, `Mod-B/I/K` Formatting).
- [x] **Extensions**:
    - [x] Markdown Language Support (GFM).
    - [x] Syntax Highlighting (`defaultHighlightStyle`).
    - [x] Active Line Gutter.
    - [x] Bracket Matching & Auto-close.
    - [x] Multiple Selections.
- [x] **UI Components**:
    - [x] **Floating Toolbar**: Updated to work with CodeMirror text selection.
    - [x] **Search/Replace**: Ported to use CodeMirror State and Transactions.
    - [x] **Word Wrap**: Toggleable via Toolbar, defaults to ON.
- [x] **Inline Delete Confirmation**: Replaced modal with "Ask Box" (Y/N) inline for notes and folders.
- [x] **New Note/Folder UX**: 
  - Auto-focus title on new note.
  - Direct creation + rename for new folders.
- [x] **Sidebar Refinement**: Compact list style for better density.
- [x] **Editor Improvements**: 
  - [x] Floating Toolbar for text selection. work with CodeMirror text selection.
    - [x] **Search/Replace**: Ported to use CodeMirror State and Transactions.
    - [x] **Word Wrap**: Toggleable via Toolbar, defaults to ON.


---

## 3. Advanced Editor Features (Legacy Textarea)
**Date**: 2025-12-21
**Status**: Obsolete (Being replaced by CodeMirror)

### Features Checklist
- [x] **Smart Content Control**:
    - [x] **Smart Lists**: Auto-continuation for ` - `, ` * `, ` + `, ` 1. `.
    - [x] **Smart Indent**: Auto-indent after `{`, `:`.
    - [x] **Comment Continuation**: Auto-continuation for `//`, `/*`.
- [x] **VS Code Line Actions**:
    - [x] **Move Line**: `Alt + ArrowUp` / `Alt + ArrowDown`.
    - [x] **Copy Line**: `Shift + Alt + ArrowUp` / `Shift + Alt + ArrowDown`.
- [x] **Keyboard Shortcuts**:
    - [x] `Ctrl/Cmd + B` (Bold), `Ctrl/Cmd + I` (Italic).
    - [x] `Ctrl/Cmd + S` (Manual Save).

### Technical Implementation
- **Logic**: Pure JavaScript in `static/app.js` (`handleEditorKeyDown` function).
- **DOM Manipulation**: APIs like `selectionStart`, `selectionEnd`, and string manipulation for line operations.
- **Undo Integration**: Uses `document.execCommand('insertText')` to preserve browser undo history.

### Floating Toolbar & Tab Features Checklist
- [x] **Floating Toolbar**:
    - [x] Select text to show formatting actions.
    - [x] **Actions**: Bold, Italic, Strikethrough, Code, Link.
    - [x] **Headings**: H1, H2, H3, H4, H5 buttons (applies to whole line).
- [x] **Multi-line Tab Control**:
    - [x] **Indent (Tab)**: Indents all selected lines by 2 spaces.
    - [x] **Outdent (Shift+Tab)**: Unindents all selected lines by 2 spaces.

---

## 3. JWT Authentication & Data Isolation
**Date**: 2025-12-20
**Status**: Implemented

### Architecture Checklist
- [x] **Google OAuth 2.0 Integration**:
    - [x] Frontend: Google Identity Services (GIS) button rendering and callback.
    - [x] Backend: Token verification endpoint `/auth/login`.
- [x] **Session Management**:
    - [x] Internal JWT (HS256) issuance upon Google verification.
    - [x] 7-day token expiration.
    - [x] `localStorage` token storage.
- [x] **Data Isolation**:
    - [x] `get_current_user` dependency for protected routes.
    - [x] Row Level Security (Application Level): All queries filtered by `current_user.id`.

---

## 4. UI/UX & Styling
**Date**: 2025-12-20 ~ 2025-12-21
**Status**: Implemented

### Styling Checklist
- [x] **Theming**:
    - [x] **Dark Mode**: Global implementation using Tailwind `dark:` and CSS variables.
        - [x] **Scope**: Applied to Login Modal, Sidebar, Editor, Preview, and Empty States.
        - [x] **Scrollbar**: `color-scheme: dark` for native dark scrollbars.
    - [x] **Markdown**: `github-markdown-css` (Dark) integration.
    - [x] **Code**: `nord.css` for Highlight.js.
- [x] **Typography**:
    - [x] **Fonts**: D2Coding (Korean/Code) with JetBrains Mono/Inter fallback.
- [x] **Layout Components**:
    - [x] **Sidebar**: Collapsible/Resizable sidebar with specific width control.
    - [x] **Toolbar**: "View" mode toggles (Split/Edit/Preview).
    - [x] **Feedback**: Status messages ("Saved", "Typing...") and Loading states.
    - [x] **Code Blocks**:
        - [x] **Copy Button**: Hover to copy code with visual feedback.
        - [x] **Scroll**: Horizontal scrolling for overflow content.
    - [x] **Toolbar**: Labels for icons ("WRAP", "SIZE", "SHARE").

---

## 5. Infrastructure & Deployment
**Date**: 2025-12-18 ~ 2025-12-21
**Status**: Stabilized

### Vercel / Serverless Optimization Checklist
- [x] **ASGI Handler**: Correct entry point in `api/index.py` for Vercel Python runtime.
- [x] **Static Files**: Absolute path resolution using `__file__` to avoid 404s in serverless environment.
- [x] **Database Connectivity**:
    - [x] **Sanitization**: `urllib.parse` to handle special characters in connection strings.
    - [x] **Driver Fix**: Enforce `postgresql://` replacement for `psycopg2`.
    - [x] **Fallback**: In-memory SQLite for environments without DB config.

---

## 6. Future Roadmap (To Be Implemented)
- [ ] **Database Migration**: Fully transition to PostgreSQL for production (Vercel Postgres).
- [ ] **State Management**: Refactor vanilla `ref` to Pinia if complexity grows.
- [x] **Editor Upgrade**: Evaluate CodeMirror/Monaco for richer editing experience.
- [ ] **Testing**: Implement `pytest` suite and E2E tests.

---

## 7. Local-first Sync Architecture
**Date**: 2025-12-24 ~ 2025-12-26
**Status**: Completed

### Storage Strategy
- [x] **IndexedDB (Local)**:
    - [x] Schema Design (`Current_State` stores for Notes/Folders, `Pending_Logs` for sync queue).
    - [x] `idb` wrapper for async operations.
    - [x] **UUID v7**: Migration to time-ordered UUIDs for all entities (Users, Folders, Notes).
- [x] **Database (Remote)**:
    - [x] Schema update: All IDs converted to String(UUID).
    - [x] Hashing: Implemented `content_hash` for efficient change detection.

### Synchronization Logic
- [x] **Write-Ahead Logging (WAL)**:
    - [x] Local First: All mutations (Create, Update, Delete) save to IndexedDB immediately.
    - [x] Background Sync Worker: Processes `pending_logs` every 5 seconds.
    - [x] **Auto Recovery**: Worker automatically retries failed `PUT` (404) requests as `POST` (Upsert).
    - [x] **Dependency Ordering**: Prioritizes Folder operations over Notes to prevent reference errors.
- [x] **Conflict Resolution**:
    - [x] Hash-based comparison (`content_hash`).
    - [x] Dirty Check: Prevents overwriting local unsynced changes (Dirty) with server data.
    - [x] Conflict UI: Notifies user of hash mismatches for manual resolution.

### Data Isolation
- [x] **IndexedDB**: Scope queries by `user_id` (via creating separate stores or filtering, currently filtering by UID logic in app).
- [x] **LocalStorage**: Prefix keys with `user_id` for multi-user support.

---

## 8. Future Roadmap (To Be Implemented)
- [ ] **Database Migration**: Fully transition to PostgreSQL for production (Vercel Postgres).
- [ ] **State Management**: Refactor vanilla `ref` to Pinia if complexity grows.
- [ ] **Testing**: Implement `pytest` suite and E2E tests.
- [ ] **Folder Structure Sync**:
    - [ ] Implement smart refresh of folder structure (e.g., on folder toggle or visibility change) to keep the tree view consistent across devices.
    - [ ] List UI "Dirty Check" refining.
