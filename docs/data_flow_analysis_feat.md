# SHYNOTE 데이터 흐름 분석

## 📋 목차

- [아키텍처 개요](#아키텍처-개요)
- [주요 액션별 데이터 흐름](#주요-액션별-데이터-흐름)
  - [1. 초기화 및 로드](#1-초기화-및-로드-초기-진입-시)
  - [2. 노트 생성 (CREATE)](#2-노트-생성-create)
  - [3. 노트 수정 (UPDATE)](#3-노트-수정-update)
  - [4. 노트 삭제 (DELETE)](#4-노트-삭제-delete)
  - [5. 폴더 관리 (CRUD)](#5-폴더-관리-crud)
  - [6. 동기화 전략 (SYNC)](#6-동기화-전략-sync)
  - [7. 오프라인 지원](#7-오프라인-지원)
  - [8. 게스트 모드](#8-게스트-모드)
- [데이터 모델](#데이터-모델)
- [주요 동기화 메커니즘](#주요-동기화-메커니즘)
- [현황 요약](#현황-요약)

---

## 아키텍처 개요

```
┌─────────────┐
│   UI Layer  │ (Vue.js Reactive State)
│   Memory    │ ← notes[], folders[], selectedNote
└──────┬──────┘
       │
       ├─▶ Local Storage (사용자 설정: 다크모드, 폰트 크기 등)
       │
       ├─▶ IndexedDB (LocalDB)
       │   - notes store (sync_status: dirty/synced)
       │   - folders store (sync_status: dirty/synced)
       │   - pending_logs (동기화 대기열)
       │
       └─▶ Backend API (FastAPI + SQLAlchemy)
           - PostgreSQL/SQLite
           - OAuth 2.0 인증
```

**특징:**
- **Local-First 아키텍처**: 모든 데이터가 먼저 IndexedDB에 저장
- **Optimistic UI**: 로컬 데이터를 즉시 표시 후 백그라운드 동기화
- **오프라인 지원**: 네트워크 연결 없이도 모든 기능 작동

---

## 주요 액션별 데이터 흐름

### 1. 초기화 및 로드 (초기 진입 시)

#### 인증 체크
```javascript
checkAuth() →
  ├─ localStorage에서 토큰 확인
  ├─ fetchUserProfile() → /auth/me
  └─ currentUserId.value 설정
```

#### 데이터 로드 (최적화된 순서)
```javascript
onMounted() →
  ├─ fetchUserProfile()
  │
  ├─ fetchFolders()
  │   ├─ 1. LocalDB.getAllFolders(uid) → 즉시 UI 업데이트
  │   └─ 2. authenticatedFetch('/api/folders') → 백그라운드
  │       └─ LocalDB.saveFoldersBulk() → 병합
  │
  └─ fetchNotes()
      ├─ 1. LocalDB.getAllNotes(uid) → 즉시 UI 업데이트 (loading: false)
      └─ 2. authenticatedFetch('/api/notes') → 백그라운드
          └─ LocalDB.saveNotesBulk() → 충돌 감지 후 병합
```

**특징:**
- **Optimistic UI**: 로컬 데이터를 먼저 표시
- **백그라운드 동기화**: 서버 데이터를 비동기로 가져와 병합
- **충돌 감지**: `content_hash` 비교로 충돌 발견 시 MergeView 표시

---

### 2. 노트 생성 (CREATE)

```javascript
createNote() →
  ├─ 1. uuidv7()로 UUID v7 생성 (시간 순서 보장)
  ├─ 2. content_hash 계산: SHA-256(id:title:content:folder_id)
  ├─ 3. LocalDB.saveNote(newNote, 'CREATE')
  │   ├─ notes store에 저장 (sync_status: 'dirty')
  │   └─ pending_logs에 {action: 'CREATE', entity: 'note'} 추가
  ├─ 4. notes.value.unshift(newNote) → UI 업데이트
  └─ 5. 백그라운드: syncWorker()가 동기화
      └─ POST /api/notes → 로그 삭제 후 markNoteSynced()
```

**데이터 구조:**
```javascript
{
  id: "0190xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  // UUID v7
  title: "2026-01-01 14:30",
  content: "",
  content_hash: "abc123...",                   // SHA-256
  folder_id: null,
  user_id: "xxx",
  sync_status: "dirty",                        // IndexedDB에서만 사용
  local_updated_at: "2026-01-01T..."          // IndexedDB에서만 사용
}
```

---

### 3. 노트 수정 (UPDATE)

```javascript
// 사용자가 에디터에서 타이핑
EditorView.updateListener →
  ├─ selectedNote.value.content = update.state.doc.toString()
  └─ debouncedUpdate() (1초 디바운스)
      ├─ content_hash 재계산
      ├─ LocalDB.saveNote(note, 'UPDATE')
      │   ├─ notes store 업데이트 (sync_status: 'dirty')
      │   └─ pending_logs에 {action: 'UPDATE'} 추가
      └─ statusMessage.value = 'Save Complete'
```

**백그라운드 동기화:**
```javascript
syncWorker() (5초 간격) →
  ├─ LocalDB.getPendingLogs()
  ├─ 중복 제거 (CREATE + UPDATE → CREATE)
  ├─ 정렬 (폴더 먼저 → 노트)
  └─ 각 로그마다:
      ├─ PUT /api/notes/{id} (body: {title, content, folder_id, is_pinned})
      ├─ 성공 시: LocalDB.removeLog() + markNoteSynced()
      └─ 실패 시: 재시 큐에 유지
```

**자가 치유 메커니즘:**
```javascript
// PUT 실패 404 시 → POST로 재시도 (복구 로직)
if (response.status === 404 && method === 'PUT') {
  // 엔티티가 서버에 없으면 CREATE로 재시도
  await authenticatedFetch('/api/notes', {method: 'POST', ...})
}
```

---

### 4. 노트 삭제 (DELETE)

```javascript
deleteNote(noteId) →
  ├─ LocalDB.deleteNote(noteId)
  │   ├─ notes store에서 삭제
  │   └─ pending_logs에 {action: 'DELETE'} 추가
  ├─ notes.value = notes.value.filter(n => n.id !== noteId) → UI 업데이트
  └─ 백그라운드: DELETE /api/notes/{noteId}
      └─ 성공 시: 로그 삭제 (404도 성공으로 처리)
```

**휴지통 동작:**
```javascript
// 실제 삭제 대신 폴더 이동
moveToTrash(note) →
  ├─ note.folder_id = TRASH_FOLDER_ID  // "trash-uuid..."
  ├─ LocalDB.saveNote(note, 'UPDATE')
  └─ UI에서 휴지통 폴더로 필터링
```

---

### 5. 폴더 관리 (CRUD)

#### 생성
```javascript
createFolder() →
  ├─ uuidv7()로 ID 생성
  ├─ LocalDB.saveFolder(folder, 'CREATE')
  └─ folders.value.push(folder)
```

#### 이름 변경
```javascript
updateFolderName(folderId, newName) →
  ├─ folder.name = newName
  ├─ LocalDB.saveFolder(folder, 'UPDATE')
  └─ PUT /api/folders/{folderId}
```

#### 삭제
```javascript
deleteFolder(folderId) →
  ├─ LocalDB.deleteFolderAndNotes(folderId, noteIds)
  │   ├─ 폴더 삭제
  │   └─ 연관 노트 전체 삭제 + DELETE 로그 생성
  └─ DELETE /api/folders/{folderId}
      └─ 서버에서 cascade delete로 노트도 삭제
```

---

### 6. 동기화 전략 (SYNC)

#### 풀 (Pull) 전략
```javascript
fetchNotes() →
  ├─ 서버에서 전체 노트 가져옴
  ├─ SHA-256 해시 계산: hash(id:title:content:folder_id)
  ├─ LocalDB.saveNotesBulk(serverNotes)
  │   ├─ sync_status === 'dirty'인 항목은 건너뜀 (충돌 방지)
  │   └─ content_hash가 같으면 업데이트 생략 (최적화)
  └─ 충돌 감지:
      ├─ local.sync_status === 'dirty' AND
      ├─ local.content_hash !== server.content_hash
      └─ enterConflictMode(local, server) → MergeView 표시
```

#### 푸시 (Push) 전략
```javascript
syncWorker() (5초 간격, 온라인 시) →
  ├─ LocalDB.getPendingLogs()
  ├─ 로그 중복 제거 (CREATE 후 UPDATE = CREATE)
  ├─ 의존성 정렬: 폴더 먼저 → 노트 나중
  └─ 순차적 전송:
      ├─ 성공: 로그 삭제 + markSynced()
      ├─ 실패: 큐에 유지 (다음 주기에 재시도)
      └─ 404 PUT → POST로 복구 시도
```

#### 충돌 해결
```javascript
resolveConflict(action) →
  ├─ 'use_local':
  │   └─ updateNote() → 서버에 로컬 버전 강제 전송
  └─ 'use_server':
      ├─ localNote.title = serverNote.title
      ├─ localNote.content = serverNote.content
      ├─ LocalDB.saveNote(localNote, {sync_status: 'synced'})
      └─ UI 업데이트
```

---

### 7. 오프라인 지원

#### Service Worker 전략
```javascript
// sw.js
├─ CRITICAL_ASSETS 캐싱 (index.html, app.js, local_db.js 등)
├─ EXTERNAL_ASSETS 캐싱 (Vue, CodeMirror, Tailwind 등)
└─ Fetch 이벤트:
    ├─ API 요청 건너뜀 (/api/, /auth/)
    ├─ 캐시 히트 → 캐시 반환
    ├─ 네트워크 실패 → '/' 폴백
    └─ 기본: 캐시 → 네트워크 → 캐시 업데이트
```

#### 온라인/오프라인 감지
```javascript
window.addEventListener('online') →
  ├─ isOnline.value = true
  ├─ startSync() → syncWorker() + setInterval(5s)
  └─ fetchFolders(), fetchNotes() → 전체 풀

window.addEventListener('offline') →
  ├─ isOnline.value = false
  └─ stopSync() → clearInterval()
```

---

### 8. 게스트 모드

```javascript
if (token === 'guest') →
  ├─ authenticatedFetch 인터셉트
  └─ guestStore (인메모리 모의 DB):
      ├─ user: {id: 'guest', email: 'guest@shynote.app'}
      ├─ notes: [...]
      └─ folders: [...]
```

**특징:**
- IndexedDB 사용하지 않음
- 서버 요청하지 않음 (완전 로컬)
- 새로고침 시 데이터 소멸

---

## 데이터 모델

### IndexedDB 스키마 (local_db.js:6-33)

```
DB_NAME: 'SHYNOTE_VAULT'
DB_VERSION: 8

ObjectStores:
  1. notes
     - keyPath: 'id'
     - indexes: folder_id, updated_at, sync_status, user_id

  2. folders
     - keyPath: 'id'
     - indexes: user_id

  3. pending_logs
     - keyPath: 'id' (autoIncrement)
     - indexes: created_at
     - structure: {action, entity, entity_id, payload, created_at}
```

### Backend 스키마 (models.py)

```python
User:
  id (String, PK)
  email (String, unique)
  provider (String)  # "google"
  is_dark_mode (Boolean)
  view_mode (String)  # "live", "view"

Folder:
  id (String, PK)
  name (String)
  user_id (String, FK)

Note:
  id (String, PK)
  title (String)
  content (Text)
  folder_id (String, FK, nullable)
  user_id (String, FK)
  share_id (String, unique, nullable)
  is_shared (Boolean)
  is_pinned (Boolean)
  created_at (DateTime)
  updated_at (DateTime)
```

---

## 주요 동기화 메커니즘

### 해시 기반 변경 감지
```javascript
const hashBase = `${note.id}:${note.title}:${note.content || ''}:${note.folder_id || 'null'}`
note.content_hash = await shynote_hash(hashBase)  // SHA-256
```

### 상태 관리
- `sync_status: 'dirty'` → 로컬에서 수정됨, 동기화 필요
- `sync_status: 'synced'` → 서버와 동기화됨

### 로그 기반 동기화
```javascript
// pending_logs 예시
{
  id: 1,
  action: 'UPDATE',
  entity: 'note',
  entity_id: 'uuid-v7-here',
  payload: {title: 'New Title', content: '...', folder_id: 'folder-uuid'},
  created_at: '2026-01-01T14:30:00Z'
}
```

### 자동 복구
- PUT 404 → POST 재시도 (서버에 없는 경우)
- 폴더 → 노트 순서 전송 (의존성 보장)

---

## 현황 요약

| 구성 요소 | 상태 | 설명 |
|---------|------|------|
| 메모리 객체 (Vue) | ✅ 완전 | notes[], folders[], selectedNote 등 반응형 상태 |
| IndexedDB | ✅ 완전 | Local-first 아키텍처, 오프라인 지원 |
| Backend API | ✅ 완전 | FastAPI + PostgreSQL/SQLite |
| 동기화 (Sync) | ✅ 완전 | Pull/Push 전략, 충돌 해결, 자가 치유 |
| 오프라인 지원 | ✅ 완전 | Service Worker, 온라인/오프라인 감지 |
| 게스트 모드 | ✅ 완전 | 인메모리 백엔드 모의 |
# SHYNOTE 데이터 흐름 ASCII 다이어그램

```
╔══════════════════════════════════════════════════════════════════════╗
║                     SHYNOTE 데이터 흐름 아키텍처                          ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│                        [브라우저 레이어]                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│   UI Layer   │◀───▶│  Vue State   │◀───▶│   CodeMirror Editor          │
│  (HTML/CSS)  │     │  (Reactive)  │     │   (Markdown Editor)          │
└──────────────┘     └──────┬───────┘     └──────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │  Memory Objects        │
                   ├────────────────────────┤
                   │ • notes[]             │
                   │ • folders[]           │
                   │ • selectedNote        │
                   │ • isDarkMode          │
                   │ • isSyncing           │
                   └───────────┬────────────┘
                               │
                               ├─────────────────┐
                               │                 │
                               ▼                 ▼
                    ┌──────────────┐    ┌──────────────┐
                    │ localStorage  │    │ IndexedDB    │
                    ├──────────────┤    ├──────────────┤
                    │ • Settings   │    │ • notes      │
                    │   - DarkMode │    │ • folders    │
                    │   - FontSize │    │ • logs       │
                    │   - ViewMode │    │ • sync_status│
                    │ • User ID    │    │   dirty/synced│
                    └──────────────┘    └──────┬───────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        [네트워크 레이어]                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────────────────┐     ┌──────────────┐
│ Service      │◀───▶│   AuthenticatedFetch         │◀───▶│  FastAPI     │
│ Worker       │     │   (API Calls)               │     │  Backend     │
│ (PWA Cache)  │     │                              │     │              │
└──────────────┘     │ • GET  /api/notes           │     └──────┬───────┘
                     │ • POST /api/notes                  │
                     │ • PUT  /api/notes/{id}            │
                     │ • DELETE /api/notes/{id}           │
                     │ • GET  /api/folders               │
                     │ • POST/PUT/DELETE /api/folders     │
                     └────────────────────────────────────┘
                                                          │
                                                          ▼
                                            ┌────────────────────────┐
                                            │   Database            │
                                            │   (PostgreSQL/SQLite) │
                                            ├────────────────────────┤
                                            │ • users               │
                                            │ • folders             │
                                            │ • notes               │
                                            └────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        1. 노트 생성 (CREATE)                            ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────┐
│ User    │ 클릭 "New Note"
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ createNote()                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. uuidv7() → "0190xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"               │
│ 2. content_hash = SHA256(id:title:content:folder_id)              │
│ 3. newNote = {id, title, content, content_hash, sync_status:'dirty'}│
└────┬────────────────────────────────────────────────────────────────┘
     │
     ├──────────────────────────────────────────────────────┐
     │                                                     │
     ▼                                                     ▼
┌─────────────────────┐                          ┌─────────────────────┐
│ LocalDB.saveNote()  │                          │ UI 업데이트         │
├─────────────────────┤                          ├─────────────────────┤
│ • notes store       │                          │ notes.unshift(note) │
│   → PUT (dirty)     │                          │ selectedNote=note   │
│ • pending_logs      │                          │ rightPanelMode='edit'│
│   → ADD 'CREATE'    │                          └─────────────────────┘
└──────┬──────────────┘
       │
       │ [백그라운드]
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ syncWorker() (5초 간격)                                          │
├─────────────────────────────────────────────────────────────────────┤
│ 1. pending_logs에서 'CREATE' 로그 확인                              │
│ 2. POST /api/notes {id, title, content, folder_id}                │
│ 3. 성공:                                                           │
│    - LocalDB.removeLog()                                           │
│    - LocalDB.markNoteSynced()                                      │
│    - note.sync_status = 'synced'                                   │
└─────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        2. 노트 수정 (UPDATE)                            ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────┐
│ User    │ 타이핑...
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CodeMirror Editor                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ EditorView.updateListener                                         │
│   → selectedNote.content = update.state.doc.toString()             │
│   → debouncedUpdate() [1초 디바운스]                               │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ debouncedUpdate()                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 1. content_hash = SHA256(id:title:content:folder_id)              │
│ 2. LocalDB.saveNote(note, 'UPDATE')                                │
│    • notes store → PUT (dirty)                                     │
│    • pending_logs → ADD 'UPDATE'                                  │
│ 3. statusMessage = 'Save Complete'                                 │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │ [백그라운드]
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ syncWorker()                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. pending_logs에서 'UPDATE' 로그 확인                              │
│ 2. PUT /api/notes/{id} {title, content, folder_id}                 │
│ 3. 성공:                                                           │
│    - 로그 중복 제거 (CREATE+UPDATE → CREATE)                        │
│    - LocalDB.removeLog()                                           │
│    - LocalDB.markNoteSynced()                                      │
│ 4. 실패 404:                                                       │
│    - 자가 치유: POST /api/notes로 재시도 (복구)                     │
└─────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        3. 데이터 동기화 (SYNC)                           ║
╚══════════════════════════════════════════════════════════════════════╝

                          ┌──────────┐
                          │  App Start│
                          └─────┬────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐
        │fetchFolders()│ │ fetchNotes() │ │  Online Event        │
        └──────┬──────┘ └──────┬──────┘ └──────────┬───────────┘
               │                │                     │
               │                │                     ▼
               │                │            ┌─────────────────┐
               │                │            │ startSync()     │
               │                │            │  • syncWorker() │
               │                │            │  • setInterval  │
               │                │            └─────────────────┘
               │                │
               ▼                ▼
        ┌──────────────────────────────────────────────┐
        │           PULL 단계 (서버 → 로컬)             │
        ├──────────────────────────────────────────────┤
        │ 1. GET /api/notes → serverNotes[]          │
        │ 2. 각 note에 content_hash 계산               │
        │ 3. LocalDB.saveNotesBulk(serverNotes)        │
        │    ├─ sync_status=='dirty' → 건너뜀          │
        │    ├─ content_hash 일치 → 건너뜀 (최적화)    │
        │    └─ 나머지 → PUT (synced)                 │
        │ 4. 서버에 없고 dirty 아닌 것 → DELETE        │
        │ 5. 충돌 감지:                             │
        │    local.dirty && local.hash != server.hash   │
        │    → enterConflictMode()                    │
        └──────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │           PUSH 단계 (로컬 → 서버)             │
        ├──────────────────────────────────────────────┤
        │ 1. LocalDB.getPendingLogs()                 │
        │ 2. 로그 중복 제거 및 정렬 (폴더→노트)        │
        │ 3. 각 로그 순차 전송:                       │
        │    • CREATE → POST /api/notes               │
        │    • UPDATE → PUT /api/notes/{id}           │
        │    • DELETE → DELETE /api/notes/{id}       │
        │ 4. 성공: removeLog() + markSynced()         │
        │ 5. 실패 404: 자가 치유 (PUT → POST)         │
        └──────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        4. 충돌 해결 (CONFLICT)                         ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ 충돌 감지 조건                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ • localNote.sync_status === 'dirty'                               │
│ • localNote.content_hash !== serverNote.content_hash                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │      enterConflictMode()              │
        ├───────────────────────────────────────┤
        │  conflictState = {                   │
        │    isConflict: true,                  │
        │    localNote: {...},                  │
        │    serverNote: {...}                  │
        │  }                                   │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │      MergeView (CodeMirror)           │
        ├───────────────────────────────────────┤
        │  ┌─────────────┬─────────────┐      │
        │  │   Local     │   Server    │      │
        │  │  (Your Edits)│ (Their Version)│   │
        │  │   [A]       │     [B]     │      │
        │  └──────┬──────┴──────┬──────┘      │
        │         │             │             │
        │         ▼             ▼             │
        │    [Use Local]  [Use Server]        │
        └──────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │      resolveConflict(action)          │
        ├───────────────────────────────────────┤
        │  'use_local':                        │
        │    → updateNote()                    │
        │    → PUT to server (강제 전송)        │
        │                                      │
        │  'use_server':                       │
        │    → localNote = {...serverNote}     │
        │    → LocalDB.saveNote(synced)         │
        │    → UI 업데이트                      │
        └───────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        5. 오프라인 지원                               ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ 온라인 상태                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ • syncWorker() 활성화 (5초 간격)                                   │
│ • fetchNotes() 실행 → 서버와 동기화                                │
│ • statusMessage = 'Syncing...' → 'Pull Complete'                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 오프라인 상태                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ • syncWorker() 비활성화                                            │
│ • 모든 CRUD가 IndexedDB에만 저장 (dirty 상태 유지)                  │
│ • pending_logs 큐에 계속 축적                                      │
│ • statusMessage = 'Save Complete' (로컬 저장 완료)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │      온라인 복구시                    │
        ├───────────────────────────────────────┤
        │  window.addEventListener('online')   │
        │    → startSync()                     │
        │    → fetchFolders() + fetchNotes()   │
        │    → 누적된 로그 전부 전송 (배치)     │
        └───────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        6. 게스트 모드                                 ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ URL: /?mode=guest                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ • localStorage.token = 'guest'                                     │
│ • currentUserId = 'guest'                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │   authenticatedFetch 인터셉트        │
        ├───────────────────────────────────────┤
        │  모든 API 요청이 guestStore로 처리:  │
        │                                      │
        │  guestStore = {                      │
        │    user: {id: 'guest', ...},         │
        │    notes: [...],                     │
        │    folders: [...]                    │
        │  }                                   │
        │                                      │
        │  • IndexedDB 사용 안 함               │
        │  • 서버 요청 안 함                    │
        │  • 완전 인메모리                      │
        │  • 새로고침 시 데이터 소멸           │
        └───────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                        7. 데이터 모델 관계                            ║
╚══════════════════════════════════════════════════════════════════════╝

    ┌─────────────┐
    │    User     │
    ├─────────────┤
    │ id (PK)     │ 1
    │ email       │───┐
    │ is_dark_mode│   │
    └─────────────┘   │
                      │
                      │ N
                ┌─────┴─────┐
                │           │
                ▼           ▼
        ┌───────────┐ ┌───────────┐
        │  Folder   │ │   Note   │
        ├───────────┤ ├───────────┤
        │ id (PK)   │ │ id (PK)   │ N
        │ name      │ │ title     │───┘
        │ user_id   │ │ content   │
        └─────┬─────┘ │ folder_id│ 1
              │       │ user_id   │
              │       │ is_pinned │
              │       │ share_id  │
              │       └─────┬─────┘
              │             │
              │ 1           │
              └─────────────┘

    IndexedDB Structure:
    ┌──────────────────────────────────────────────────────────┐
    │ SHYNOTE_VAULT (v8)                                      │
    ├──────────────────────────────────────────────────────────┤
    │                                                          │
    │  notes (ObjectStore)                                     │
    │    ├─ keyPath: 'id'                                     │
    │    ├─ indexes: folder_id, updated_at, sync_status, user_id│
    │    └─ sync_status: 'dirty' | 'synced'                   │
    │                                                          │
    │  folders (ObjectStore)                                   │
    │    ├─ keyPath: 'id'                                     │
    │    └─ indexes: user_id                                  │
    │                                                          │
    │  pending_logs (ObjectStore)                              │
    │    ├─ keyPath: 'id' (autoIncrement)                     │
    │    └─ {action, entity, entity_id, payload, created_at}   │
    │                                                          │
    └──────────────────────────────────────────────────────────┘
```

## 다이어그램 키 설명

| 기호 | 의미 |
|-----|------|
| `┌─────┐` | 컴포넌트/컨테이너 |
| `┌─────┬─────┐` | 데이터 스토어/테이블 |
| `───▶` | 데이터 흐름 (단방향) |
| `◀───▶` | 데이터 흐름 (양방향) |
| `───┐` `└───` | 분기/병합 |
| `│` | 수직 연결 |
| `▼` | 아래로 흐름 |
| `•` | 리스트 항목 |
| `1` `N` | 1:N 관계 |

## 색상 코드 (터미널에서 표시 시)

- **파란색**: UI/프론트엔드 레이어
- **녹색**: 로컬 데이터 저장소 (IndexedDB, localStorage)
- **노란색**: 네트워크/동기화 레이어
- **빨간색**: 백엔드/서버 레이어

## 참고 파일

- [data_flow_analysis.md](./data_flow_analysis.md) - 상세 데이터 흐름 분석
- [sync_analysis.md](./sync_analysis.md) - 동기화 전략 분석
- [offline_strategy.md](./offline_strategy.md) - 오프라인 지원 전략
