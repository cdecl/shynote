# Vitest 단위 테스트 도입 리포트 (Unit Testing with Vitest)

본 문서는 `app.js`의 핵심 로직 검증 및 코드 품질 향상을 위해 도입된 Vitest 테스트 환경과 단위 테스트 작성 결과에 대해 설명합니다.

## 1. 개요 (Overview)
- **도입 목적**: `app.js` 내의 복잡한 유틸리티 기능(테이블 편집, 검색 엔진, ID 생성 등)의 정확성 보장 및 회귀 테스트 기반 마련.
- **도구**: [Vitest](https://vitest.dev/) (Vite 기반의 고성능 테스트 프레임워크), `jsdom` (브라우저 환경 에뮬레이션).

---

## 2. 주요 변경 사항 (Key Changes)

### 테스트 환경 설정 (Configuration)
- **`vite.config.js`**: Vitest 구동을 위한 `test` 블록을 추가했습니다.
  - `globals: true`: `describe`, `it` 등을 전역으로 사용 가능하게 설정.
  - `environment: 'jsdom'`: browser-like API(DOM, crypto 등)가 필요한 테스트를 위해 `jsdom` 활성화.
  - `include`: `tests/` 폴더 내의 `.test.js` 파일을 인식하도록 설정.

### 코드 구조 개선 (Refactor for Testability)
- **`static/app.js`**: 테스트 모듈에서 접근할 수 있도록 주요 유틸리티 함수에 `export` 키워드를 추가했습니다.
  - `uuidv7()`
  - `parseMarkdownTable()`, `generateMarkdownTable()`, `formatMarkdownTable()`
  - `fuzzyScore()`

### UI 컴포넌트 라이프사이클 및 모듈 노출 (`tests/ui.test.js`)
- **`static/app.js`**: `createApp`에 전달되는 설정을 `App` 상수로 추출하고 `export` 하도록 리팩토링했습니다.
  - 이를 통해 테스트 환경에서 `App` 컴포넌트를 직접 마운트하여 `setup()`이 반환하는 내부 상태와 함수에 접근할 수 있습니다.
- **Mocking**: `marked`, `CodeMirror`, `mermaid` 등 외부 라이브러리 의존성을 가상화(Mock)하여 로직 실행 여부만을 독립적으로 검증할 수 있게 했습니다.

---

## 3. 단위 테스트 내역 (Test Suites)

### 3.1. 유틸리티 테스트 (`tests/app.test.js`)
- **UUID v7 생성 (`uuidv7`)**: 형식 및 시간 순서 보장 여부 확인.
- **테이블 편집 (`Table Editor`)**: 파싱 및 포맷팅 정확도 검증.
- **검색 엔진 (`fuzzyScore`)**: 점수 계산 로직 및 버그 수정 확인.

### 3.2. UI 모듈 및 인터랙션 테스트 (`tests/ui.test.js`)
현재 `app.js`는 단일 파일 기반의 거대 컴포넌트로 구성되어 있으며, `setup()` 함수는 UI 제어를 위해 **약 200여 개**의 상태(`ref`, `computed`)와 함수를 반환(expose)합니다. 테스트는 이를 두 가지 방식으로 검증합니다.

- **인터페이스 검증 (Interface Check)**: 
    - `fetchNotes`, `selectNote`, `createNoteInFolder` 등 UI 버튼과 직접 연결된 핵심 함수들이 정상적으로 정의되어 있는지 확인하여, 리팩토링 시 발생할 수 있는 UI 기능 마비를 방지합니다.
- **동작 및 응답 검증 (Functional Check)**:
    - **사이드바 제어**: `setSidebarPanelMode` 호출 시 `isSidebarOpen` 상태가 논리에 맞게 변하는지 실제 실행 결과를 확인합니다.
    - **검색 반응성**: `searchQuery` 변경 시 연관된 `searchResults` 로직이 오류 없이 작동하는지 검증합니다.

### 3.3. 검색 엔진 버그 수정 확인
유틸리티 테스트 과정에서 `fuzzyScore`의 단어 시작 경계(Word Boundary) 보너스가 특정 상황에서 누락되는 로직을 발견하여 수정하였습니다.
- *수정 전*: `includes` 매칭 시 즉시 반환하여 상세 점수(보너스) 계산이 생략됨.
- *수정 후*: 기초 점수를 부여하고 반복문을 통해 상세 보너스를 합산하도록 개선하여 검색 품질을 높였습니다.

---

## 4. 테스트 실행 방법 (How to Run)

터미널에서 다음 명령어를 실행하여 테스트를 수행할 수 있습니다.

```bash
# 전체 테스트 실행
npx vitest run

# 특정 파일 테스트 실행
npx vitest run tests/app.test.js
```

---

## 5. 향후 계획 (Future Work)
- **CI 통합**: GitHub Actions와 연동하여 모든 PR/Push 시 자동으로 테스트가 실행되도록 설정.
- **컴포넌트 테스트**: `@vue/test-utils`를 활용하여 Vue 컴포넌트의 라이프사이클 및 반응형 상태 변화에 대한 테스트 확대.
- **Mocking**: 서버 API 및 IndexedDB 연동 부분에 대한 Mocking 테스트를 추가하여 테스트 커버리지 확장.
