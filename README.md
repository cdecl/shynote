# SHYNOTE

✍️ 오직 글쓰기에만 집중하는 공간, SHYNOTE

SHYNOTE는 복잡한 설정 없이 사용자가 온전히 글쓰기에만 몰입할 수 있도록 설계된 경량 웹 기반 마크다운 노트 어플리케이션입니다.

---

## 🔑 주요 기능 (Key Features)

상세한 기능 목록과 기술 명세는 **[상세 기능 명세서 (features.md)](docs/features.md)**에서 확인하실 수 있습니다.

### 1. 강력한 편집 경험 (Advanced Editor)
- **CodeMirror 6 엔진**: 최신 에디터 엔진을 탑재하여 대용량 문서에서도 고성능을 보장합니다.
- **VS Code 스타일 편집**: 다중 커서, 줄 이동(`Alt+↑/↓`), 박스 선택(`Shift+Alt+드래그`) 등 전문 개발 도구급 편집 기능을 지원합니다.
- **상세 가이드**: 전체 단축키 및 마우스 활용법은 **[단축키 및 마우스 가이드](docs/keyboard_mouse_guide.md)**를 참고하세요.
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

## 🔧 환경 변수 설정 (Environment Variables)

배포 전, 프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 필요한 환경 변수를 설정해야 합니다. `.env.template` 파일을 복사하여 사용할 수 있습니다.

| 환경 변수 | 설명 | 기본값 | 비고 |
| :--- | :--- | :--- | :--- |
| `POSTGRES_URL` | PostgreSQL 데이터베이스 연결 URL | `sqlite:///./SHYNOTE.db` | 미설정 시 로컬 SQLite 사용. `postgres://` 자동 변환 및 URL 최적화 지원 |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 클라이언트 ID | - | 미설정 시 Google 로그인 기능 비활성화 |
| `SUPABASE_URL` | Supabase 프로젝트 API URL | - | 이미지 업로드 기능을 위한 Supabase 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 역할(Service Role) 키 | - | 이미지 업로드 권한 확인을 위한 비밀키 |
| `SUPABASE_BUCKET` | Supabase 스토리지 버킷 이름 | `images` | 이미지가 저장될 버킷 명칭 |

> **참고 (Notes):**
> - **데이터베이스:** `POSTGRES_URL`이 설정되지 않으면 로컬 파일 시스템의 `SHYNOTE.db`를 사용합니다. 연결에 실패할 경우 메모리 기반 DB로 자동 전환됩니다.
> - **이미지 업로드:** Supabase 관련 변수(`URL`, `KEY`)가 모두 설정되어야 이미지 업로드 기능이 활성화됩니다.
> - **인증:** Google OAuth 기능을 사용하려면 유효한 `GOOGLE_CLIENT_ID`가 필요합니다.

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

---

## 🐳 Docker 배포 (Docker Deployment)

SHYNOTE를 Docker를 사용하여 쉽고 빠르게 배포할 수 있습니다.

### 1. Docker 이미지 빌드 (Build Docker Image)
제공된 셸 스크립트나 Docker 명령어를 사용하여 이미지를 빌드합니다.

**스크립트 사용:**
```bash
chmod +x docker-build.sh
./docker-build.sh
```

**직접 빌드:**
```bash
docker build -t shynote:latest .
```

### 2. Docker 컨테이너 실행 (Run Docker Container)

**스크립트 사용:**
```bash
chmod +x docker-run.sh
./docker-run.sh
```

**직접 실행:**
```bash
docker run -dp 8000:8000 \
  --rm \
  -v $(pwd)/SHYNOTE.db:/app/SHYNOTE.db \
  --name shynote \
  --env-file .env \
  shynote:latest
```
> **참고:** 데이터 영속성을 위해 `SHYNOTE.db` 파일을 볼륨 마운트합니다. 스크립트 사용 시 `-dp` 옵션을 확인하세요.

### 3. Docker Compose 사용 (Using Docker Compose)
여러 설정을 한 번에 관리하려면 Docker Compose를 사용하는 것이 권장됩니다. `docker-compose.yaml`은 자동으로 `.env` 파일을 로드하고 `SHYNOTE.db`를 마운트합니다.

```bash
# 컨테이너 실행
docker-compose up -d

# 컨테이너 중지 및 제거
docker-compose down
```

### 4. 셸 스크립트 사용 (Shell Scripts)
프로젝트 관리를 위해 다음과 같은 셸 스크립트를 제공합니다.

| 스크립트 | 용도 | 주요 설명 |
| :--- | :--- | :--- |
| `run.sh` | 로컬 개발 환경 관리 | `start`, `stop`, `restart` 커맨드로 서버를 백그라운드에서 제어합니다. |
| `docker-build.sh` | Docker 이미지 빌드 | `shynote:latest` 태그로 Docker 이미지를 생성합니다. |
| `docker-run.sh` | Docker 컨테이너 실행 | 빌드된 이미지를 포트 8000에서 실행하며 로컬 DB를 연동합니다. |

### 5. 배포 방법 비교 (Deployment Methods Comparison)

| 비교 항목 | 로컬 실행 (Local) | Docker 배포 (Docker) |
| :--- | :--- | :--- |
| **권장 용도** | 개발 및 코드 수정 | 운영 서버 구축 및 셀프 호스팅 |
| **필수 도구** | Python 3.12, uv | Docker, Docker Compose |
| **데이터 저장** | 로컬 파일 (`SHYNOTE.db`) | 볼륨 마운트 (`/app/SHYNOTE.db`) |
| **격리 수준** | 낮음 (OS 환경 영향 받음) | 높음 (컨테이너 기반 독립 환경) |
