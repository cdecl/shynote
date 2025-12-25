# v1.2.3 Release Notes

## Summary
- **Local-First Sync Architecture** 도입으로 오프라인 작업과 데이터 동기화 안정성을 대폭 강화했습니다. (v1.2.0의 고도화 작업 완료)
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

# v1.2.2 Release Notes

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

# v1.2.1 Release Notes

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
 
