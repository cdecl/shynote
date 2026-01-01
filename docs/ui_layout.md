# Current UI Layout Components

This document lists the UI elements currently present in `index.html`, organized by panel and view mode.

## 1. Sidebar (Left Panel)

### Header
- **Logo**: Image & App Name "SHYNOTE"
- **Version**: Text "v{version}"
- **Logo/Title**: Link to Home
- **Controls (Right)**:
  - **Dark Mode Toggle**: Button (Icon: `light_mode` / `dark_mode`)
  - **Close Sidebar**: Button (Icon: `arrow_back_ios_new`)

### Search Toolbar
*Located below the header.*
- **Search Input**: Text Input with icon `search`.
- **Options**:
  - **Case Sensitive**: Toggle Button (`Aa`)
  - **Regex**: Toggle Button (`.*`)
- **Clear**: Button (Icon: `close`) - *Visible when query exists*
- **Results List**: Scrollable list of matched notes with snippets.

### Folder List (Content)
- **Inbox**: Item (Icon: `home`, Name: "Inbox", New Note Button)
- **My Folders**: Section Header + "New Folder" Button
  - **Folder Items**: List (Icon: `folder`, Name: User Defined, Count, Edit/Delete Actions)
- **Trash**: Item (Fixed at bottom section, Icon: `delete`, Name: "Trash", Empty Trash Action)

### Footer
*Located at the bottom of the sidebar.*
- **About**: Button (Icon: `info`)
- **Settings**: Button (Icon: `settings`)

---

## 2. Main Panel (Right Panel)

The main panel switches between **List Mode** and **Editor Mode**.

### (A) List Mode (`rightPanelMode === 'list'`)

#### Header
- **Navigation (Left)**:
  - **Open Sidebar**: Button (Icon: `view_sidebar`) *Visible only when sidebar is closed*
  - **Return to Editor**: Button (Icon: `edit_note`) *Visible when a note is active*

- **Controls (Right)**:
  - **Grid/List Toggle**: Button (Icon: `grid_view` / `view_list`)
  - **Sort Controls**:
    - Field: Button Group ("Title" / "Date")
    - Direction: Button (Arrow Up/Down)
  - **Import**: Button (Icon: `upload_file`, Text: "Import")

#### Content
- **Folder Header**: Large Icon + Name + Item Count + Multi-Select Toggle
- **Pinned Notes**: Section (Grid Cards or List Rows)
- **Notes**: Section (Grid Cards or List Rows)
- **Empty State**: Icon & Text
- **FAB**: Floating Action Button (Icon: `add`) - *Create New Note*

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (Editor Header)
*Located at the very top of the editor pane.*

- **Navigation (Left)**:
  - **Open Sidebar**: Button (Icon: `view_sidebar`) *Visible only when sidebar is closed*
  - **Return to Folder View**: Button (Icon: `drive_folder_upload`)
  - **View Mode Tabs**: Segmented Control
    - `Editor`: Button (Icon: `edit`, Text: "Editor")
    - `Preview`: Button (Icon: `visibility`, Text: "Preview")
    - `Split`: Button (Icon: `view_column`, Text: "Split")

- **Tools (Right)**:
  - **Font Size**: Select Box (12px - 20px)
  - **Share**: Button (Icon: `ios_share`)

#### Editor Content
- **Conflict Banner**: *Visible on sync conflict* (Keep Local / Use Server)
- **Title Input**: Large Text Input (H1 style) + Metadata (Date, Char Count, Folder Selector)
- **Text Area**: CodeMirror Editor / Preview Pane (Split view support)

#### Editor Bottom Area
- **Formatting Toolbar**:
  - **Desktop**: *Static Bar* below editor.
  - **Mobile**: *Floating Pill* (bottom-center), horizontally scrollable.
  - **Search**: Button (Icon: `search`) - *Triggers CodeMirror Find Panel*
  - **Formatting Tools**: Bold, Italic, Strike, Code (`<>`), List, Checkbox, Link, Headings (H1/H2/H3).

#### Status Bar (Bottom Footer)
*Visible in all modes.*
- **Left**: **Online Status** (Green/Red Dot + Text)
- **Right**:
  - **Sync Status**: Icon (`dns`) + Text ("Save Complete" / "Pushing...")
  - **Sync Queue**: Button (Icon: `sync` + Count) - *Visible when pending items exist*
  - **Last Sync**: Time (e.g. "14:30")
  - **Data Source**: Icon (`database`/`cloud_done`) + Message ("Local Load Complete")
