# SHYNOTE

SHYNOTE는 사용자가 온전히 글쓰기에 집중할 수 있도록 설계된, 경량 웹 기반 마크다운 지원 노트 어플리케이션입니다.  
폴더 기반의 무한 계층 구조, 실시간 스플릿 뷰 에디터, 그리고 아름다운 Nord 테마 다크 모드를 지원하여 쾌적한 노트 필기 경험을 제공합니다.

---

## 🔑 주요 기능 요약 (Key Features)

### 1. 몰입형 글쓰기 환경 (Immersive Environment)
- **다양한 뷰 모드**: 에디터 전용(E), 미리보기 전용(P), 스플릿 뷰(S)를 자유롭게 전환하며 작업할 수 있습니다.
- **GitHub 스타일 마크다운 렌더링**: Preview 모드에서 GitHub Markdown CSS를 적용하여 전문적인 문서 렌더링을 제공합니다.
- **YAML Frontmatter 지원**: 문서 상단의 YAML 메타데이터(`---`)를 자동 파싱하여 구조화된 테이블로 표시합니다.
- **테마 및 개인화**: 
  - Nord 테마 기반의 아름다운 다크 모드 지원
  - Light/Dark 모드 자동 전환 및 수동 토글
  - 사용자 설정은 localStorage에 자동 저장
- **글자 크기 조절**: 에디터와 미리보기의 글자 크기를 툴바에서 즉시 조절하여 가독성을 높일 수 있습니다.

### 2. 강력한 에디터 엔진 (Powerful Editor)
- **CodeMirror 6 Engine**: 최신 CodeMirror 6 엔진을 전면 도입하여 대용량 문서에서도 끊김 없는 성능과 확장성을 제공합니다.
- **향상된 편집 경험 (Enhanced Experience)**:
  - **Native Search**: 빠르고 안정적인 검색/바꾸기 기능 (정규식 지원)
  - **스마트 기능**: 자동 줄바꿈(Word Wrap), 괄호 자동 닫기, 구문 강조(Syntax Highlighting)
  - **고급 단축키**: 멀티 커서 지원, 줄 이동(`Alt+↑/↓`) 등 IDE급 편집 기능
- **스마트 툴바**: 
  - 선택한 텍스트 위에 자동으로 나타나는 **플로팅 툴바**로 서식을 빠르게 적용
  - **Sticky Toolbar** 모드를 통해 모바일 환경에서도 편하게 접근
- **[👉 에디터 기능 및 단축키 가이드 보기](docs/editor_guide.md)**

### 3. 직관적인 파일 관리 (File Management)
- **폴더 계층 구조**: 폴더 안에 폴더를 생성하는 무한 계층 구조를 통해 노트를 체계적으로 정리할 수 있습니다.
- **드래그 앤 드롭 (Drag & Drop)**: 노트를 마우스로 끌어 원하는 폴더로 이동하거나, 폴더 밖(루트)으로 꺼낼 수 있는 직관적인 정리를 지원합니다.
- **파일 가져오기 (Import)**: 텍스트 파일을 드래그 앤 드롭하여 노트로 가져올 수 있습니다.
  - **정렬 및 고정**: 
  - 제목(A-Z) 또는 날짜(최신/오래된 순)로 정렬
  - 중요한 노트를 목록 최상단에 고정하여 빠른 접근
- **휴지통 (Trash)**: 실수로 삭제한 노트를 보관하고 복구할 수 있는 안전장치 제공 (비우기 시 영구 삭제)

### 4. 모바일 최적화 (Mobile Optimized)
- **스와이프 네비게이션**: 
  - 문서 리스트에서 오른쪽 스와이프 → 사이드바 표시
  - 문서 상세에서 오른쪽 스와이프 → 리스트로 돌아가기
- **확대 방지**: 의도치 않은 확대를 차단하여 안정적인 타이핑 경험 제공
- **반응형 UI**: 모바일과 데스크톱에 최적화된 간결한 인터페이스

### 5. 인증 및 보안 (Authentication & Security)
- **Google 로그인**: Google OAuth 2.0을 지원하여 별도의 가입 절차 없이 기존 계정으로 안전하고 빠르게 로그인할 수 있습니다.
- **게스트 모드 (Guest Mode)**: 
  - `?mode=guest` URL 파라미터를 사용하여 로그인 없이 앱의 모든 기능을 즉시 체험
  - 가상의 인메모리 백엔드를 통해 노트 생성, 수정, 삭제 등의 CRUD 작업 가능

### 6. 공유 및 협업 (Sharing & Collaboration)
- **노트 공유 (Public Sharing)**: 
  - 노트별로 고유한 링크를 생성하여 외부에 읽기 전용으로 공유
  - 공유 관리 팝업을 통해 링크 복사 및 공유 중지를 간편하게 관리

### 7. 로컬 우선 및 오프라인 지원 (Local-first & Offline)
- **IndexedDB 기반 저장소 (Local-first)**: 
  - 작성 중인 모든 내용은 **1초마다 로컬 DB(IndexedDB)에 자동 저장**
  - 네트워크가 끊겨도 **데이터 유실 없이 작업** 가능
  - 앱 재실행 시 **즉시 로딩(Instant Load)**으로 쾌적한 경험
- **백그라운드 동기화 (Sync)**:
  - 네트워크 연결이 복구되면 백그라운드 워커가 자동으로 변경 사항을 서버와 동기화
  - "Last Write Wins" 전략을 통해 사용자의 최신 수정 내역을 안전하게 보호
- **충돌 해결 (Conflict Resolution)**: 
  - 서로 다른 기기에서 수정 시 충돌 발생 시 Diff & Merge UI 제공
  - CodeMirror MergeView를 통해 변경 사항을 비교하고 선택적으로 병합

## 🛠 기술 스택 (Tech Stack)
- **Frontend**: Vue.js 3 (ES Modules), TailwindCSS, CodeMirror 6
- **Backend**: FastAPI, SQLite (Dev) / PostgreSQL (Prod), SQLAlchemy
- **Storage**: IndexedDB (Local-first), Service Worker (PWA)
- **Auth**: Google OAuth 2.0
- **Markdown**: Marked.js, js-yaml, GitHub Markdown CSS



## 🚀 설치 및 실행 (Installation)

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/yourusername/shynote.git
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
