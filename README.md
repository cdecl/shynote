# SHYNOTE

✍️ 오직 글쓰기에만 집중하는 공간, SHYNOTE

SHYNOTE는 복잡한 설정 없이 사용자가 온전히 글쓰기에만 몰입할 수 있도록 설계된 경량 웹 기반 마크다운 노트 어플리케이션입니다.

---

## 🔑 주요 기능 (Key Features)

상세한 기능 목록과 기술 명세는 **[상세 기능 명세서 (features.md)](docs/features.md)**에서 확인하실 수 있습니다.

### 1. 강력한 편집 경험 (Advanced Editor)
- **CodeMirror 6 엔진**: 최신 에디터 엔진을 탑재하여 대용량 문서에서도 고성능을 보장합니다.
- **VS Code 스타일 편집**: 다중 커서, 줄 이동(`Alt+↑/↓`), 박스 선택(`Shift+Alt+드래그`) 등 전문 개발 도구급 편집 기능을 지원합니다.
- **슬래시 커맨드 (/) & 자동 완성**: `/table`, `/datetime` 등 단축 명령어로 반복 작업을 자동화합니다.
- **Ultra-thin Table Editor**: 마크다운 표를 팝업 창에서 엑셀처럼 직관적으로 편집할 수 있습니다.

### 2. 데이터 안정성 및 동기화 (Local-first)
- **로컬 우선 아키텍처**: 모든 작업은 IndexedDB에 즉시 저장되어 오프라인에서도 완벽하게 작동합니다.
- **지능형 백그라운드 동기화**: `WAL(Write-Ahead Logging)` 방식을 사용하여 변경 사항만 효율적으로 서버와 동기화합니다.
- **충돌 방지 및 보안**: 낙관적 잠금(Optimistic Locking)과 컨텐츠 해시 검증을 통해 데이터 정합성을 보장합니다.

### 3. 지능형 탐색 및 관리 (Intelligent UI)
- **통합 커맨드 팔레트 (`Cmd+P`)**: Fuzzy Matching 기반 검색과 사용 이력 정렬을 통해 원하는 노트를 즉시 찾을 수 있습니다.
- **백링크(Backlinks) 연동**: 현재 노트를 참조하고 있는 다른 노트들을 자동으로 찾아 하단에 표시합니다. (`[[노트 제목]]` 방식 지원)
- **최근 작업 노트(Recent Notes)**: 사이드바에 최근에 접근한 5개의 노트를 표시하여 빠른 전환을 지원합니다.
- **고밀도 레이아웃**: 카드 형태의 `Grid View`와 문서 중심의 `List View`를 지원하며, 모바일 최적화(2열 그리드)를 제공합니다.
- **계층형 폴더 시스템**: 드래그 앤 드롭을 통한 폴더 이동, 중요 노트 고정(Pin), 휴지통 기능을 지원합니다.

### 4. 보안 및 배포 (Security & Deployment)
- **Google OAuth 2.0 및 PWA**: 안전한 소셜 로그인과 서비스 워커를 통한 설치형 앱 경험을 제공합니다.
- **Docker 기반 셀프 호스팅**: 자체 서버 구축을 위한 Docker 이미지 빌드 및 실행 스크립트를 완벽하게 지원합니다.

---

## 🛠 SHYNOTE의 기술적 기반 (Tech Stack)

사용자의 몰입을 뒷받침하는 기술 스택은 다음과 같습니다.
- **Frontend**: Vue.js 3, TailwindCSS, CodeMirror 6
- **Backend**: FastAPI, PostgreSQL (SQLAlchemy 기반)
- **Storage**: IndexedDB (로컬), PostgreSQL (서버)
- **Feature**: PWA (Installable Web App)

## 🌟 앞으로의 진화 (Future Vision)

소스 코드의 강력한 로컬 저장 기술을 바탕으로, 향후 전역 검색 강화, 다양한 형식(PDF, HTML) 내보내기, 버전 히스토리(스냅샷) 복구 등을 통해 더욱 완성도 높은 경험을 제공할 예정입니다.

---

SHYNOTE를 비유하자면, **"작성하는 순간 모든 것을 기록하고 정리하는 스마트한 디지털 비서"**와 같습니다. 사용자는 그저 글을 쓰기만 하면 됩니다. 나머지는 SHYNOTE가 뒤에서 묵묵히, 그리고 완벽하게 처리할 것입니다.

---

## 🚀 설치 및 실행 (Installation)

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/cdecl/shynote.git
   cd shynote
   ```

2. **의존성 설치** (`uv` 사용 권장)
   ```bash
   uv sync  # 또는 pip install -r requirements.txt
   ```

3. **서버 실행**
   ```bash
   ./run.sh start
   # http://localhost:8000 접속
   ```

