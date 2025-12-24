## 📝 마크다운 편집기 동기화 시스템 설계서 (Local-first)

본 설계는 **IndexedDB**를 활용한 로컬 우선(Local-first) 아키텍처와 **PostgreSQL** 원격 저장소 간의 효율적인 동기화를 목표로 합니다.

## 1. 데이터 저장소 전략 (Storage Architecture)

| 저장소 | 기술 | 역할 |
| :--- | :--- | :--- |
| **원격 DB** | **SQLite (Dev)** / **PostgreSQL (Prod)** | **최종 데이터 원천 (SSOT)**, 기기 간 동기화, 사용자 데이터 영구 보관 |
| **로컬 DB** | **IndexedDB** | **작업 볼트 (Vault)**, 오프라인 편집 지원, 변경 이력(Bin-log) 임시 저장 |
| **설정 저장** | **LocalStorage** | **클라이언트 상태 및 사용자 설정** (테마, 마지막 작업 상태 등) |

### 📂 저장 항목 상세 (Storage Details)

#### A. 원격 데이터베이스 (Remote DB)
- **환경별 분리**:
  - **Development**: 파일 기반의 `SQLite`를 사용하여 가볍고 빠른 개발 환경 구성.
  - **Production**: 동시성 제어와 안정성을 위해 `PostgreSQL` (Vercel Postgres) 사용.
- **주요 테이블**: `users`, `folders`, `notes`, `audit_logs`

#### B. 로컬 설정 (LocalStorage Keys)
브라우저에 저장되는 휘발성 설정값 및 상태 정보입니다.

| Key | 설명 | 예시 값 |
| :--- | :--- | :--- |
| `access_token` | JWT 인증 토큰 | `eyJhbGciOi...` |
| `shynote_dark_mode` | 다크 모드 활성화 여부 | `true` / `false` |
| `shynote_sidebar_pinned` | 사이드바 고정 상태 | `true` (Fixed) / `false` (Overlay) |
| `shynote_collapsed_folders` | 폴더별 접힘 상태 (JSON) | `{"1": true, "3": false}` |
| `shynote_last_note_id` | 마지막으로 열었던 노트 ID | `42` |
| `shynote_font_size` | 에디터 폰트 크기 | `16` (px) |
| `shynote_word_wrap` | 자동 줄바꿈 사용 여부 | `true` |
| `shynote_split_ratio` | 화면 분할 비율 | `50` (%) |
| `shynote_sort_field` | 정렬 기준 필드 | `updated_at` |
| `shynote_sort_direction` | 정렬 방향 | `desc` |


---

## 2. 저장 프로세스: Bin-log & 체크포인트

사용자의 입력 지연을 0으로 만들기 위해 **Write-Ahead Logging(WAL)** 방식을 채용합니다.

### 🔄 상세 단계
1. **Local Write (즉시):** 사용자가 편집 시 IndexedDB의 두 테이블에 동시 기록
   - `Current_State`: 현재 문서 스냅샷 (UI 렌더링용)
   - `Pending_Logs`: 서버로 전송할 변경 이력 (Bin-log)
2. **Checkpoint (트리거):** 백그라운드 워커가 `Pending_Logs`에 쌓인 항목을 감시.
3. **Background Sync (비동기):** `await`을 사용하여 로그를 서버(PostgreSQL)에 전송.
4. **Commit (확정):** 서버 응답 성공 시 로컬 로그 삭제 또는 `synced` 상태로 변경.

---

## 3. 로딩 및 데이터 동기화 전략 (Last Write Wins)

현재 구현은 빠른 반응성을 위해 **Dirty Flag** 기반의 "최종 수정 우선(Last Write Wins)" 전략을 사용합니다.
(Hash 기반 검증은 추후 고도화 예정)

### ⚡ 로딩 및 병합 프로세스 (Loading & Merging)

1. **Instant Load (즉시 로딩)**
   - 앱 실행 시 `LocalDB.getAllNotes()`를 호출하여 IndexedDB의 데이터를 즉시 메모리(`notes.value`)로 로드.
   - 사용자는 네트워크 대기 없이 즉시 문서를 확인 가능.

2. **Server Fetch & Merge (서버 데이터 수신 및 병합)**
   - 백그라운드에서 `/api/notes`를 호출하여 서버의 최신 데이터를 가져옴.
   - **병합 로직 (`LocalDB.saveNotesBulk`)**:
     - 서버에서 받은 각 노트에 대해 로컬 DB의 상태를 확인.
     - **Case A: 로컬 노트가 `Dirty` 상태인 경우** (전송 대기 중인 수정사항 존재)
       - 서버 데이터를 **무시(Skip)**합니다. 로컬의 수정 내역이 우선시됩니다.
       - 이후 `SyncWorker`가 로컬 내용을 서버로 강제 Push합니다.
     - **Case B: 로컬 노트가 `Synced` 상태인 경우**
       - 서버 데이터로 로컬 IndexedDB를 **덮어쓰기(Overwrite)**합니다.
       - 동기화 완료 상태(`sync_status: 'synced'`)를 유지합니다.

3. **UI Refresh (화면 갱신)**
   - 병합이 완료되면 `LocalDB`에서 다시 데이터를 조회하여 UI(`notes.value`)를 최신 상태로 갱신.

### 🔄 충돌 해결 정책 (Conflict Resolution)
- **전략**: **Client-side Priority for Dirty Notes** (수정 중인 로컬 데이터 절대 우선)
- **이유**: 사용자가 방금 작성한 내용이 서버의 내용보다 최신일 확률이 높으며, 작성 중인 내용이 덮어씌워지는 경험("Ghost Typing")을 방지하기 위함.


> **Note:** 이 설계는 네트워크 연결이 불안정한 환경에서도 사용자의 편집 흐름을 끊지 않으며, 서버 리소스를 최소한으로 사용하여 동기화 정합성을 유지합니다.

---

## 4. IndexedDB 데이터 구조 (Schema)

로컬 저장소(`SHYNOTE_VAULT`)에는 다음과 같은 객체 저장소(Object Stores)가 포함됩니다.

### 📝 Notes Store (`notes`)
문서의 본문과 메타데이터를 저장합니다.
- **Key**: `id` (Note ID)
- **Indexes**: `folder_id`, `updated_at`, `sync_status`
- **Fields**:
  - `id`: 문서 고유 ID
  - `title`: 문서 제목
  - `content`: **문서 전체 본문** (Markdown)
  - `folder_id`: 소속 폴더 ID (Relation)
  - `sync_status`: 동기화 상태 (`dirty` | `synced`)
  - `local_updated_at`: 로컬 수정 시각

### 📂 Folders Store (`folders`)
폴더 계층 구조를 캐싱하여 오프라인상에서도 트리 구조를 유지합니다.
- **Key**: `id` (Folder ID)
- **Fields**:
  - `id`: 폴더 고유 ID
  - `name`: 폴더명
  - `user_id`: 소유자 ID

> **Note**: 초기 설계와 달리, 오프라인 환경에서의 완벽한 UX를 위해 **문서 내용뿐만 아니라 폴더 구조 정보까지 로컬에 모두 저장**합니다.
