# SHYNOTE

SHYNOTE는 사용자가 온전히 글쓰기에 집중할 수 있도록 설계된, 경량 웹 기반 마크다운 지원 노트 어플리케이션입니다.  
폴더 기반의 무한 계층 구조, 실시간 스플릿 뷰 에디터, 그리고 아름다운 Nord 테마 다크 모드를 지원하여 쾌적한 노트 필기 경험을 제공합니다.

---

## 🔑 주요 기능 요약 (Key Features)

### 1. 몰입형 글쓰기 환경 (Immersive Environment)
- **다양한 뷰 모드**: 에디터 전용, 미리보기 전용, 또는 스플릿(동시) 뷰를 자유롭게 전환하며 작업할 수 있습니다.
- **테마 및 개인화**: 시스템 설정에 따른 자동 다크 모드 감지와 수동 토글을 지원하며, 사용자의 설정은 자동으로 저장됩니다.
- **글자 크기 조절**: 에디터와 미리보기의 글자 크기를 툴바에서 즉시 조절하여 가독성을 높일 수 있습니다.

### 2. 스마트한 마크다운 에디터 (Advanced Editor)
- **플로팅 툴바**: 텍스트를 선택하면 즉시 나타나는 툴바를 통해 굵게, 기울임, 헤더, 링크 등의 서식을 빠르게 적용할 수 있습니다.
- **스마트 단축키 & 포매팅**: 
  - 탭 들여쓰기/내어쓰기, 줄 이동(`Alt+↕`), 줄 복제(`Shift+Alt+↕`) 등을 지원합니다.
  - 마크다운 헤더(H1~H5), 인용구, 리스트 등에 대해 테마별로 최적화된 색상 스타일링이 적용되어 있습니다.
- **코드 하이라이팅**: 코드 블럭 작성 시 Nord(다크) 또는 GitHub(라이트) 테마가 적용된 구문 강조 기능을 제공합니다.

### 3. 직관적인 파일 관리 (File Management)
- **폴더 계층 구조**: 폴더 안에 폴더를 생성하는 무한 계층 구조를 통해 노트를 체계적으로 정리할 수 있습니다.
- **드래그 앤 드롭 (Drag & Drop)**: 노트를 마우스로 끌어 원하는 폴더로 이동하거나, 폴더 밖(루트)으로 꺼낼 수 있는 직관적인 정리를 지원합니다.

### 4. 인증 및 보안 (Authentication & Security)
- **Google 로그인**: Google OAuth 2.0을 지원하여 별도의 가입 절차 없이 기존 계정으로 안전하고 빠르게 로그인할 수 있습니다.
- **게스트 모드 (Guest Mode)**: 
  - `?mode=guest` URL 파라미터를 사용하여 로그인 없이 앱의 모든 기능을 즉시 체험할 수 있습니다.
  - 가상의 인메모리 백엔드를 통해 노트 생성, 수정, 삭제 등의 CRUD 작업이 가능합니다

### 5. 기술 스택 (Tech Stack)
- **Frontend**: Vue.js 3 (ES Modules), TailwindCSS
- **Backend**: FastAPI, SQLite (Dev) / PostgreSQL (Prod), SQLAlchemy
- **Etc**: Google OAuth 2.0 Auth, Marked.js

---

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
