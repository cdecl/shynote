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

---

## 3. Command Palette (전역 오버레이)

### 개요
*`Cmd+P` / `Ctrl+P` 또는 헤더의 `menu_open` 버튼으로 활성화되는 모달 다이얼로그*

### 구조
- **배경**: 고정 오버레이 (`fixed inset-0 z-[1000]`)
- **컨테이너**: 중앙 정렬 모달 (`flex items-center justify-center`)
- **최대 크기**: `max-w-2xl` 너비, `max-h-[60vh]` 높이

### 구성 요소
- **검색 입력**: 플레이스홀더가 있는 텍스트 입력
- **결과 목록**: 필터링된 항목의 스크롤 가능한 목록
- **키보드 탐색**: 화살표 키, Enter, Escape

### 모드
| 모드 | 용도 |
|------|------|
| commands | 명령 검색/실행 |
| notes | 노트 검색/선택 |
| folders | 폴더 탐색 |
| move-dest | 노트 이동 |

### 메뉴 구조 (Commands 모드)

#### 기본 메뉴 (모든 화면 모드, 8개)
*리스트 뷰와 에디터 모드 모두에서 표시*

1. **Go to Note...** (`Cmd+P`)
   - 아이콘: `search`
   - 설명: 파일 검색 및 이동

2. **Go to Folder...**
   - 아이콘: `folder_open`
   - 설명: 폴더 이동

3. **Create New Note** (`Cmd+Shift+N`)
   - 아이콘: `add_circle`
   - 설명: 새 노트 생성

4. **Toggle Sidebar**
   - 아이콘: `menu_open`
   - 설명: 사이드바 토글 On/Off

5. **Toggle Dark Mode**
   - 아이콘: `dark_mode`
   - 설명: 다크 모드 전환

6. **Sync Now**
   - 아이콘: `sync`
   - 설명: 강제 동기화 수행 (Pull Only)

7. **Clear Local Cache**
   - 아이콘: `delete_sweep`
   - 설명: 캐시 및 데이터 초기화

8. **Reload App**
   - 아이콘: `refresh`
   - 설명: 앱 새로고침

#### 에디터 모드 전용 메뉴 (6개 추가)
*`rightPanelMode === 'edit' && selectedNote` 조건에서만 표시*

1. **Rename Note** (`F2`)
   - 아이콘: `edit`
   - 설명: 제목 수정

2. **Move Note**
   - 아이콘: `drive_file_move`
   - 설명: 폴더 이동

3. **Delete Note** (`Cmd+Backspace`)
   - 아이콘: `delete`
   - 설명: 파일 삭제

4. **Switch View Mode**
   - 아이콘: `view_agenda`
   - 설명: 보기 모드 전환 (Split / Edit / Preview)

5. **Edit Table**
   - 아이콘: `table_chart`
   - 설명: 현재 표 편집 또는 신규 생성

6. **Show File Info**
   - 아이콘: `info`
   - 설명: 글자수, 수정일 등 상세 정보

> **참고**: 글자 크기 조절(Zoom In/Out)은 에디터 헤더의 Font Size 선택기(`text_fields` 아이콘 + `expand_more` 드롭다운)를 통해 제어됩니다.

### 메뉴 표시 규칙
- **리스트 뷰**: 기본 메뉴 8개만 표시
- **에디터 모드 (노트 선택됨)**: 총 14개 메뉴 표시 (기본 8개 + 에디터 전용 6개)
- **에디터 모드 (노트 미선택)**: 기본 메뉴 8개만 표시
