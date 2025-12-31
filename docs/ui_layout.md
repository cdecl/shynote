# Current UI Layout Components

This document lists the UI elements currently present in `index.html`, organized by panel and view mode.

## 1. Sidebar (Left Panel)

### Header
- **Logo**: Image
- **App Name**: Text "SHYNOTE"
- **Version**: Text "v{version}"
- **Display Mode**: Toggle Button (Light/Dark Mode icons)
- **Close Sidebar**: Button (Icon: `arrow_back_ios_new`)

### Toolbar
- **Label**: Text "FOLDERS"
- **New Folder**: Button (Icon: `add`)

### Folder List
- **Inbox**: Item (Icon: `Inbox`, Name: "Inbox", Count)
- **My Folders**: Section Header
  - **Folder Items**: List (Icon: `folder`, Name: User Defined, Count)
- **Trash**: Item (Fixed at bottom, Icon: `delete`, Name: "Trash", Count)

### Footer
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
  - **Sort Field**: Button Group (Title / Date)
  - **Sort Direction**: Button (Icon: Arrow Up/Down)
  - **Divider**: Vertical Line
  - **Import**: Button (Icon: `upload_file`, Text: "Import")

#### Content
- **Folder Header**: Large Icon + Name + Item Count
- **Pinned Notes**: Section (Grid Cards or Compact Rows)
- **Other Notes**: Section (Grid Cards or Compact Rows)
- **Empty State**: Icon & Text (if no notes)

#### Floating Action Button (FAB)
- **New Note**: Fixed Button (Bottom-Right, Icon: `add`)

---

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (Editor Header)
*Located at the very top of the editor pane.*

- **Navigation (Left)**:
  - **Open Sidebar**: Button (Icon: `view_sidebar`) *Visible only when sidebar is closed*
  - **Navigation (Left)**:
    - **Return to Folder View**: Button (Icon: `drive_folder_upload`, Title: "Return to Folder View") 
  - **View Mode Tabs**: Segmented Control
    - `Editor`: Button (Icon: `edit`, Text: "Editor" - *Visible when active*)
    - `Preview`: Button (Icon: `visibility`, Text: "Preview" - *Visible when active*)
    - `Split`: Button (Icon: `view_column`, Text: "Split" - *Visible when active*)

- **Tools (Right)**:
  - **Font Size**: Select Box (12px - 20px)
  - **Divider**: Vertical Line
  - **Share**: Button (Icon: `share`, Text: "Share")
  - **Divider**: Vertical Line

#### Formatting Toolbar
*Located inside the editor area, above the text input.*


#### Editor Content
- **Title Input**: Large Text Input ("Untitled Note")
- **Metadata**: Date, Character Count, Folder Selector
- **Text Area**: CodeMirror Editor / Preview Pane

#### Editor Bottom Area (Fixed at bottom of Editor Pane)
- **Formatting Toolbar**:
  - **Desktop**: *Left-aligned*, fixed bar.
  - **Mobile**: *Floating Pill*, bottom-centered, sliding tools.
  - **Search**: Button (Icon: `search`)
  - **Formatting Tools**:
    - **Text Style**: Bold (`B`), Italic (`I`), Strike (`S`)
    - **Code**: Smart Code Button (`<>`) - *Inline (single line) or Block (multi-line)*
    - **Lists**: Bullet List, Checkbox
    - **Divider**: Vertical Line
    - **Insert**: Link (`link`)
    - **Divider**: Vertical Line
    - **Headings**: H1, H2, H3

#### Status Bar (Bottom Footer)
*Visible in all modes.*
- **Data Source**: Icon + Text (Database/Cloud/Sync)
- **Divider**: Vertical separator
- **Save Status**: Icon (`dns`) + Text ("Locally Saved")
- **Divider**: Vertical separator
- **Last Updated**: Text (Date & Time)
