# SHYNOTE 프로젝트 지침 및 가이드 (Project Guidelines)

본 문서는 **최우선적으로 준수해야 할 프로젝트 규칙과 가이드라인**을 정의합니다. 작업 시작 전 반드시 확인하십시오.

## 1. 핵심 지침 (Core Directives)
모든 작업 수행 시 다음 규칙을 **엄격히 준수**해야 합니다.

### 문서화 (Documentation)
1.  **언어**: 모든 문서는 **한글**로 작성합니다.
2.  **최신화**: `docs/` 폴더 내의 산출물(`implementation_plan.md`, `walkthrough.md` 등)은 코드 변경 시 **반드시 즉시 업데이트**합니다.
3.  **위치**: 프로젝트 관련 문서는 `docs/` 폴더에서 관리합니다.

### 릴리즈 및 버전, 패치 관리 (Release Process)
버전을 변경할 때는 다음 3개의 파일이 **항상 동기화**되어야 합니다.
1.  **`static/version.json`**: 앱 내 표시용 버전.
2.  **`pyproject.toml`**, **`uv.lock`**: 패키지 관리용 버전.
3.  **`static/changelog.md`**: 변경 이력 기록 (최상단에 최신 버전 추가).
4.  **`static/sw.js`**: Service Worker 버전.


---

## 2. 기술 스택 및 제약 사항 (Tech Stack & Constraints)

### Client Side
- **Core**: Vanilla JS (ES Modules) + Vue.js 3 (CDN/ESM)
  - **Rule**: 불필요한 번들링 도구 사용을 지양하고, 브라우저 Native ES Modules를 적극 활용합니다.
- **Styling**: TailwindCSS
- **Editor**: **CodeMirror 6** (v0.3.5~)
  - `textarea` 한계 극복을 위해 도입 완료.
  - 관련 패키지는 `esm.sh`를 통해 Import합니다.

### Server Side
- **Framework**: FastAPI (Python)
- **Database**:
  - Dev: SQLite (`SHYNOTE.db`)
  - Prod: PostgreSQL 
- **Persistence**: SQLAlchemy

### Project Management
- **Package Manager**: `uv`
- **Version Control**: `git`

---

## 3. 프로젝트 구조 (Project Structure)
- **`api/`**: 백엔드 (`index.py`, `models.py`, `schemas.py`, `database.py`)
- **`static/`**: 프론트엔드
  - **Core**: `index.html` (Entry), `app.js` (Vue Logic), `local_db.js` (IndexedDB)
  - **Assets**: `style.css`, `sw.js` (Service Worker)
  - **Meta**: `changelog.md`, `version.json`
- **`docs/`**: 프로젝트 문서 (지속적 업데이트 대상)

---

## 4. 로드맵 및 상태 (Roadmap & Status)

### 완료된 주요 기능 (Completed)
- [x] **인증 (Auth)**: JWT, Google OAuth 2.0
- [x] **동기화 (Sync)**: Local-First (IndexedDB + Background Sync)
- [x] **에디터 (Editor)**: CodeMirror 6 기반 (VS Code Keymap, Search Panel, GitHub Theme)

### 진행 중 / 예정 (In Progress / Planned)
- [x] **DB 마이그레이션**: PostgreSQL 전환 (Vercel)
- [ ] **테스트**: `pytest` 및 E2E 테스트 도입

---

## 5. 주요 기능 명세 (Feature Specs)

### 데이터 관리 (Data Management)
- **Local-First**: Typing -> Saved Locally (1s) -> Synced (5s Loop)
- **Consistency**: 사용자 데이터 보호를 최우선(Last Write Wins, Dirty State Protection).

### 사용자 인터페이스 (Key Features)
- **Split View**: Markdown Editor + Preview.
- **Folder System**: 계층형 폴더 구조.
