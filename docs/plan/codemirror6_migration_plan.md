# CodeMirror 6 마이그레이션 계획 및 결과

기존의 `<textarea>` 기반 에디터를 **CodeMirror 6**로 교체하는 계획과 실행 결과입니다. `esm.sh`를 사용한 CDN 모듈 방식으로 빌드 없이 구현되었습니다.

## 1. 목표 (Objectives)
- **에디터 교체**: `textarea`를 `CodeMirror 6 EditorView`로 대체.
- **기능 유지 및 개선**:
  - 양방향 바인딩 (Vue state <-> Editor content).
  - 다크 모드 지원 (동적 테마 전환).
  - 마크다운 구문 강조 (Syntax Highlighting).
  - 키보드 단축키 (표준 + VS Code Keymap).
  - 검색 기능 (Native Search Panel).

## 2. 기술 전략 (Technical Strategy)
### CDN Import (ES Modules)
`esm.sh`를 통해 `app.js`에서 CodeMirror 6 패키지를 직접 import합니다.
- Core: `@codemirror/view`, `@codemirror/state`
- Language: `@codemirror/lang-markdown`
- Helpers: `@codemirror/commands`, `@codemirror/search`
- Theme: `@uiw/codemirror-theme-github` (Light/Dark)
- Keymap: `@replit/codemirror-vscode-keymap`

### 에디터 초기화 (Editor Initialization)
- **컨테이너**: `index.html`의 `.editor-container` 사용.
- **상태 관리**:
  - `Compartment`를 사용하여 테마 및 설정을 동적으로 업데이트.
  - `EditorView.updateListener`를 사용하여 Vue 데이터(`selectedNote`)와 동기화.
  - `vscodeKeymap` 도입으로 `Alt+Arrow` (줄 이동) 등 고급 편집 기능 확보.

## 3. 구현 단계 (Implementation Steps)

### 1단계: 준비 (Phase 1: Preparation)
- [x] 마이그레이션 계획 수립.
- [x] `index.html` 구조 변경 (`textarea` 제거 및 컨테이너 추가).
- [x] CodeMirror용 CSS 스타일(높이, 폰트 등) 추가.

### 2단계: 핵심 구현 (Phase 2: Core Implementation)
- [x] CodeMirror 6 모듈 Import (CDN).
- [x] `initEditor()` 함수 구현.
- [x] 확장(Extensions) 구성:
  - [x] 테마 (GitHub Light/Dark).
  - [x] 마크다운 언어 지원.
  - [x] 히스토리 및 키맵 (History, Keymaps).
  - [x] 줄바꿈 (Line Wrapping).
- [x] 데이터 동기화 구현 (Vue Watchers <-> Dispatch).

### 3단계: 기능 및 최적화 (Phase 3: Features & Polish)
- [x] 검색 패널 (Search Panel) 구현 및 스타일링 (2-Line Layout).
- [x] VS Code 키맵 적용 (`@replit/codemirror-vscode-keymap`).
- [x] 툴바 버튼 연결 (Bold, Italic, Search Toggle).
- [x] 모바일 사용성 검증 (터치, 가상 키보드).
- [x] 다중 커서(Multi-Cursor) 및 하이라이팅 지원.

## 4. 검증 (Verification)
- [x] 타이핑 퍼포먼스 및 렌더링 속도.
- [x] 데이터 저장(Local/Server) 동작 확인.
- [x] 다크 모드 전환 시 즉각 반영 확인.
- [x] 모바일 및 데스크탑 크로스 브라우징 확인.
