# v0.4.3 Release Notes

## Summary
- **Google OAuth (리다이렉트)**: 모바일 및 시크릿 모드 호환성을 위해 로그인 방식을 팝업에서 **리다이렉트(Redirect)** 방식으로 전면 변경했습니다.
- **모바일 스와이프**: 왼쪽/오른쪽 스와이프로 사이드바 열기/닫기 및 뒤로가기 제스처를 완성했습니다.
- **안정성 강화**: Trash 폴더 동기화 에러 및 CodeMirror 404 에러 등 치명적인 버그를 수정했습니다.

## Changes
- **Auth**:
    - **Redirect Flow**: `invalid_client` 및 Origin 에러를 해결하기 위해 구글 로그인 프로세스 변경.
    - **Global Redirect**: PC/Mobile 구분 없이 리다이렉트 방식 통일로 안정성 확보.
- **Mobile UX**:
    - **Swipe Navigation**: 왼쪽 스와이프(닫기) 및 오른쪽 스와이프(열기/뒤로가기) 로직 통합.
- **Bug Fixes**:
    - **Trash Sync**: 동적 Trash ID(`trash-{userId}`) 적용 및 마이그레이션으로 500 에러 해결.
    - **CodeMirror**: 불필요한 CSS 링크 제거로 404 콘솔 에러 해결.

---

# v0.4.2 Release Notes

## Summary
- **Mermaid Support**: 프리뷰 창에서 다이어그램 및 차트를 렌더링 할 수 있는 Mermaid.js를 통합했습니다.
- **Theme Optimization**: 다크 모드 테마 일관성을 위해 Nord 테마를 강제 적용하고 불필요한 테마 로딩을 최적화했습니다.

## Changes
- **Diagrams**: ` ```mermaid ` 블록을 통한 다이어그램 렌더링 기능 추가
- **Nord Theme**: 다크 모드 전환 시 Nord 테마가 명확하게 적용되도록 로직 수정
- **CDN Stability**: CodeMirror CSS를 `unpkg`로 복구하여 로딩 안정성 확보
- **Asset Fix**: 누락되었던 Pretendard 폰트 캐싱 복구

---

# v0.4.1 Release Notes

## Summary
- **Trash (휴지통)**: 노트와 폴더를 영구 삭제하기 전에 휴지통으로 이동시키는 안전 장치를 추가했습니다.
- **오프라인 안정성**: IndexedDB 라이브러리(`idb`) 캐싱을 통해 오프라인 환경에서의 데이터 신뢰성을 보장합니다.

## Changes
- **Trash (휴지통)**:
    - **Move to Trash**: 노트/폴더 삭제 시 즉시 제거되지 않고 Trash 폴더로 이동합니다.
    - **Empty Trash**: 휴지통 비우기 기능을 통해 영구 삭제가 가능합니다.
    - **Restoration**: Trash 폴더에서 노트를 다른 폴더로 이동하여 복구할 수 있습니다.
- **Trash (휴지통)** 기능 추가 (영구 삭제, 복구 가능)
- **Offline Reliability**: Service Worker 캐시에 `idb` 라이브러리 추가
- **UI Refinement**: 에디터 다크모드 테마를 **Nord**로 변경 및 UI 폰트 크기 조정
- **UI consistency**: 폴더 및 휴지통의 문서 개수(0포함)를 항상 표시하도록 수정
- **Offline Reliability**:
    - **Cache Dependency**: Service Worker 캐시에 `idb` 라이브러리를 추가하여 오프라인 로드 오류를 방지했습니다.

---

# v0.4.0 Release Notes

## Summary
- **오프라인 안정성 강화**: 폴더 삭제 시 원자적 트랜잭션(Atomic Transaction)을 적용하여 오프라인 환경에서의 오류를 해결했습니다.

## Changes
- **Offline Reliability**:
    - **Atomic Delete**: 폴더 삭제 시 내부 노트와 폴더를 한 번의 트랜잭션으로 처리하여 데이터 무결성 보장.

---

# v0.3.7 Release Notes

## Summary
- **이미지 업로드**: 드래그 앤 드롭 및 붙여넣기를 통한 이미지 업로드 기능을 추가했습니다.
- **데이터 안정성**: 폴더 동기화 로직을 개선하여 데이터 유실 없는 안정적인 환경을 구축했습니다.

## Changes
- **Image Upload**:
    - **Drag & Drop**: 에디터에 이미지 파일을 드래그하여 즉시 업로드.
    - **Paste**: 클립보드 이미지를 붙여넣어 업로드.
    - **Supabase Storage**: 빠르고 안전한 이미지 호스팅 연동.
- **Bug Fixes**:
    - **Folder Sync**: 초기 로딩 및 동기화 시 폴더 목록이 깜빡이거나 사라지는 문제 수정.
    - **Status visibility**: 노트 리스트 화면에서도 동기화 상태(Syncing...)가 보이도록 UI 개선.

---
# v0.3.6 Release Notes

## Summary
- **에디터 UI 개선**: 툴바 위치 재조정, 버튼 통합, 모바일 대응 등 사용성을 대폭 개선했습니다.
- **모바일 경험 강화**: 플로팅 툴바 도입 및 백 버튼 레이블 개선으로 모바일 환경 편의성을 높였습니다.

## Changes
- **Toolbar Refactoring**:
    - **통합 코드 버튼**: 인라인/블록 코드를 하나의 버튼(`< >`)으로 통합 (지능형 감지).
    - **좌측 정렬**: 툴바 아이템을 좌측으로 정렬하여 직관성 확보.
    - **위치 변경**: 메인 패널 하단에서 에디터 내부 하단으로 이동 (프리뷰 모드 시 숨김).
- **Mobile Enhancements**:
    - **Floating Toolbar**: 모바일 화면에서 하단에 떠 있는 캡슐(Pill) 형태의 툴바 적용.
    - **Dynamic Back Button**: "Back to Notes" 버튼에 상위 폴더명을 표시하여 네비게이션 컨텍스트 제공.
- **UI Polish**:
    - **뷰 모드 버튼**: 활성화된 탭만 텍스트 레이블 표시 (아이콘 중심 디자인).
    - **Scrollbar**: 툴바에 얇은 오버레이 스크롤바 적용 (평소 투명, 호버 시 노출).

---

# v0.3.5 Release Notes

## Summary
- **VS Code 키맵**: `@replit/codemirror-vscode-keymap`을 도입하여 익숙한 단축키(`Alt+Arrows`, `Cmd+D` 등)를 지원합니다.
- **검색 툴바 버튼**: 에디터 툴바에 전용 검색 버튼(돋보기 아이콘)을 추가했습니다.
- **검색 토글**: 검색 버튼 클릭 시 패널을 열고 닫을 수 있습니다 (Toggle 방식).
- **다중 커서 복구**: 다중 커서 및 선택 하이라이팅 기능을 복구하고 키맵 충돌(`Cmd+K`)을 해결했습니다.
- **가이드 업데이트**: CodeMirror 6 및 새로운 기능을 반영하여 문서를 업데이트했습니다.

## Changes
- **VS Code Keymap (키맵 적용)**: 표준 단축키 지원을 위해 VS Code Keymap 패키지 추가:
    - `Alt + ↑ / ↓`: 줄 이동
    - `Shift + Alt + ↑ / ↓`: 줄 복사
    - `Cmd + D`: 다음 일치 항목 선택 (다중 커서)
    - `Mod-k` 충돌 해결 (링크 삽입 정상 작동).
- **Search Button**: 에디터 툴바에 돋보기 아이콘 추가.
- **Search Toggle**: 검색 버튼 클릭 시 패널 열기/닫기 동작 구현.

### Fixed
- **Multi-Cursor**: 다중 커서 기능(`Alt + Click`, `Cmd + D`) 정상 동작 검증 완료.
- **Editor Guide**: 최신 변경 사항 반영하여 문서 현행화.

---

# v0.3.4 Release Notes

## Summary
- **GitHub Markdown 렌더링**: Preview 모드에서 GitHub 스타일의 마크다운 렌더링 적용 (Light/Dark 모드 지원)
- **YAML Frontmatter 지원**: 문서 상단의 YAML 메타데이터를 테이블 형식으로 표시
- **모바일 스와이프 네비게이션**: 오른쪽 스와이프로 직관적인 화면 전환
- **UI 설정 로컬 우선**: 다크 모드 및 뷰 모드 설정을 localStorage에서 관리
- **성능 최적화**: 중복 초기화 제거 및 로딩 속도 개선

## Changes

### 1. GitHub-Style Markdown Rendering
- **Preview 모드 개선**: GitHub Markdown CSS 적용으로 전문적인 문서 렌더링
- **Nord 테마 다크 모드**: 앱 전체 테마와 일관된 Nord 색상 팔레트 적용
- **동적 테마 전환**: Light/Dark 모드 전환 시 마크다운 CSS 자동 교체
- **폰트 통일**: Inter, Spoqa Han Sans Neo, JetBrains Mono 일관 적용

### 2. YAML Frontmatter Support
- **메타데이터 파싱**: 문서 상단의 YAML 블록(`---`)을 자동 감지 및 파싱
- **테이블 렌더링**: Key-Value 형태의 메타데이터를 구조화된 테이블로 표시
- **Nord 테마 적용**: 다크 모드에서 Ice Blue 키 색상 적용

### 3. Mobile Swipe Navigation
- **문서 리스트 화면**: 오른쪽 스와이프 → 사이드바 표시
- **문서 상세 화면**: 오른쪽 스와이프 → 문서 리스트로 돌아가기
- **스크롤 보호**: 세로 스크롤과 구분하여 가로 스와이프만 감지 (50px 임계값)

### 4. UI Settings Management
- **로컬 우선 정책**: `is_dark_mode`, `view_mode` 설정을 서버 대신 localStorage에서 관리
- **기본 뷰 모드 변경**: Split → Edit 모드로 기본값 변경
- **일관된 사용자 경험**: 기기 간 설정 충돌 방지

### 5. Performance Improvements
- **중복 초기화 제거**: `initEditor()` 중복 호출 문제 해결
- **중복 fetch 제거**: `onMounted` 중복 블록 제거로 데이터 로딩 최적화
- **즉시 에디터 초기화**: `nextTick` 제거로 문서 로딩 체감 속도 향상

### 6. Code Cleanup
- **미사용 기능 제거**: `isSidebarPinned`, `collapsedFolders` 관련 코드 완전 제거
- **중복 export 제거**: 중복된 함수 export 정리

## Bug Fixes
- **LocalDB 메서드 오류 수정**: `getFolders` → `getAllFolders` 메서드명 수정
- **Vue 경고 해결**: `onBeforeUnmount` 위치 수정으로 lifecycle hook 경고 제거

---

# v0.3.3 Release Notes

## Summary
- **초기 로딩 최적화**: 데이터를 불러올 때 사이드바 목록이 깜빡이거나 두 번 로딩되는 현상을 제거했습니다.
- **병렬 데이터 처리**: 폴더와 노트 데이터를 동시에 불러와 앱 구동 속도가 더욱 빨라졌습니다.

## Changes
- **Optimistic UI Loading**: 로컬 데이터가 있으면 즉시 화면을 표시하고, 네트워크 요청은 백그라운드에서 처리합니다.
- **Redundant Update Protection**: 서버 데이터가 로컬과 동일할 경우 불필요한 화면 갱신을 방지합니다.

---

# v0.3.2 Release Notes

## Summary
- **상태 보존(State Persistence)**: 마지막으로 방문한 폴더, 선택한 문서, 뷰 모드(List/Edit)가 새로고침 후에도 유지됩니다.
- **UI 통일성 강화**: Inbox와 My Folders의 디자인 테마를 Blue 계열로 통일하고 가독성을 개선했습니다.
- **에디터 툴바 개선**: 툴바 좌측 여백을 제거하여 공간 효율을 높였습니다.

## Changes

### 1. State Persistence (상태 보존)
- **Last Status**: 앱 실행 시 마지막 작업 위치(폴더/노트)와 화면 모드(List/Split/Left)를 자동 복구합니다.
- **UX**: 불필요한 내비게이션 단계를 줄여 작업 연속성을 보장합니다.

### 2. UI Refinements (UI 개선)
- **Unified Theme**: 사용자 폴더(My Folders)의 선택 배경색을 Amber → Blue 테마로 변경하여 Inbox와 일관성을 확보했습니다.
- **Toolbar Layout**: 에디터 상단 툴바의 불필요한 좌측 마진을 제거하고, 사이드바 토글 버튼이 없을 때의 레이아웃을 최적화했습니다.

---

# v0.3.1 Release Notes

## Summary
- **iOS 스타일 UI 적용**: 아이콘 및 레이아웃을 iOS 스타일로 변경하여 더욱 세련된 경험 제공
- **사이드바 동작 최적화**: 모바일 자동 닫힘 및 데스크톱 닫힘 상태 시각적 결함 수정
- **사용자 경험 개선**: 폰트 크기 확대 및 새 문서 이름 자동 생성 규칙 변경

## UI/UX Improvements

### 1. iOS-Style Visuals (iOS 스타일 적용)
- **아이콘 변경**:
  - 사이드바 닫기 (Back): `arrow_back_ios_new` (얇은 화살표)
  - 사이드바 열기 (Open): `view_sidebar`
  - 편집 (Rename): `edit_square`
- **토글 버튼 위치 최적화**:
  - 사이드바 **열림**: 닫기 버튼이 사이드바 헤더 내부로 이동 (오른쪽 패널에서 제거)
  - 사이드바 **닫힘**: 열기 버튼이 메인 툴바/리스트 툴바 왼쪽에 표시

### 2. Sidebar Improvements (사이드바 개선)
- **모바일 UX**: 폴더 선택 시 사이드바 자동 닫힘 (이벤트 버블링 버그 수정)
- **데스크톱 시각적 결함 수정**: 사이드바 닫힘 시 콘텐츠가 희미하게 보이는(Ghost Content) 현상 해결

### 3. Readability & Usability (가독성 및 사용성)
- **폰트 크기 확대**: 노트 리스트 아이템의 폰트 크기 +2px 증가 (Title 16px, Content 14px)
- **새 문서 명명 규칙**: `Untitled` 대신 `Note YYYY-MM-DD (hash)` 형식으로 자동 생성되어 식별 용이

---

# v0.3.0 Release Notes

## Summary
- **UI/UX 대폭 개선**: iOS 스타일의 모던한 디자인 적용 및 사용자 경험 향상
- **정렬 기능 강화**: 인라인 정렬 컨트롤 및 직관적인 레이블 추가
- **노트 구성 개선**: PIN된 노트와 일반 노트를 섹션으로 분리하여 가독성 향상

## UI/UX Improvements

### 1. iOS-Style Sidebar Redesign (사이드바 재디자인)
- **그룹화된 카드 디자인**: 시스템 폴더와 사용자 폴더를 별도 카드로 구분
- **구분선 추가**: 각 항목 사이에 미세한 separator 라인 적용
- **Filled 아이콘**: 모든 아이콘에 채움 효과 적용 (Inbox: 파란색, Folders: 노란색)
- **섹션 헤더**: "MY FOLDERS" 대문자 레이블로 명확한 구분
- **개선된 간격**: 더 여유로운 터치 영역 (`py-2.5`) 및 카드 간격 (`space-y-4`)

### 2. Sidebar Behavior Changes (사이드바 동작 변경)
- **Push Layout**: 사이드바가 콘텐츠를 밀어내는 방식으로 변경 (오버레이 제거)
- **패널 아이콘**: 햄버거 메뉴 대신 `left_panel_open/close` 아이콘 사용
- **자동 닫힘 제거**: 노트 선택 시 사이드바가 자동으로 닫히지 않음

### 3. Sort Controls Enhancement (정렬 컨트롤 개선)
- **인라인 디자인**: 드롭다운 대신 헤더에 직접 표시되는 정렬 버튼
- **Title / Date 토글**: 세그먼트 컨트롤 스타일의 필드 선택
- **방향 표시**: 화살표 아이콘 + "New" / "Old" 레이블로 직관적 표현
- **즉시 반영**: 클릭 한 번으로 정렬 변경

### 4. Pinned Notes Section (PIN 노트 섹션)
- **섹션 분리**: "📌 PINNED"와 "📄 NOTES" 섹션으로 구분
- **자동 그룹화**: PIN된 노트는 항상 최상단에 표시
- **빈 섹션 숨김**: PIN된 노트가 없으면 섹션 자체가 숨겨짐
- **독립 정렬**: 각 섹션 내에서 정렬 옵션 적용

### 5. Visual Refinements (시각적 개선)
- **핀 아이콘 축소**: 노트 카드의 핀 아이콘 크기 50% 감소 (20px → 10px)
- **Settings 모달**: 색상 테마를 앱 전체와 통일
- **About 모달**: 앱 로고 추가 및 changelog 링크 제공
- **Share 버튼**: 로딩 스피너 추가로 피드백 개선

## Bug Fixes & Technical Improvements

### 1. UUIDv7 Compatibility (호환성 개선)
- **parseInt 제거**: User ID를 문자열로 유지하여 타입 불일치 해결
- **중복 호출 방지**: `fetchFolders()` 2번 호출 문제 수정
- **전체 검토**: 모든 ID 비교 로직 검증 완료

### 2. Service Worker Cache Management (캐시 관리)
- **Clear Local Cache 강화**: 서비스 워커 캐시 및 등록 해제 기능 추가
- **캐시 버전 관리**: v1 → v5 (주요 업데이트마다 자동 갱신)

### 3. Hash-Based Sync (해시 기반 동기화)
- **UUIDv7 호환**: 해시 생성 로직이 문자열 ID와 완벽 호환
- **최적화 유지**: 변경되지 않은 노트는 IndexedDB 쓰기 생략

---

# v0.2.5 Release Notes

## Summary
- 설정(Settings) UI를 대폭 개선하고, 데이터 관리(캐시 삭제, 초기화) 기능을 강화했습니다.

## New Features
- **Settings UI Redesign**: 아이콘 중심의 컴팩트한 디자인 적용 및 화면 비율 최적화.
- **Danger Zone**: 안전한 앱 관리를 위한 'Clear Cache' 및 'Factory Reset' 기능 추가.
- **UX 개선**: 리네임 시 텍스트 자동 선택, 노트 삭제 시 확인 절차(Ask) 일관성 강화.

---

# v0.2.3 Release Notes

## Summary
- **Local-First Sync Architecture** 도입으로 오프라인 작업과 데이터 동기화 안정성을 대폭 강화했습니다. (v0.2.0의 고도화 작업 완료)
- **Auto Recovery** 및 **Dependency Ordering** 로직을 통해 동기화 오류를 스스로 복구하는 "자가 치유" 시스템을 구축했습니다.

## New Features & Fixes

### 1. Robust Sync System (동기화 안정성)
- **Auto Recovery (자가 치유)**: 서버 동기화 실패(404) 시 자동으로 데이터를 재생성(Upsert)하여 유실된 데이터를 복구합니다.
- **Folder Priority Ordering**: 동기화 시 폴더를 노트보다 먼저 처리하여 "Invalid Folder ID" 오류를 원천 차단했습니다.
- **Dirty State Protection**: 로컬에서 수정 중인 내용이 서버 데이터에 의해 덮어씌워지지 않도록 강력하게 보호합니다.

### 2. Core Improvements
- **UUID v7 Migration**: 모든 데이터(노트, 폴더)의 ID 체계를 시간 순 정렬이 가능한 UUID v7으로 전환했습니다.
- **List Sync Fix**: 노트를 클릭하여 서버에서 데이터를 갱신할 때, 사이드바 목록 정보(제목 등)가 즉시 반영되지 않던 문제를 해결했습니다.
- **Bug Fixes**: `pinnedNotes` 변수 누락으로 인한 오류 및 각종 Syntax Error 수정.

---

# v0.2.2 Release Notes

## Summary
- **사이드바 UI 대폭 개편**: 더 깔끔하고 직관적인 인터페이스로 전환했습니다.
- **아이콘 가독성 강화**: 라이트/다크 모드에서 모든 아이콘의 대비를 개선했습니다.
- **접힌 패널 UX 개선**: 축소 모드에서도 주요 기능에 빠르게 접근할 수 있습니다.

## UI/UX Improvements

### 1. 사이드바 디자인 개편 (Sidebar Redesign)
- **컴팩트 리스트 스타일**: 카드형에서 리스트형으로 전환하여 정보 밀도 향상
- **높이 최적화**: 문서/폴더 항목 높이를 10% 축소하여 한 화면에 더 많은 내용 표시
- **인라인 삭제 확인**: 모달 대신 항목 하단에 Y/N 확인 박스 표시로 빠른 작업 가능
- **컬러 테마 적용**:
  - 노트: Indigo 테마 (선택/호버)
  - 폴더: Amber 테마 (선택/호버)
  - 추가 버튼: Emerald Green

### 2. 아이콘 가독성 강화 (Icon Readability)
- **Filled 스타일**: 모든 아이콘에 'FILL' 속성 적용으로 내부 색상 채움
- **대비 개선**:
  - 라이트 모드: 더 진한 slate 색상 사용
  - 다크 모드: 더 밝은 slate 색상 사용
- **폴더 아이콘**: 라이트 모드에서 amber-500, 다크 모드에서 yellow-400 적용

### 3. 접힌 패널 기능 강화 (Collapsed Panel Features)
- **핀 버튼 상시 표시**: Info 아이콘 위에 Pin 버튼 배치
- **핀 클릭 시 자동 열림**: 접힌 상태에서 핀 클릭 시 패널이 열리며 핀 ON
- **새 문서/폴더 버튼 추가**: 접힌 상태에서도 새 문서, 새 폴더 생성 가능
- **자동 리네임 모드**: 새 문서/폴더 생성 시 패널이 열리며 즉시 이름 수정 모드 진입

### 4. 상호작용 개선 (Interaction Improvements)
- **더블클릭 리네임 지원**: 패널 닫힘 지연(300ms)으로 더블클릭 리네임 동작 보장
- **폴더 문서 개수 표시**: 각 폴더 우측에 포함된 문서 개수 배지 표시

---

# v0.2.1 Release Notes

## Summary
- **동기화 충돌 해결(Conflict Resolution) UI**를 구현하여 데이터 정합성을 강화했습니다.
- **Hash 기반 동기화 로직**을 도입하여 파일 비교 효율성과 정확도를 높였습니다.
- 서버 삭제 내역을 로컬에 반영하는 삭제 동기화 로직을 추가했습니다.

## New Features

### 1. Conflict Resolution (충돌 해결)
- **Conflict Banner**: 서로 다른 기기에서 수정하여 충돌 발생 시, 에디터 상단에 경고 배너를 표시합니다.
- **Diff & Merge UI**: CodeMirror MergeView를 도입하여 **내 노트(Left)**와 **서버 노트(Right)**를 나란히 비교하고, 원하는 버전을 선택하여 병합할 수 있습니다.

### 2. Sync Logic Enhancement (동기화 로직 개선)
- **Hash Verification**: SHA-256 해시를 이용한 정밀한 변경 감지로 불필요한 덮어쓰기를 방지합니다.
- **Deletion Sync**: 서버에서 삭제된 노트가 로컬에 남아있는 "좀비 데이터" 현상을 해결했습니다.

---

# v0.2.0 Release Notes

## Summary
- **Local-first Architecture**를 도입하여 오프라인 환경에서도 끊김 없는 작업 경험을 제공합니다.
- 초기 로딩 속도(0ms)와 데이터 안정성을 대폭 강화했습니다.

## New Features

### 1. Local-first & Offline Support (로컬 우선 아키텍처)
- **IndexedDB 기반 저장소**: 작성 중인 문서와 폴더 구조가 브라우저 내장 DB에 자동 저장됩니다.
- **즉시 로딩 (Instant Load)**: 서버 연결 없이도 앱 실행 즉시 이전에 작업하던 내용을 볼 수 있습니다.
- **오프라인 작업 지원**: 인터넷 연결이 끊겨도 문서 작성 및 수정이 가능하며, 데이터 유실이 없습니다.

### 2. Smart Sync & UI (동기화 및 UI)
- **Background Sync**: 네트워크 연결 시 백그라운드에서 자동으로 서버와 동기화됩니다.
- **상태 인디케이터**: 툴바 우측 상단에 로컬 저장소 활성화 여부와 동기화 상태(Spinning Icon)가 표시됩니다.
- **충돌 방지 (Last Write Wins)**: 사용자가 작성 중인 최신 내용(Dirty State)을 우선적으로 보호합니다.

### 3. UX Improvements
- **Splash Screen**: 다크 모드 초기 구동 시 발생하던 화이트 플래시(White Flash) 현상을 제거했습니다.

---

# v0.1.0 Release Notes

## Summary
- **CodeMirror 6** 엔진 전면 도입을 통해 성능, 안정성, 확장성을 확보했습니다.
- 다크 모드 UI/UX를 대폭 개선하고 가독성을 강화했습니다.

## New Features & Improvements

### 1. Editor Engine Upgrade (CodeMirror 6)
- **CodeMirror 6 Migration**: 최신 에디터 엔진 도입으로 성능 향상 및 확장성 확보 (Textarea 한계 극복).
- **Native Search**: CodeMirror 네이티브 검색 기능 도입으로 빠르고 정확한 검색/치환 지원.

---

# v0.0.6 Release Notes

## Summary
- 에디터 엔진을 CodeMirror에서 순수 Textarea로 회귀하여 모바일 호환성을 개선하고, 성능 안정화를 위한 대대적인 리팩토링을 진행했습니다.

## Changes

### 1. 에디터 엔진 변경 (Editor Engine Switch)
- **Textarea 복귀**: CodeMirror 5를 제거하고 가벼운 표준 `textarea`로 교체하여 모바일 WebKit 브라우저에서의 충돌 및 로딩 문제를 해결했습니다.
- **기능 이식 (Feature Porting)**:
  - **서식 단축키**: `Bold(Cmd+B)`, `Italic(Cmd+I)`, `Link(Cmd+K)` 등 주요 단축키 지원.
  - **탭 들여쓰기**: `Tab` 키로 4칸 들여쓰기(Space) 지원.
  - **플로팅 툴바**: 텍스트 선택 시 포맷팅 툴바 표시 (마우스 지원).
  - **찾기/바꾸기**: `Textarea` 호환 검색 위젯 재구현.

### 2. 성능 및 안정성 (Performance & Stability)
- **초기 로딩 속도 50% 향상**: `Promise.all`을 이용한 병렬 데이터 페칭 도입.

---

### 2. UI/UX 개선 (Interface Improvements)
- **탭 기반 뷰 전환 (Tabbed Views)**:
  - `[Editor]`, `[Preview]`, `[Split View]` 탭을 통해 직관적으로 모드 전환.
  - Split View 모드에서도 탭 바가 유지되어 일관된 경험 제공.
- **테마 통일 (Unified Theme)**: 에디터와 미리보기의 배경색, 폰트, 헤더 스타일을 완벽하게 일치시켜 위화감 제거.
- **툴바 재배치**: 저장 상태(Saved)와 날짜 표시를 우측 상단으로 이동하여 공간 효율 최적화.

---

# v0.0.5 Release Notes

## Summary
- 사이드바 UX 대폭 개선 (고정/오버레이 모드, 폴더 접기 등) 및 디자인 리뉴얼 (아이콘, 헤더 스타일)이 적용되었습니다.

## New Features

### 1. 사이드바 UX 개선 (Sidebar Enhancements)
- **고정/오버레이 모드 (Pin & Overlay)**:
  - 사이드바 하단 핀 버튼으로 고정 모드와 오버레이 모드 전환 가능
  - 고정 해제 시 사이드바가 에디터 위로 뜨는 오버레이 형태로 동작 (화면 흔들림 방지)
  - 핀 상태는 로컬 스토리지에 저장됨
- **폴더 접기/펴기 (Folder Collapse)**:
  - 폴더별 접기/펴기 기능 추가 및 상태 저장 (새로고침 후 유지)
  - 폴더 내 문서 개수 표시
- **애니메이션 최적화**:
  - 사이드바 열림/닫힘 애니메이션 속도 향상


# v0.0.3 Release Notes

## Summary
- 모바일 환경에서의 UI 사용성 개선 및 사이드바 상호작용 수정이 진행되었습니다.

## Bug Fixes

### 1. 모바일 UI 상호작용 수정 (Mobile UI Interaction Fixes)
- **드래그 앤 드롭 개선**:
  - 모바일 드래그 앤 드롭 폴리필(polyfill) 적용으로 터치 동작 최적화
  - 사이드바 접힘 상태에서의 상호작용 로직 개선

### 2. UI 개선 (UI Improvements)
- **입력 박스 높이 축소**:
  - 사용자 입력 박스의 크기를 줄여 UI 최적화

# v0.0.2 Release Notes

## Summary
- 노트 공유 기능 개선 및 노트 고정(Pin) 기능이 추가되었습니다.

## New Features

### 1. 노트 공유 기능 (Sharing Improvements)
- **공유 중지/링크 복사 UX 개선**:
  - 공유 중지 시 불필요한 알림창(Alert) 제거
  - 링크 복사 시 팝업 즉시 닫힘 처리
- **UI 개선**:
  - 공유 버튼 아이콘 크기 및 스타일을 Preview 버튼과 통일
  - 공유 페이지의 폰트 크기를 16px로 변경하여 가독성 향상

### 2. 노트 고정 기능 (Pinned Notes)
- **기능**:
  - 중요한 노트를 목록 최상단에 고정하는 기능 추가
  - 폴더 내부에서도 고정된 노트가 최상단에 배치됨
- **UI/UX**:
  - 노트 리스트 좌측에 핀(Push Pin) 아이콘 버튼 추가
  - 원클릭으로 고정/해제 토글 가능
  - 고정된 노트는 채워진 주황색 아이콘으로 표시
 
