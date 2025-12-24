# SHYNOTE

SHYNOTE는 사용자가 온전히 글쓰기에 집중할 수 있도록 설계된, 경량 웹 기반 마크다운 지원 노트 어플리케이션입니다.  
폴더 기반의 무한 계층 구조, 실시간 스플릿 뷰 에디터, 그리고 아름다운 Nord 테마 다크 모드를 지원하여 쾌적한 노트 필기 경험을 제공합니다.

---

## 🔑 주요 기능 요약 (Key Features)

### 1. 몰입형 글쓰기 환경 (Immersive Environment)
- **다양한 뷰 모드**: 에디터 전용, 미리보기 전용, 또는 스플릿(동시) 뷰를 자유롭게 전환하며 작업할 수 있습니다.
- **테마 및 개인화**: 시스템 설정에 따른 자동 다크 모드 감지와 수동 토글을 지원하며, 사용자의 설정은 자동으로 저장됩니다.
- **글자 크기 조절**: 에디터와 미리보기의 글자 크기를 툴바에서 즉시 조절하여 가독성을 높일 수 있습니다.

### 2. 강력한 에디터 엔진 (Powerful Editor)
- **CodeMirror 6 Engine**: 최신 CodeMirror 6 엔진을 전면 도입하여 대용량 문서에서도 끊김 없는 성능과 확장성을 제공합니다.
- **향상된 편집 경험 (Enhanced Experience)**:
  - **Native Search**: 빠르고 안정적인 검색/바꾸기 기능 (정규식 지원).
  - **스마트 기능**: 자동 줄바꿈(Word Wrap), 괄호 자동 닫기, 구문 강조(Syntax Highlighting).
  - **고급 단축키**: 멀티 커서 지원, 줄 이동(`Alt+↑/↓`) 등 IDE급 편집 기능.
- **스마트 툴바**: 
  - 선택한 텍스트 위에 자동으로 나타나는 **플로팅 툴바**로 서식을 빠르게 적용할 수 있습니다.
  - **Sticky Toolbar** 모드를 통해 모바일 환경에서도 편하게 접근할 수 있습니다.
- **[👉 에디터 기능 및 단축키 가이드 보기](docs/editor_guide.md)**

### 3. 직관적인 파일 관리 (File Management)
- **폴더 계층 구조**: 폴더 안에 폴더를 생성하는 무한 계층 구조를 통해 노트를 체계적으로 정리할 수 있습니다.
- **드래그 앤 드롭 (Drag & Drop)**: 노트를 마우스로 끌어 원하는 폴더로 이동하거나, 폴더 밖(루트)으로 꺼낼 수 있는 직관적인 정리를 지원합니다.

### 4. 인증 및 보안 (Authentication & Security)
- **Google 로그인**: Google OAuth 2.0을 지원하여 별도의 가입 절차 없이 기존 계정으로 안전하고 빠르게 로그인할 수 있습니다.
- **게스트 모드 (Guest Mode)**: 
  - `?mode=guest` URL 파라미터를 사용하여 로그인 없이 앱의 모든 기능을 즉시 체험할 수 있습니다.
  - 가상의 인메모리 백엔드를 통해 노트 생성, 수정, 삭제 등의 CRUD 작업이 가능합니다


### 5. 공유 및 고정 (Sharing & Pinning)
- **노트 공유 (Public Sharing)**: 
  - 노트별로 고유한 링크를 생성하여 외부에 읽기 전용으로 공유할 수 있습니다.
  - 공유 관리 팝업을 통해 링크 복사 및 공유 중지를 간편하게 할 수 있습니다.
- **노트 고정 (Pinning)**: 
  - 중요한 노트를 목록 최상단에 고정하여 빠르게 접근할 수 있습니다.
  - 좌측의 핀 아이콘을 통해 원클릭으로 고정/해제가 가능합니다.



## 🛠 기술 스택 (Tech Stack)
- **Frontend**: Vue.js 3 (ES Modules), TailwindCSS
- **Backend**: FastAPI, SQLite (Dev) / PostgreSQL (Prod), SQLAlchemy
- **Etc**: Google OAuth 2.0 Auth, Marked.js



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
