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
- **Inbox**: Item (Icon: `inbox`, Name: "Inbox", Count)
- **My Folders**: Section Header
  - **Folder Items**: List (Icon: `folder`, Name: User Defined, Count)

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
  - **Folder Icon**: Icon (`inbox` or `folder`)
  - **Folder Name**: Text

- **Controls (Right)**:
  - **Sort Field**: Button Group (Title / Date)
  - **Sort Direction**: Button (Icon: Arrow Up/Down)
  - **Divider**: Vertical Line
  - **Import**: Button (Icon: `upload_file`, Text: "Import")

#### Content
- **Pinned Notes**: Section (Grid of note cards)
- **Other Notes**: Section (Grid of note cards)
- **Empty State**: Icon & Text (if no notes)

#### Floating Action Button (FAB)
- **New Note**: Fixed Button (Bottom-Right, Icon: `add`)

---

### (B) Editor Mode (`rightPanelMode === 'edit'`)

#### Top Toolbar (Editor Header)
*Located at the very top of the editor pane.*

- **Navigation (Left)**:
  - **Open Sidebar**: Button (Icon: `view_sidebar`) *Visible only when sidebar is closed*
  - **View Mode Tabs**: Segmented Control
    - `Editor`: Button (Icon: `edit`, Text: "E")
    - `Preview`: Button (Icon: `visibility`, Text: "P")
    - `Split`: Button (Icon: `view_column`, Text: "S")

- **Tools (Right)**:
  - **Font Size**: Select Box (12px - 20px)
  - **Divider**: Vertical Line
  - **Share**: Button (Icon: `share`, Text: "Share")
  - **Divider**: Vertical Line

#### Formatting Toolbar
*Located inside the editor area, above the text input.*

- **Navigation (Left)**:
  - **Back to Notes**: Button (Icon: `arrow_back_ios_new`, Text: "NOTES")

- **Formatting Tools (Center/Right)**:
  - **Text Style**: Bold (`B`), Italic (`I`), Strike (`S`)
  - **Code**: Inline Code (`<>`), Code Block (`terminal`)
  - **Lists**: Bullet List, Checkbox
  - **Divider**: Vertical Line
  - **Insert**: Link (`link`)
  - **Divider**: Vertical Line
  - **Headings**: H1, H2, H3
  - **Search**: Button (Icon: `search`)

#### Editor Content
- **Title Input**: Large Text Input ("Untitled Note")
- **Metadata**: Date, Character Count, Folder Selector
- **Text Area**: CodeMirror Editor / Preview Pane

#### Status Bar (Bottom Footer)
*Located at the very bottom of the screen.*

- **Data Source**: Icon + Text (Database/Cloud/Sync)
- **Divider**: Vertical separator
- **Save Status**: Icon (`dns`) + Text ("Locally Saved")
- **Divider**: Vertical separator
- **Last Updated**: Text (Date & Time)
