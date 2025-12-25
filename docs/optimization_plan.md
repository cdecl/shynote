# SHYNOTE 최적화 및 오프라인 모드 개선 전략

## 1. 현재 상태 분석 (Current Status)

### 1.1 저장소 및 데이터 로딩 (Storage & Instant Load)
- **구현 상태**: ✅ 구현됨
- **작동 방식**:
  - `localStorage`에 User ID를 캐싱 (`shynote_user_id`).
  - 앱 실행 시 네트워크 요청(`auth/me`)을 기다리지 않고, 캐시된 ID로 `indexedDB`를 즉시 조회하여 데이터를 화면에 표시.
  - 이후 백그라운드에서 실제 서버 인증을 수행하고, 필요 시 데이터를 갱신(Refetch).
- **장점**: 초기 로딩 속도(First Contentful Paint)가 매우 빠름.

### 1.2 PWA 및 오프라인 모드 (PWA & Offline)
- **구현 상태**: ⚠️ 부분 구현 (불완전)
- **작동 방식**:
  - `manifest.json`: 앱 설치 버튼(A2HS) 지원.
  - `sw.js` (Service Worker): 수동으로 정의된 `ASSETS_TO_CACHE` 목록을 캐싱 시도.
- **문제점**:
  - **CDN 의존성**: Vue, CodeMirror, Marked 등 핵심 라이브러리를 외부 CDN(`unpkg`, `esm.sh`)에서 불러오고 있음.
  - **캐싱 누락**: `sw.js`에 하드코딩된 URL 외에, `app.js` 내부에서 동적으로 import하는 모듈(CodeMirror의 수많은 하위 모듈 등)은 서비스 워커가 알지 못해 캐싱되지 않음.
  - **오프라인 실행 불가**: 인터넷이 끊기면 `index.html` 껍데기는 뜨지만, 에디터(CodeMirror) 등 핵심 기능이 로드되지 않아 빈 화면이거나 에러 발생.

---

## 2. 발전 전략: Modern PWA Architecture

진정한 오프라인 지원과 성능 최적화를 위해 **Vite 기반의 모던 빌드 시스템**으로 전환이 필요합니다.

### 2.1 Vite 마이그레이션 (Migration to Vite)
- **목표**: CDN 의존성 제거 및 로컬 패키지 번들링.
- **작업 내용**:
  - `package.json`에 `vue`, `codemirror`, `marked` 등을 설치.
  - 소스 코드를 ES Modules 기반으로 리팩토링 (`import ... from 'https://...'` → `import ... from 'vue'`).
  - Vite가 수십/수백 개의 파일을 최적화된 소수의 파일(`chunk`)로 번들링.

### 2.2 PWA 자동화 (`vite-plugin-pwa`)
- **목표**: 유지보수가 필요 없는 완벽한 오프라인 모드.
- **작업 내용**:
  - 빌드 시 생성되는 모든 파일(HTML, JS, CSS, Assets)을 자동으로 감지하여 서비스 워커의 `Precache Manifest`에 등록.
  - 앱 업데이트 시 자동으로 새로운 버전을 감지하고 업데이트 알림 제공.
  - **결과**: 인터넷 연결이 없어도 앱이 100% 정상 작동 (데이터 읽기/쓰기 가능, 추후 온라인 시 동기화).

---

## 3. 실행 로드맵 (Roadmap)

1.  **[1단계] 프로젝트 구조 개편**: 소스 코드(`app.js`) 이동 및 `package.json` 설정.
2.  **[2단계] Vite 환경 설정**: `vite.config.js` 작성 및 로컬 개발 서버 구동 확인.
3.  **[3단계] 코드 리팩토링**: CDN Import 문을 로컬 패키지 Import로 일괄 변경.
4.  **[4단계] PWA 플러그인 적용**: `vite-plugin-pwa` 설정 및 오프라인 테스트.

이 전략을 통해 SHYNOTE는 네이티브 앱에 준하는 사용자 경험을 제공하게 됩니다.
