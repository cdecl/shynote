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
  - **Settings (`settings`)**: Opens the Settings Modal.
  - **Profile/Auth**: User avatar or Login/Logout action.

### Explorer Panel (`sidebarPanelMode === 'explorer'`)
*The primary navigation pane.*
- **Header**: \"EXPLORER\" label + App Version.
- **Library Section**:
  - **New Folder Button (`create_new_folder`)**: Creates a new folder.
  - **Inbox**: Special folder for root notes (Icon: `home`).
  - **User Folders**: List of folders with rename/delete actions (`edit_square`, `delete`) and item count. Supports drag-and-drop.
- **Trash**: Fixed at the bottom of the list (Icon: `delete` / `delete_outline`). Has empty trash button.
- **Recent Notes**: List of recently accessed notes (up to 5).

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
  - **Back to Editor (`edit_note`)**: Button - *Enabled only when a note is active; disabled otherwise.*
- **Controls (Center/Right)**:
  - **Grid/List Toggle**: Button (Icon: `grid_view` / `view_list`)
  - **Sort Controls**: Field (Title/Date) segmented control, Direction toggle (`arrow_upward` / `arrow_downward`).
  - **Import** (border-l separated): Button (Icon: `upload_file`). Triggers hidden file input.

#### Content
- **Folder Header**: Icon + Name.
- **Item Count & Select**: Count of items + **Multi-Select Toggle** (`Select` / `Cancel` button).
- **Notes Grid/List**: Cards or rows grouped by **Pinned** (📌) and **Regular** (📄) sections.
  - **Grid Cards** (`h-36`): Title, content preview, date, char count, Delete button. Pin button (top-right).
  - **List Rows**: Icon, title, content snippet, date, Pin toggle, Delete button.
  - **Inline Delete Confirmation**: Overlay within card/row (Yes/No).
- **FAB**: Floating Action Button (`add`) - *Create New Note*

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (h-7/28px)
*Conditionally shown when `rightPanelMode !== 'list'` and a note is selected.*
- **Navigation (Left)**:
  - **Back to List (`arrow_back_ios_new`)**: Button.
- **Tools (Right)** — grouped in a flex container:
  - **Font Size Selector + View Mode Tabs Container** (`gap-0` — no gap between them):
    - **Font Size Selector**: Dropdown (12px, 14px, 16px, 18px, 20px). Styled as `h-[26px]`.
    - **View Mode Tabs**: Segmented Control — `edit` (`edit` icon), `preview` (`visibility` icon), `split` (`view_column` icon). Active tab label text is shown only for the active tab.
  - **Share Button (`ios_share`)**: Shows spinner when sharing. Shows \"Share\" text label (hidden on mobile). Active state when note is shared.

#### Open Tabs Bar (h-6/24px, between Header and Editor)
- **Position**: Placed between the top toolbar and the editor main content area. Shown only in `edit` mode.
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
- **Title Input**: Full-width `text-3xl` header-style input (`placeholder: \"Untitled Note\"`).
- **Metadata Row** (below title, `text-xs`):
  - **Date & Time**: `updated_at` formatted.
  - **Char Count**: Character count of content.
  - **Backlinks Dropdown** (`link` icon): Shows backlink count. Clicking opens a dropdown list of notes that link to the current note.
  - **Folder Selector** (`drive_file_move` icon): Inline dropdown button showing current folder name. Click opens a dropdown to move the note to Inbox or another folder.
  - **Delete Button** (`delete` icon + \"Delete\" label): Opens an inline confirmation popup (Yes/No) below the button.
- **Text Area**: CodeMirror 6 Editor (when `viewMode !== 'preview'`) / Markdown Preview Pane.
- **Conflict Banner**: Shown above title when a sync conflict is detected. Offers \"Keep My Version\" / \"Use Server Version\" actions.

#### Split View
- **Resize Handle**: A draggable column divider between editor and preview panes (PC only, `view_column` mode).
- **Preview Pane**: Shows rendered Markdown. Double-click to switch to edit mode. Title and metadata displayed at the top of preview pane as well (read-only).

#### Editor Bottom Toolbar (Floating on Mobile / Static on PC)
- **Search (`search`)**: Triggers CodeMirror Find Panel.
- **Formatting Buttons**: Paste, Bold, Italic, Strikethrough, Code (Inline/Block toggle), Blockquote, Bullet List, Task List, Table (Edit/Create), Link.
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

### Table Editor Modal
- **Spreadsheet Grid**: Editable header and body cells.
- **Column Alignment**: Left / Center / Right per column.
- **Row/Col Management**: Add Row, Add Col, Delete Row, Delete Col.
