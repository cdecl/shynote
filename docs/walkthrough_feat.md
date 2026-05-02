# Walkthrough - Document Listing Mode & Toggle

I have added a Document Listing Mode to the Main Panel and implemented a toggle switch to easily transition between editing a note and viewing the folder list.

## Changes

### 1. Main Panel Toolbar (Editor Mode)
The left navigation area now provides a single action:
- **Sidebar Toggle Icon**: `left_panel_open` / `left_panel_close`
- **Behavior**:
  - Sidebar toggle opens Explorer on mobile and toggles sidebar visibility on desktop.
- *Note: The "Back to List" button was removed to streamline navigation; switching to the list now occurs by deselecting the note or using the sidebar.*

### 2. Main Panel Header (List Mode)
The List View header provides navigation and control actions.
- **Icons**:
  - Sidebar Toggle: `left_panel_open` / `left_panel_close`
- **Behavior**: Sidebar toggle opens Explorer on mobile and toggles sidebar visibility on desktop.
- *Note: The "Return to Editor" button was removed to simplify the header layout.*

### 3. Logic (`app.js`)
- **State Persistence**: The application now remembers your last view mode (`list` or `edit`) via `localStorage`.
- **Toggle Logic**: `openSidebarFromMainPanel()` handles responsive behavior.
  - Mobile: `setSidebarPanelMode('explorer')`
  - Desktop: `toggleSidebar()`
- **Edit Button Guard**: If no note is selected, the "Edit" button is disabled to prevent invalid transitions.

### 4. Layout Toggle (New)
문서 리스트 헤더의 토글로 **Grid**(Card)와 **List**(Row) 레이아웃을 전환할 수 있습니다.
- **Icon**: `grid_view` / `view_list`
- **Preference**: 선택값은 `localStorage`에 저장됩니다.
- **Design**:
    - **Grid**: 미리보기 본문 없이 제목 중심 카드 레이아웃. 카드 최소 너비를 보장해 제목 가독성을 확보.
    - **List**: 미리보기 본문 없이 제목 중심의 컴팩트 행 레이아웃.

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
