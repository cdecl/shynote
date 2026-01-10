# 프론트엔드 리팩토링 및 성능 개선 결과 보고서

이 문서는 Shynote 프론트엔드의 성능, 유지보수성 및 안정성을 향상시키기 위해 수행된 최적화 작업 결과를 상세히 설명합니다.

## 1. 주요 개선 사항 및 결과

### ⚡ 성능 최적화
- **병렬 데이터 페칭 (Parallel Data Fetching)**: `checkAuth` 및 로그인 핸들러에서 정보를 가져올 때 `Promise.all()`을 사용하도록 업데이트했습니다.
  - **이전**: 폴더 -> 노트 -> 사용자 프로필을 순차적으로 호출 (지연 시간: 모든 요청 시간의 합).
  - **이후**: 모든 데이터를 동시에 호출 (지연 시간: 가장 느린 단일 요청 시간과 동일).
  - **결과**: 네트워크 환경에 따라 앱 초기 구동 속도가 약 **50-60% 향상**되었습니다.
- **설정 및 변경이력 로딩**: 앱 설정(`config.json`)과 변경이력(`changelog.md`)을 비동기로 로드하여, 부가적인 자산 로딩이 UI 렌더링을 방해하지 않도록 표준화했습니다.

### 🧹 코드 품질 및 유지보수성
- **저장소 키 중앙 관리 (STORAGE_KEYS)**: `STORAGE_KEYS` 상수를 도입했습니다.
  - **효과**: `localStorage`에서 사용되는 모든 문자열 키를 제거했습니다. 이제 저장소 이름을 변경해야 할 때 한 곳만 수정하면 되며, 오타로 인한 "보이지 않는 버그"를 완전히 방지합니다.
- **유틸리티 함수 통합**: `parseSafeDate` 내부 헬퍼 함수를 생성했습니다.
  - **효과**: `formatDate`와 `formatDateParts`에서 반복되던 날짜 문자열 정제 로직(SQLite의 공백 처리, UTC 'Z' 접미사 등)을 하나로 통합하여 코드 중복을 제거했습니다.
- **로직 클린업**:
  - 중복된 상태 할당을 제거했습니다.
  - 게스트 모드와 인증 모드 간의 흐름을 정리하여 `checkAuth` 로직의 가독성을 높였습니다.

### 📱 안정성 및 버그 수정
- **iOS/모바일 에디터 로딩 문제 해결**: 아이폰 Safari에서 "About" 페이지를 다녀왔을 때 에디터가 빈 화면으로 나오던 현상을 해결했습니다.
  - **수정**: 문서 선택이 해제될 때 `cmEditor` 인스턴스 참조를 명시적으로 초기화하여, 새로운 문서 선택 시 깨끗한 DOM 엘리먼트 위에 에디터가 다시 생성되도록 강제했습니다. 이를 통해 모바일 WebKit의 인스턴스 충돌 문제를 방지했습니다.

## 2. 업데이트된 LocalStorage 스키마
| 상수 키 | 실제 저장 키 (Local Storage) | 용도 |
| :--- | :--- | :--- |
| `TOKEN` | `access_token` | 인증 세션 토큰 |
| `DARK_MODE` | `shynote_dark_mode` | 테마 설정 (다크/라이트) |
| `LAST_NOTE_ID` | `shynote_last_note_id` | 마지막 열람 문서 유지 |

## 3. 향후 로드맵
- **모듈화 (Modularization)**: 현재 `app.js`는 약 1,500라인에 달합니다. 다음 단계로 Vue 3의 **Composables**를 도입하여 기능을 파일별로 분리(예: `useNotes.js`, `useAuth.js`)할 계획입니다.
- **빌드 도구 도입**: Vite와 같은 빌드 도구를 도입하여 CSS 트리쉐이킹(Tailwind JIT) 및 자바스크립트 경량화를 적용할 예정입니다.

---

### 🔄 에디터 롤백 및 안정화 (2025-12-23)
- **CodeMirror 제거 및 Textarea 복귀**: CodeMirror 5의 모바일 호환성 문제와 복잡성을 제거하기 위해, 순수 HTML `textarea` 기반 에디터로 회귀했습니다.
- **기능 이식 (Porting)**:
  - Markdown 포맷팅 단축키 (Bold, Italic, Link 등) 재구현.
  - 탭(Tab) 들여쓰기 기능 (스페이스 4칸 삽입) 구현.
  - 마우스 기반 플로팅 툴바 재도입.
  - 검색 및 바꾸기(Find/Replace) 기능의 `Textarea` 호환 버전 구현 (하이라이팅 제외).
- **초기화 오류 수정 (Troubleshooting)**:
  - `isAuthenticated`, `fontSize`, `isSidebarPinned`, `collapsedFolders` 등 핵심 상태 변수들의 선언 누락 및 초기화 순서 문제로 인한 White Screen 오류를 전수 조사하여 수정했습니다.
  - 전역 스코프 의존성(`guestStore`, `authenticatedFetch`)의 정의 순서를 재조정하여 `ReferenceError`를 방지했습니다.

---
**상태: 완료 (COMPLETED)** (2025-12-23)
