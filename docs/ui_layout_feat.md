# Current UI Layout Components

This document lists the UI elements currently present in `index.html`, organized by panel and view mode.

## 1. Sidebar Area (Left Panel)

The sidebar is now a dual-layered navigation hub consisting of the **Activity Bar** and the **Content Panel**.

### Activity Bar (Narrow Fixed Bar, 44px)
*Located at the leftmost edge, always visible on both PC and Mobile.*
- **Logo**: App Logo (Icon size: 24px)
- **Library/Explorer (`folder_open`)**: Toggles the Explorer Content Panel.
- **Search (`search`)**: Toggles the Search Content Panel (auto-focuses search input).
- **Menu (`menu_open`)**: Triggers the Command Palette (`Cmd+P`).
- **Quick Note (`note_add`)**: Instantly creates a new note in the Inbox.
- **Controls (Bottom)**:
  - **Theme Toggle**: Switch between Light/Dark mode.
  - **Profile/Auth**: User avatar or Login/Logout action.

### Explorer Panel (`sidebarPanelMode === 'explorer'`)
*The primary navigation pane.*
- **Header**: "EXPLORER" label + App Version.
- **Library Section**:
  - **New Folder Button**: Creates a new folder.
  - **Inbox**: Special folder for root notes (Icon: `home`).
  - **User Folders**: List of folders with edit/delete actions and item count.
- **Trash**: Fixed at the bottom of the list (Icon: `delete`).
- **Recent Notes**: List of 5 most recently accessed notes.

### Search Panel (`sidebarPanelMode === 'search'`)
*Dedicated search interface.*
- **Header**: "SEARCH" label.
- **Search Toolbar**:
  - **Search Input**: Text Input with `search` icon.
  - **Search History**: Dropdown of last 10 search queries (Sidebar only).
  - **Options**: Case Sensitive (`Aa`), Regex (`.*`).
- **Results List**: Scrollable list of matched notes with highlighted snippets.

### Sidebar Functionality
- **Resizable**: (PC only) Drag the right edge of the sidebar to adjust width (200px - 600px).
- **Persistence**: Sidebar width and open/close state are remembered.

---

## 2. Main Panel (Right Panel)

The main panel switches between **List Mode** and **Editor Mode**.

### (A) List Mode (`rightPanelMode === 'list'`)

#### Header (h-7/28px)
- **Navigation (Left)**:
  - **Back to List**: Button (Icon: `arrow_back_ios_new`) - *Visible when a note is active*
- **Controls (Right)**:
  - **Grid/List Toggle**: Button (Icon: `grid_view` / `view_list`)
  - **Sort Controls**: Field (Title/Date), Direction toggle.
  - **Import**: Button (Icon: `upload_file`).

#### Content
- **Folder Header**: Icon + Name + Count.
- **Notes Grid/List**: Cards or rows for pinned and regular notes.
- **FAB**: Floating Action Button (`add`) - *Create New Note*

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (h-7/28px)
- **Navigation (Left)**:
  - **Back to List**: Button (Icon: `arrow_back_ios_new`)
  - **View Mode Tabs**: Segmented Control (`Editor`, `Preview`, `Split`).
- **Tools (Right)**:
  - **Delete Note**: Button (Icon: `delete`) with inline confirmation.

#### Open Tabs Bar (h-9/36px, between Header and Editor)
- **Position**: Placed between the top toolbar and the editor main content area.
- **Tabs**: Shows currently opened notes as horizontal tabs.
- **Per-tab Close**: Each tab has an `X` close button.
- **Empty State**: Shows `No open tabs` when no tabs are open.
- **Behavior**:
  - Click tab: activate and focus that note.
  - Close active tab: automatically activates a neighboring tab.
  - Close all tabs: keeps editor mode visible with an empty screen (no forced switch to list mode).
- **Persistence**:
  - Recent open tabs are stored in client `localStorage` (max 10).
  - Last active tab is restored on load if the note still exists.

#### Editor Content
- **Title Input**: Header-style input with metadata (Date, Folder selector).
- **Text Area**: CodeMirror 6 Editor / Markdown Preview Pane.
- **Backlinks Section**: Automatic bi-directional link discovery at the bottom.

#### Editor Bottom Area
- **Formatting Toolbar**: Bold, Italic, Code, Headings, etc.
- **Search (Editor-internal)**: Triggers CodeMirror Find Panel (supports Arrow Key History).

#### Status Bar (Bottom Footer)
- **Left**: Online Status, User Login Info.
- **Right**: Sync Status, Sync Queue, Data Source (Local/Cloud).

---

## 3. Command Palette (Global Overlay)

*Triggered via `Cmd+P` or Activity Bar Menu icon.*

- **Modes**: Commands, Notes, Folders.
- **Logic**: Fuzzy matching, keyboard navigation (Arrow keys, Enter, Esc).
- **Tab Command**:
  - **Close All Tabs**: Closes all open tabs from the editor context.
