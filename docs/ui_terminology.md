# SHYNOTE UI 용어 정의 (UI Terminology)

이 문서는 SHYNOTE 프로젝트에서 사용하는 UI 구성요소의 명칭을 정의합니다.

## 1. 전체 레이아웃 (Layout)
*   **사이드바 (Sidebar)**: 좌측 네비게이션 영역. 폴더 목록 등을 포함합니다.
*   **메인 패널 (Main Panel)**: 우측의 주요 작업 영역입니다. (User: '우측 패널')
    *   코드상 변수명: `rightPanelMode`

## 2. 사이드바 구성요소 (Sidebar Components)
*   **시스템 폴더 (System Folders)**: `Inbox` (Home), `Trash` (휴지통) 등 기본 제공 폴더 영역입니다.
*   **사용자 폴더 (User Folders)**: 사용자가 생성한 `My Folders` 목록 영역입니다.
*   **하단 바 (Sidebar Footer)**: 설정(Settings), 정보(About) 버튼이 위치한 하단 영역입니다.

## 3. 메인 패널 모드 (Main Panel Modes)
메인 패널은 상황에 따라 두 가지 뷰(View)로 전환됩니다.

### A. 노트 리스트 뷰 (Note List View)
폴더를 선택했을 때 나타나는 **카드형/그리드형 노트 목록** 화면입니다. (User: '문서 리스트 모드')

*   **리스트 헤더 (List Header)**: 폴더명, 정렬(Sort) 옵션이 있는 상단 바.
*   **핀 고정 노트 (Pinned Notes)**: 상단에 고정된 중요 노트 섹션.
*   **일반 노트 (Notes)**: 나머지 일반 노트 섹션.
*   **플로팅 액션 버튼 (FAB)**: 우측 하단의 `+` 노트 생성 버튼.
*   **파일 가져오기 (File Import)**: 리스트 영역에 텍스트 파일(.md, .txt 등)을 드래그 앤 드롭하여 새 노트를 생성할 수 있습니다. (용량 제한: 1MB)

### B. 에디터 뷰 (Editor View)
특정 노트를 선택했을 때 나타나는 **문서 편집/열람** 화면입니다. (User: '문서 상세 (편집) 모드')

*   **툴바 (Toolbar)**: 상단의 서식 도구 및 보기 모드 전환 버튼 등이 있는 영역.
*   **보기 모드 (View Modes)**:
    *   **Editor**: 편집 전용 모드.
    *   **Preview**: 읽기 전용 모드.
    *   **Split**: 편집 화면과 미리보기를 동시에 표시하는 모드.
