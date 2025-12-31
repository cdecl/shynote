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
| `shynote_view_mode` | 에디터 보기 모드 | `edit`, `preview`, `split` |
| `shynote_list_view_mode` | 목록 보기 모드 (그리드/리스트) | `grid`, `list` |


---

## 2. 저장 프로세스: Bin-log & 체크포인트 (Local-First Sync)

사용자의 모든 변경사항은 즉시 로컬에 반영되고, 비동기로 서버에 동기화되는 **WAL (Write-Ahead Logging)** 방식을 따릅니다.

### 🔄 상세 단계 (Detailed Workflow)

1.  **Local Mutation (즉시)**: 사용자가 편집, 생성, 삭제, 이동 시 `LocalDB`에 즉시 반영.
    -   `Current_State`: 현재 문서 스냅샷 (UI 렌더링용)
    -   `Pending_Logs`: 서버로 전송할 변경 작업 목록 (Queue)
        -   Schema: `{ id, entity, entity_id, action, payload, timestamp }`
        -   Action: `CREATE`, `UPDATE`, `DELETE`

2.  **Background Sync Worker (5초 주기)**:
    -   `setInterval`로 `pending_logs`를 주기적으로 확인.
    -   **Log Deduplication & Optimization**:
        -   동일 Entity에 대한 여러 변경사항 압축 (Latest Write Wins).
        -   **Merge Logic**: `CREATE` 후 `UPDATE` 발생 시 -> 단일 `CREATE` (Merged Payload)로 변환.
    -   **Dependency Ordering (중요)**:
        -   **Folders First**: 폴더 생성/수정을 노트 작업보다 먼저 실행하여 `Invalid Folder ID` (400) 오류 방지.
        -   Order: `Folder (Create/Update)` → `Note (All Actions)` → `Folder (Delete)`

3.  **Server Execution & Auto Recovery (자가 치유)**:
    -   서버 API 호출 (`PUT`, `POST`, `DELETE`).
    -   **Self-Healing Logic**:
        -   `PUT` (Update) 요청이 `404 Not Found` 실패 시 -> 자동으로 `POST` (Create/Upsert)로 전환하여 유실된 데이터 복구.
    -   성공 시 로컬 `pending_logs` 삭제.

---


### 🚦 에디터 상태 전이 로직 (Editor State Transitions)

**UI 상의 저장 상태 변화 흐름:** `Typing...` → `Saved locally` → `Synced`

1.  **Typing (입력 중)**
    *   **Trigger**: 사용자가 키보드로 입력하면 `debouncedUpdate()`가 즉시 호출됩니다.
    *   **Action**: `statusMessage.value`를 `'Typing...'`으로 설정합니다.
    *   **Debounce**: 1초(1000ms) 타이머를 시작/재설정합니다 (`setTimeout`).

2.  **Saved locally (로컬 저장)**
    *   **Trigger**: 사용자가 입력을 멈추고 1초가 지나면 타이머가 발동합니다.
    *   **Action**: `LocalDB.saveNote(rawNote)`를 호출하여 **IndexedDB**에 저장합니다.
    *   **Status Update**: 저장이 성공하면 `statusMessage.value`를 `'Saved locally'`로 변경합니다. (이때 서버로 즉시 보내지 않습니다.)

3.  **Synced (서버 동기화)**
    *   **Trigger**: 별도로 돌고 있는 `setInterval(syncWorker, 5000)` 루프가 5초마다 실행됩니다.
    *   **Action**: `syncWorker`가 `pending_logs`(대기 중인 변경사항)를 발견하고 서버로 `PUT` 요청을 보냅니다.
    *   **Status Update**: 서버 응답이 성공(200 OK)하면 `LocalDB.removeLog`를 실행하고, 만약 현재 상태 메시지가 `'Saved locally'`라면 `'Synced'`로 변경합니다.

**요약 흐름도:**
`User Input (Typing...)` --> **1초 대기** --> `IndexedDB Save (Saved locally)` --> **최대 5초 대기** --> `Network Sync (Synced)`

---

## 3. 로딩 및 데이터 동기화 전략 (Pull Sync & Hash Verification)

현재 시스템은 빠른 반응성을 위해 **Dirty Flag** 기반의 "최종 수정 우선(Last Write Wins)" 전략을 채택하고 있으며, 데이터 정합성을 위해 **Hash 기반 검증** 및 **삭제 동기화(Full Sync Logics)**를 포함합니다.

### ⚡ 로딩 및 병합 프로세스 (Loading & Merging)

1. **Instant Load (즉시 로딩)**
   - 앱 실행 시 `LocalDB.getAllNotes()`를 호출하여 IndexedDB의 데이터를 즉시 메모리(`notes.value`)로 로드.
   - 사용자는 네트워크 대기 없이 즉시 문서를 확인 가능.

2. **Server Fetch & Full Sync (서버 데이터 수신 및 완전 동기화)**
   - 백그라운드에서 `/api/notes`를 호출하여 서버의 최신 데이터를 가져옴.
   - **병합 로직 (`LocalDB.saveNotesBulk`)**:
     - 서버에서 받은 노트(`serverNotes`)와 로컬 DB(`localNotes`)를 비교.

     - **Step A: 생성 및 수정 반영 (Upsert via Hash)**
       - 각 서버 노트에 대해 해시(Content Hash)를 비교하거나 최신성 검증.
       - **로컬이 `Dirty` 상태인 경우**: 서버 데이터를 **무시(Skip)**하고 추후 로컬 내용을 Push.
       - **로컬이 `Synced` 상태인 경우**: 서버의 `updated_at`이 더 최신인 경우 로컬 DB 업데이트.

     - **Step B: 삭제 동기화 (Server Deletion Check)**
       - **원리**: 서버 목록에 없는 데이터가 로컬에 존재한다면, 타 기기에서 삭제된 것으로 간주.
       - **예외(Exception)**: 단, 로컬에서 새로 생성되어 아직 서버로 전송되지 않은(`Synced`가 아닌 `Dirty` 상태) 노트는 **삭제 대상에서 제외**.
       - **Action**: 서버 목록에 없고 && 로컬 상태가 `Synced`인 노트는 로컬 DB에서 영구 삭제.

3. **UI Refresh (화면 갱신)**
   - 병합이 완료되면 `LocalDB`에서 다시 데이터를 조회하여 UI(`notes.value`)를 최신 상태로 갱신.

4. **Note Selection Loading (노트 선택 시 데이터 로딩)** ✨
   - 사용자가 사이드바에서 노트를 클릭할 때 3단계 로딩 전략 적용:
   
   **Step 1: Immediate Selection (즉시 선택)**
   - 클릭한 노트를 즉시 `selectedNote.value`에 할당
   - 사용자는 대기 없이 즉시 내용 확인 가능 (UX 최적화)
   
   **Step 2: IndexedDB Load (로컬 우선 로드)**
   - `LocalDB.getNote(id)`로 IndexedDB에서 최신 로컬 데이터 조회
   - 오프라인 편집 내용이 있으면 즉시 반영
   - 로컬 데이터가 메모리 데이터보다 최신일 수 있음 (Dirty 상태)
   
   **Step 3: Server Sync (백그라운드 동기화)**
   - `GET /api/notes/{id}`로 서버에서 최신 데이터 fetch
   - 서버 버전과 로컬 버전의 `content_hash` 비교
   - 서버에 더 최신 버전이 있으면:
     - IndexedDB 캐시 업데이트 (`LocalDB.saveNotesBulk`)
     - UI 갱신 (현재 선택된 노트인 경우만)
   - 충돌 감지 및 로깅
   
   **장점:**
   - ⚡ **빠른 응답**: 즉시 UI 표시 (Step 1)
   - 📦 **오프라인 지원**: IndexedDB 우선 확인 (Step 2)
   - 🔄 **데이터 일관성**: 서버와 자동 동기화 (Step 3)
   - 🔍 **충돌 감지**: content_hash 비교로 버전 확인

### 📊 데이터 흐름도 (Data Flow Diagrams)

#### 🚀 Flow 1: 앱 초기 로딩 (Initial App Load)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  사용자가 앱 접속 (https://shynote.app)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 1: Instant Load from IndexedDB (~10ms)                            │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  App (Memory)                                             │           │
│  │    ↓                                                      │           │
│  │  LocalDB.getAllNotes()                                    │           │
│  │    ↓                                                      │           │
│  │  IndexedDB (Disk Cache)                                   │           │
│  │    - notes: [{ id, title, content, ... }]                │           │
│  │    - folders: [{ id, name, ... }]                        │           │
│  │    ↓                                                      │           │
│  │  notes.value = cachedNotes  ← 메모리에 로드              │           │
│  │    ↓                                                      │           │
│  │  UI 렌더링 (사이드바 목록 즉시 표시) ✅                   │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: Background Sync from Server (~100-500ms)                       │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  App (Memory)                                             │           │
│  │    ↓                                                      │           │
│  │  authenticatedFetch('/api/notes')                         │           │
│  │    ↓                                                      │           │
│  │  Server (PostgreSQL/SQLite)                               │           │
│  │    - SELECT * FROM notes WHERE user_id = ?               │           │
│  │    ↓                                                      │           │
│  │  serverNotes = [{ id, title, content, content_hash, ... }]│          │
│  │    ↓                                                      │           │
│  │  Merge Logic (Hash Comparison)                            │           │
│  │    ┌─────────────────────────────────────────┐            │           │
│  │    │ For each serverNote:                    │            │           │
│  │    │   localNote = await getNote(id)         │            │           │
│  │    │   if (hash mismatch && synced):         │            │           │
│  │    │     → Update IndexedDB (Server Win)     │            │           │
│  │    │   if (not in server && synced):         │            │           │
│  │    │     → Delete from IndexedDB             │            │           │
│  │    └─────────────────────────────────────────┘            │           │
│  │    ↓                                                      │           │
│  │  LocalDB.saveNotesBulk(mergedNotes)                       │           │
│  │    ↓                                                      │           │
│  │  notes.value = await getAllNotes()  ← 메모리 갱신        │           │
│  │    ↓                                                      │           │
│  │  UI 업데이트 (변경사항 반영) 🔄                           │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 📄 Flow 2: 노트 선택 (Note Selection)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  사용자가 사이드바에서 노트 클릭                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 1: Immediate Selection from Memory (~1ms)                         │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  selectNote(note)                                         │           │
│  │    ↓                                                      │           │
│  │  selectedNote.value = note  ← notes.value[index]         │           │
│  │    │                                                      │           │
│  │    │  메모리 계층:                                        │           │
│  │    │  ┌────────────────────────────────────┐             │           │
│  │    │  │ RAM (Vue Reactive State)           │             │           │
│  │    │  │  - notes.value: Array<Note>        │             │           │
│  │    │  │  - selectedNote.value: Note        │             │           │
│  │    │  │  - 속도: ~1ms ⚡                    │             │           │
│  │    │  └────────────────────────────────────┘             │           │
│  │    ↓                                                      │           │
│  │  UI 즉시 렌더링 (Editor + Preview) ✅                     │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: Load from IndexedDB (~10ms)                                    │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  if (hasIDB && note.id):                                  │           │
│  │    ↓                                                      │           │
│  │  localNote = await LocalDB.getNote(note.id)               │           │
│  │    │                                                      │           │
│  │    │  저장소 계층:                                        │           │
│  │    │  ┌────────────────────────────────────┐             │           │
│  │    │  │ IndexedDB (Browser Disk Cache)     │             │           │
│  │    │  │  - Object Store: 'notes'           │             │           │
│  │    │  │  - Key: note.id                    │             │           │
│  │    │  │  - 속도: ~10ms 📦                   │             │           │
│  │    │  └────────────────────────────────────┘             │           │
│  │    ↓                                                      │           │
│  │  if (localNote exists):                                   │           │
│  │    selectedNote.value = localNote  ← 오프라인 편집 반영  │           │
│  │    ↓                                                      │           │
│  │  UI 업데이트 (로컬 데이터 우선) 🔄                        │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 3: Fetch from Server (~100-500ms)                                 │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  if (isAuthenticated):                                    │           │
│  │    ↓                                                      │           │
│  │  serverNote = await fetch(`/api/notes/${note.id}`)        │           │
│  │    │                                                      │           │
│  │    │  네트워크 계층:                                      │           │
│  │    │  ┌────────────────────────────────────┐             │           │
│  │    │  │ Server (PostgreSQL/SQLite)         │             │           │
│  │    │  │  - SELECT * FROM notes WHERE id=?  │             │           │
│  │    │  │  - 속도: ~100-500ms 🌐              │             │           │
│  │    │  └────────────────────────────────────┘             │           │
│  │    ↓                                                      │           │
│  │  Hash Comparison (content_hash)                           │           │
│  │    ┌─────────────────────────────────────────┐            │           │
│  │    │ if (localNote.hash !== serverNote.hash):│            │           │
│  │    │   → Server has newer version            │            │           │
│  │    │   → Update IndexedDB cache              │            │           │
│  │    │   → Update selectedNote.value           │            │           │
│  │    │   → Update Editor content directly      │            │           │
│  │    └─────────────────────────────────────────┘            │           │
│  │    ↓                                                      │           │
│  │  UI 최종 동기화 (서버 최신 데이터) 🔄                     │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### ✏️ Flow 3: 노트 편집 (Note Editing)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  사용자가 에디터에서 내용 수정                                            │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 1: Update Memory (Immediate - 0ms)                                │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  EditorView.onChange()                                    │           │
│  │    ↓                                                      │           │
│  │  selectedNote.value.content = newContent                  │           │
│  │    ↓                                                      │           │
│  │  Preview 즉시 업데이트 ✅                                 │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: Debounced Local Save (1초 후)                                  │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  debouncedUpdate() triggered                              │           │
│  │    ↓                                                      │           │
│  │  LocalDB.saveNote(selectedNote, 'dirty')                  │           │
│  │    ↓                                                      │           │
│  │  IndexedDB 저장 (sync_status: 'dirty') 📦                │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 3: Background Sync to Server (5초 주기)                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  syncWorker.run()                                         │           │
│  │    ↓                                                      │           │
│  │  dirtyNotes = await LocalDB.getDirtyNotes()               │           │
│  │    ↓                                                      │           │
│  │  for each dirtyNote:                                      │           │
│  │    PUT /api/notes/{id}                                    │           │
│  │    ↓                                                      │           │
│  │  Server 저장 성공 → sync_status: 'synced' 🌐             │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🔄 메모리 계층 구조 (Memory Hierarchy)

```
┌──────────────────────────────────────────────────────────────┐
│  Level 1: RAM (Vue Reactive State)                           │
│  ┌────────────────────────────────────────────────┐          │
│  │  notes.value: Array<Note>                      │          │
│  │  selectedNote.value: Note                      │          │
│  │  folders.value: Array<Folder>                  │          │
│  │                                                 │          │
│  │  속도: ~1ms ⚡                                  │          │
│  │  용량: ~10MB (브라우저 메모리 제한)             │          │
│  │  휘발성: 페이지 새로고침 시 초기화              │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
                        ↓ ↑
┌──────────────────────────────────────────────────────────────┐
│  Level 2: IndexedDB (Browser Disk Cache)                     │
│  ┌────────────────────────────────────────────────┐          │
│  │  Object Store: 'notes'                         │          │
│  │    - Key: id (Primary Key)                     │          │
│  │    - Indexes: folder_id, updated_at            │          │
│  │                                                 │          │
│  │  Object Store: 'folders'                       │          │
│  │    - Key: id (Primary Key)                     │          │
│  │                                                 │          │
│  │  속도: ~10ms 📦                                 │          │
│  │  용량: ~50MB-1GB (브라우저별 상이)              │          │
│  │  영속성: 브라우저 캐시 삭제 전까지 유지         │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
                        ↓ ↑
┌──────────────────────────────────────────────────────────────┐
│  Level 3: Server (PostgreSQL/SQLite)                         │
│  ┌────────────────────────────────────────────────┐          │
│  │  Table: notes                                  │          │
│  │    - id, user_id, title, content               │          │
│  │    - folder_id, content_hash                   │          │
│  │    - created_at, updated_at                    │          │
│  │                                                 │          │
│  │  Table: folders                                │          │
│  │    - id, user_id, name                         │          │
│  │                                                 │          │
│  │  속도: ~100-500ms 🌐                            │          │
│  │  용량: 무제한 (서버 디스크)                     │          │
│  │  영속성: 영구 보관 (SSOT - Single Source of Truth)│        │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 🔄 충돌 해결 정책 (Conflict Resolution)
- **전략**: **Client-side Priority for Dirty Notes** (수정 중인 로컬 데이터 절대 우선)
- **이유**: 사용자가 방금 작성한 내용이 서버의 내용보다 최신일 확률이 높으며, 작성 중인 내용이 덮어씌워지는 경험("Ghost Typing")을 방지하기 위함.

### 🧟 좀비 데이터 및 삭제 정책 (Deletion Policy)
로컬-우선 동기화 특성상, 드문 확률로 삭제된 데이터가 재동기화 시 부활하는 **"좀비 데이터(Zombie Data)"** 현상이 발생할 수 있습니다.
- **현상**: A기기 삭제 -> B기기 오프라인 수정 -> B기기 온라인 동기화 시 서버로 재전송.
- **정책**: 복잡한 Tombstone(삭제 마커) 시스템 대신 **"사용자의 명시적 재삭제"**를 유도하는 단순한 정책을 유지합니다. 
- **근거**: 개인 노트 앱 특성상 동시 편집 빈도가 낮으며, 데이터 유실보다는 데이터 보존이 더 안전한 방향이기 때문입니다.

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
  - `content_hash`: (Optional) 변경 감지용 해시

### 📂 Folders Store (`folders`)
폴더 계층 구조를 캐싱하여 오프라인상에서도 트리 구조를 유지합니다.
- **Key**: `id` (Folder ID)
- **Fields**:
  - `id`: 폴더 고유 ID
  - `name`: 폴더명
  - `user_id`: 소유자 ID

### 📋 Pending Logs Store (`pending_logs`)
오프라인 상태나 네트워크 지연 시 변경사항을 임시 저장하는 큐(Queue)입니다.
- **Key**: `id` (Auto-Increment Integer)
- **Fields**:
  - `id`: 로그 ID
  - `entity`: 대상 엔티티 타입 (`note` | `folder`)
  - `entity_id`: 대상 엔티티 UUID
  - `action`: 수행할 작업 (`CREATE` | `UPDATE` | `DELETE`)
  - `payload`: 변경 데이터 (JSON Object)
  - `timestamp`: 생성 시각

