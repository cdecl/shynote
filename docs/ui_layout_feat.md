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
- **Pull Sync (`sync`)**: Manually triggers a synchronization to fetch latest changes from the cloud.
- **Controls (Bottom)**:
  - **Theme Toggle**: Switch between Light/Dark mode.
  - **Settings (`settings`)**: Opens the Settings Modal.
  - **Profile/Auth**: User avatar or Login/Logout action.

### Explorer Panel (`sidebarPanelMode === 'explorer'`)
*The primary navigation pane. Supports a hierarchical tree view.*
- **Header**: \"EXPLORER\" label + App Version.
- **Sort Toggle**: Button to switch sorting between Title and Date (with ascending/descending direction).
- **Library Section**:
  - **New Folder Button (`create_new_folder`)**: Creates a new folder.
  - **Inbox**: 
    - Collapsible section (Icon: `inbox`).
    - Expand/Collapse toggle: Shows/hides root notes.
    - Quick Add: `add_circle` button to instantly create a note in Inbox.
    - Note List: Displayed when expanded, showing note title and pin status.
  - **User Folders**: 
    - Collapsible folders with rename/delete actions and item count.
    - Expand/Collapse toggle: Shows/hides notes within the folder.
    - Quick Add: `add_circle` button to create a note specifically in that folder.
    - Note List: Displayed when expanded, showing note title and pin status.
    - Supports drag-and-drop for organizing notes and folders.
- **Trash**: Fixed at the bottom of the list (Icon: `delete` / `delete_outline`). Has empty trash button.
- **Recent Notes**: List of recently accessed notes (up to 10), showing note title with folder name.

### Search Panel (`sidebarPanelMode === 'search'`)
*Dedicated search interface.*
- **Header**: \"SEARCH\" label.
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
  - **Sidebar Toggle (`left_panel_open` / `left_panel_close`)**: Button.
    - On Desktop: toggles sidebar visibility (`isSidebarOpen`).
    - On Mobile: opens Explorer sidebar panel (`setSidebarPanelMode('explorer')`).
    - Icon switches by current sidebar state (`open` -> `left_panel_close`, `closed` -> `left_panel_open`).
- **Controls (Center/Right)**:
  - **Grid/List Toggle**: Button (Icon: `grid_view` / `view_list`)
  - **Sort Controls**: Field (Title/Date) segmented control, Direction toggle (`arrow_upward` / `arrow_downward`).
  - **Import** (border-l separated): Button (Icon: `upload_file`). Triggers hidden file input.

#### Content
- **Folder Header**: Icon + Name.
- **Item Count & Select**: Count of items + **Multi-Select Toggle** (`Select` / `Cancel` button).
- **Notes Grid/List**: Cards or rows grouped by **Pinned** (📌) and **Regular** (📄) sections.
  - **Grid Cards**: 제목 중심 카드. 본문 미리보기 텍스트는 제외. `minmax(220px, 1fr)` 기반의 최소 너비를 보장해 제목 가독성을 유지.
  - **List Rows**: 아이콘 + 제목 중심 행 레이아웃. 본문 미리보기 텍스트는 제외.
  - **Inline Delete Confirmation**: Overlay within card/row (Yes/No).
- **FAB**: Floating Action Button (`add`) - *Create New Note*

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (h-7/28px)
*Conditionally shown when `rightPanelMode !== 'list'` and a note is selected.*
- **Navigation (Left)**:
  - **Sidebar Toggle (`left_panel_open` / `left_panel_close`)**: Button.
    - On Desktop: toggles sidebar visibility (`isSidebarOpen`).
    - On Mobile: opens Explorer sidebar panel (`setSidebarPanelMode('explorer')`).
    - Icon switches by current sidebar state (`open` -> `left_panel_close`, `closed` -> `left_panel_open`).
- **Tools (Right)** — grouped in a flex container:
  - **Font Size Selector + View Mode Tabs Container** (`gap-0` — no gap between them):
    - **Font Size Selector**: Dropdown (12px, 14px, 16px, 18px, 20px). Styled as `h-[26px]`.
    - **View Mode Tabs**: Segmented Control — `live` (`edit` icon), `view` (`visibility` icon). Active tab label text is shown only for the active tab.
  - **Share Button (`ios_share`)**: Shows spinner when sharing. Shows \"Share\" text label (hidden on mobile). Active state when note is shared.

#### Open Tabs Bar (h-6/24px, between Header and Editor)
- **Position**: Placed between the top toolbar and the editor main content area. Shown only in `live` mode.
- **Visibility**: *Hidden on mobile devices for better screen real estate.*
- **Tabs**: Shows currently opened notes as horizontal tabs (`w-36` fixed width).
- **Per-tab Close**: Each tab has an `X` (`close`) close button.
- **Empty State**: Shows `No open tabs` when no tabs are open.
- **Behavior**:
  - Click tab: activate and focus that note.
  - Close active tab: automatically activates a neighboring tab.
  - Close all tabs: keeps editor mode visible with an empty screen (no forced switch to list mode).
- **Persistence**:
  - Recent open tabs are stored in client `localStorage` (max 10).
  - Last active tab is restored on load if the note still exists.

#### Editor Content
- **Title Input**: Full-width `text-3xl` header-style input (`placeholder: "Untitled Note"`).
- **Text Area**: CodeMirror 6 Editor (when `viewMode !== 'view'`) / Markdown Preview Pane.
- **Conflict Banner**: Shown above title when a sync conflict is detected. Offers "Keep My Version" / "Use Server Version" actions.

#### Editor Meta Bar (Fixed at Bottom, above Toolbar)
- **Position**: Absolute/fixed above the formatting toolbar in Editor mode, and fixed at the bottom in Preview mode.
- **Components**:
  - **Date & Time**: `updated_at` formatted.
  - **Char Count**: Character count of content.
  - **Backlinks Dropdown** (`link` icon): Shows backlink count. Clicking opens a dropdown list of notes that link to the current note.
  - **Folder Selector** (`drive_file_move` icon): Inline dropdown button showing current folder name. Click opens a dropdown to move the note to Inbox or another folder.
  - **Delete Button** (`delete` icon + "Delete" label): Opens an inline confirmation popup (Yes/No) below the button.

#### Editor Bottom Toolbar (Floating on Mobile / Static on PC)
- **Search (`search`)**: Triggers CodeMirror Find Panel.
- **Formatting Buttons**: Paste, Bold, Italic, Strikethrough, Code (Inline/Block toggle), Blockquote, Bullet List, Task List, Link.
- **Heading Buttons**: H1, H2, H3.

#### Status Bar (Bottom Footer, h-6)
- **Left**: Online Status dot + label (clickable to force Pull Sync), User Login Info (Guest badge or email).
- **Right**: Sync Status message + LocalFirst storage icon (`dns`), Sync Queue count (clickable retry), Last Sync Time, Data Source indicator (IDB / CLOUD / SYNC / NONE).

---

## 3. Command Palette (Global Overlay)

*Triggered via `Cmd+P` or Activity Bar Menu icon.*

- **Modes**: Commands, Notes, Folders.
- **Logic**: Fuzzy matching, keyboard navigation (Arrow keys, Enter, Esc).
- **Tab Command**:
  - **Close All Tabs**: Closes all open tabs from the editor context.

---

## 4. Modals & Overlays

### Settings Modal
- **About**: App version, License (MIT), Changelog link.
- **API Key**: Generate/Regenerate/Delete, Copy button. (로그인 필요)
- **Backup & Restore**: Backup (download JSON), Restore (upload JSON). DB type badge shown.
- **Danger Zone**: Clear Local Cache, Factory Reset.

### Generic Modal
- Used for confirmations and folder creation.
- Supports: delete confirmation, create folder, file info, share note (copy link / stop sharing).

### Table Editor (Draftly Inline)
- **Inline Rendering**: Tables are rendered as Draftly widgets directly in the editor.
- **Inline Editing**: Click on cells to edit content directly.
- **Row/Col Management**: Add/Delete rows and columns via toolbar buttons.
