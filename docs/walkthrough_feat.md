# Walkthrough - Document Listing Mode & Toggle

I have added a Document Listing Mode to the Main Panel and implemented a toggle switch to easily transition between editing a note and viewing the folder list.

## Changes

### 1. Main Panel Toolbar (Editor Mode)
The "Back to Notes" button has been upgraded to a "Return to Folder View" button.
- **Icon**: `drive_folder_upload` (Parent Folder)
- **Behavior**: Switches the main view to the Document List, showing the parent folder of the current note.

### 2. Main Panel Header (List Mode)
A new "Return to Editor" button appears in the List View header when a note is active.
- **Icon**: `edit_note` (Edit)
- **Condition**: Only visible if you have a note selected.
- **Behavior**: Instantly switches back to the Editor for the active note.

### 3. Logic (`app.js`)
- **State Persistence**: The application now remembers your last view mode (`list` or `edit`) via `localStorage`.
- **Toggle Logic**: Robust switching ensures you don't lose context. If no note is selected, the "Edit" toggle is hidden (since there's nothing to edit).

### 4. Layout Toggle (New)
A new toggle in the Document List header allows switching between **Grid** (Card) and **List** (Row) layouts.
- **Icon**: `grid_view` / `view_list`
- **Preference**: Your choice is remembered via `localStorage`.
- **Design**:
    - **Grid**: classic card view with previews.
    - **List**: compact rows with truncated previews, perfect for scanning many files.

### 5. Content Header (New)
Moved the folder information from the sticky toolbar to the content area for a unified "File Explorer" feel.
- **Location**: Top of the scrollable list.
- **Layout**: Single line header: `[Icon] [Folder Name] · [Item Count]`
- **Behavior**: Scrolls with the content, leaving more space for tools in the toolbar.

### 6. Date Format
- **Date Format**: Standardized date display (YYYY-MM-DD HH:MM) across Grid and List views.
- **Pin Button Refinement**: Wrapped pin button in `w-8 h-8` container and adjusted padding to `p-0.5` to ensure consistent alignment and spacing for both pinned and unpinned states.

### 7. Pinned List Indication
Pinned items in the list view now display a visible **Push Pin** icon on the left to clearly distinguish them from regular notes.

### 8. Compact List View
Reduced the list item height (padding `py-3` → `py-2`, gap `4` → `3`) to approximately 1/4 of the Grid Card height for a denser, information-rich layout.

### 9. Unified Pin Button Style
The List View now uses the same absolute-positioned "Push Pin" button logic as the Grid View, ensuring consistent visual feedback and behavior (visible on mobile, hover on desktop for unpinned items).

### 10. Editor Readability
- **Selection Visibility**: Enhanced the text selection background color in Dark Mode to `rgba(235, 203, 139, 0.4)` (Nord13 Yellow), creating a high-contrast 'yellowish' highlight for better readability.

## Verification Results

### Manual Test Scenarios

| Scenario | Action | Expected Result |
| :--- | :--- | :--- |
| **Switch to List Mode** | Click `List` icon in Editor | View changes to Folder List. Current note remains "selected" internally. |
| **Return to Edit** | Click `Edit` icon in List Header | View changes back to Editor. Content matches selected note. |
| **Grid/List Toggle** | Click `Grid/List` icon in Folder Header | View toggles between Card Grid and Compact List row layout. |
| **Change Note** | Click a different note in List | View switches to Editor for the *new* note. |
| **Empty State** | Go to List, reload app | App remembers List mode (persisted). |
