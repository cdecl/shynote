# SHYNOTE 프로젝트 문서

## 1. 프로젝트 개요
**SHYNOTE**는 Obsidian과 유사한 사용자 경험을 제공하는 Markdown 및 텍스트 기반의 노트 필기 애플리케이션입니다. 폴더 기반의 탐색 시스템과 Split View(에디터/미리보기) 기능을 특징으로 합니다.

## 2. 기술 스택 (Technology Stack)

### Server Side
- **Framework**: FastAPI (Python)
- **Database**: 
  - 개발(Dev): SQLite (`SHYNOTE.db`)
  - 배포(Prod): PostgreSQL (예정)
- **ORM**: SQLAlchemy
- **Execution**: Uvicorn

### Client Side
- **Core**: Vanilla JS (ES Modules) + Vue.js 3 (CDN/ESM)
- **Styling**: TailwindCSS
- **Markdown Rendering**: marked.js

### Project Management
- **Package Manager**: `uv`
- **Version Control**: `git`

## 3. 프로젝트 구조 (Project Structure)
- **`src/`**: 백엔드 소스 코드 (`main.py`, `models.py`, `schemas.py`, `database.py`)
- **`static/`**: 프론트엔드 리소스 (`index.html`, `app.js`)
- **`docs/`**: 프로젝트 산출물 및 문서 (`walkthrough.md`, `implementation_plan.md`)
  - `implementation_plan` 문서는 지속적으로 업데이트 진행  
- **`tests/`**: 테스트 코드 디렉토리

## 4. 주요 기능 (Key Features)

### 사용자 인터페이스 (User Interface)
- **좌측 패널**: 폴더 계층 구조를 지원하는 노트 리스트
- **우측 패널**: Split View 에디터
    - **Editor**: Markdown 편집을 위한 텍스트 영역
    - **Preview**: 실시간 렌더링된 Markdown 미리보기

### 데이터 관리 (Data Management)
- **노트 (Notes)**: 제목, 내용, 생성/수정 시간 저장
- **폴더 (Folders)**: 노트를 체계적으로 관리하기 위한 단위
- **동기화 (Sync)**: **Local-First 아키텍처** 적용 (IndexedDB + Background Sync)
- **영속성 (Persistence)**: SQLite/PostgreSQL 사용

## 5. 개발 워크플로우 (Development Workflow)
- **서버 실행**: `./run.sh` (Host: 0.0.0.0, Port: 8000)
- **문서 관리**: `docs/` 폴더 내 지속적인 업데이트

## 6. 로드맵 (Roadmap)
- [x] **인증 (Authentication)**: JWT 기반 로그인 구현 (Google OAuth 2.0 완료)
- [x] **Local-First 동기화**: IndexedDB 기반 오프라인 지원 및 백그라운드 동기화 구현 완료
- [ ] **데이터베이스 마이그레이션**: 배포 환경을 위한 PostgreSQL 전환 (Vercel Postgres 연결 안정화)

## 7. TODO & 결정 필요 사항 (Open Issues)
프로젝트 진행을 위해 검토 및 결정이 필요한 사항들입니다.

- [x] **배포 전략 수립**: Vercel Serverless Function & PostgreSQL 사용 결정
- [ ] **상태 관리 라이브러리 도입 여부**: 현재 Vanilla JS 객체(`ref`) 사용 중이나, 복잡도 증가 시 Pinia 등 도입 고려
- [x] **에디터 고도화**: CodeMirror 도입 시도 후 모바일 호환성 및 복잡도 문제로 **Textarea 기반 기능 확장**으로 회귀 결정. (플로팅 툴바, 스마트 인덴트 등 자체 구현)
- [ ] **테스트 프레임워크 선정**: `pytest` 기반의 백엔드 테스트 및 프론트엔드 E2E 테스트 도구(Playwright 등) 구체화
- [ ] **폴더 구조 동기화**: 폴더 열람 시 트리 구조 부분 갱신 로직 구현 예정
