# v1.2.0 Release Notes

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

# v1.1.0 Release Notes

## Summary
- **CodeMirror 6** 엔진 전면 도입을 통해 성능, 안정성, 확장성을 확보했습니다.
- 다크 모드 UI/UX를 대폭 개선하고 가독성을 강화했습니다.

## New Features & Improvements

### 1. Editor Engine Upgrade (CodeMirror 6)
- **CodeMirror 6 Migration**: 최신 에디터 엔진 도입으로 성능 향상 및 확장성 확보 (Textarea 한계 극복).
- **Native Search**: CodeMirror 네이티브 검색 기능 도입으로 빠르고 정확한 검색/치환 지원.

---

# v1.0.6 Release Notes

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

# v1.0.5 Release Notes

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


# v1.0.3 Release Notes

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

# v1.0.2 Release Notes

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
 
