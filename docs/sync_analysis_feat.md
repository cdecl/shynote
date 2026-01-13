# 동기화 아키텍처 및 충돌 분석 (Sync Architecture & Conflict Analysis)

## 1. 개요 (Overview)
SHYNOTE는 **Local-First** 동기화 전략을 사용합니다.
- **주 데이터 소스**: IndexedDB (클라이언트)
- **보조 데이터 소스**: Server (PostgreSQL)
- **일관성 모델**: 낙관적 잠금(Optimistic Locking)을 통한 최종 일관성(Eventual Consistency)

---

## 2. 데이터 흐름 (Data Flow)

### A. 쓰기 (WRITE - Typing / Edit)
1.  **메모리 (Memory)**: 사용자가 에디터에서 입력 -> `notes.value` (Reactive State) 즉시 갱신.
2.  **로컬 저장 (Local Persistence)**: `saveNoteDebounced` 함수가 **IndexedDB**에 저장 (`status: 'dirty'`).
    - **Note**: 이때 `pending_logs` 큐에는 **데이터 변경사항만 저장**하며, `version` 정보는 포함하지 않습니다 (v0.5.3 변경).
3.  **푸시 (Push - Background Sync)**:
    -   `syncWorker`가 주기적으로(5초) 또는 트리거 시 실행.
    -   **Loop Prevention**: `conflictMap`에 존재하는(충돌 중인) 노트는 전송 대상에서 **제외(Filter Out)**하여 무한 루프 방지.
    -   **Version Injection**: 전송 직전, **메모리 상의 최신 노트 버전(`notes.value`)**을 조회하여 요청 본문(`body`)에 주입. (빠른 입력 시에도 항상 최신 버전 기반으로 요청 전송)
    -   **성공**: 
        - LocalDB 업데이트 (`status: 'synced'`, `version` 갱신).
        - **Memory Update**: 메모리 상의 노트 버전도 즉시 서버 응답 버전으로 갱신 (Stale Version 방지).
    -   **충돌 (409)**: **충돌 해결 프로세스(Conflict Resolution Flow)** 트리거 및 `fetchNotes(true)`(Pull) 수행.

### B. 읽기 (READ - Load / Sync Now)
1.  **풀 (Pull - `fetchNotes`)**:
    -   서버에서 최신 노트 목록을 가져옴.
    -   **LocalDB 동기화**:
        -   서버에서 삭제된 노트는 로컬에서도 삭제.
        -   서버 버전이 더 높으면 로컬 노트 업데이트.
        -   **충돌 확인**: 로컬이 'dirty' 상태이고, 서버 내용과 다른 경우 -> **충돌 감지(Conflict Detected)**.

---

## 3. 낙관적 잠금 (Optimistic Locking - Version Control)

데이터 유실(Last Write Wins 문제)을 방지하기 위해 `version` (Integer) 컬럼을 사용합니다.

### 로직 (Logic)
1.  **클라이언트**: 
    - 노트 편집 시, 큐에는 변경 내용만 쌓음.
    - `syncWorker`가 서버로 보낼 때, `body.version = current_memory_note.version`으로 현재 버전을 명시.
2.  **서버**:
    -   검사: `if (current_note.version == request.version)`
    -   **일치**: 내용 업데이트, `version`을 1 증가. 200 OK 반환.
    -   **불일치**: (누군가 이미 버전을 올림). **409 Conflict** 반환.

### 개선된 충돌 방지 전략 (v0.5.3)
- **False Conflict 방지**: 기존에는 큐에 들어갈 때의 버전을 사용했으나, 입력이 빠를 경우 큐 뒤쪽의 로그가 '옛날 버전'을 가진 채로 전송되어 충돌(409)이 발생하는 문제가 있었습니다.
- **해결**: 전송 시점에 실시간 버전을 조회하여 주입함으로써, 연속적인 입력도 충돌 없이 순차적으로 저장되도록 개선했습니다.

---

## 4. 충돌 시나리오 (Conflict Scenarios)

### 시나리오 1: 오프라인 수정 충돌 ("Lost Update" 방지)
*   **사용자 A**: 오프라인 상태에서 노트 X(v1) 수정.
*   **사용자 B**: 온라인 상태에서 노트 X 수정 (v1 -> v2).
*   **사용자 A (온라인 전환)**:
    1.  `syncWorker`가 푸시(v1 기반) 시도 -> 409 Conflict.
    2.  `fetchNotes(true)` 로 v2 수신.
    3.  **충돌 감지**: 로컬 Dirty vs 서버 v2.
    4.  `conflictMap` 등록 및 동기화 루프에서 해당 노트 제외.
    5.  UI에 충돌 경고 표시.

---

## 5. 해결 전략 (Resolution Strategy)

사용자는 Merge View를 통해 충돌을 해결합니다.

### A. 내 버전 유지 (Keep My Version)
- **동작**: 내 로컬 변경사항을 유지하고 서버를 덮어씀.
- **로직 (Rebase)**: 
    1. `local.version = server.version` (버전 번호만 서버 기준으로 맞춤).
    2. `saveNote(local)` -> Dirty 상태로 저장.
    3. 다음 Sync에서 `v(server) 기준 요청`으로 전송되므로 성공적으로 업데이트됨 (Force Update 효과).

### B. 서버 버전 사용 (Use Server Version)
- **동작**: 내 변경사항을 버리고 서버 내용을 받아들임.
- **로직 (Overwrite)**:
    1. 로컬 내용을 서버 내용으로 덮어씌움.
    2. `local.version = server.version` 및 `updated_at` 동기화.
    3. **Clean State**: `sync_status = 'synced'`로 설정하고 관련 `pending_logs`를 모두 삭제.

### C. 수동 병합 (Manual Edit)
- 내용을 직접 수정한 뒤 저장하면 **'내 버전 유지'**와 동일한 흐름으로 처리됨.

---

## 6. 동기화 방향 및 함수 매핑 (Sync Direction & Function Mapping)

| 동기화 유형 | 함수 | 방향 | 설명 |
|------------|------|------|------|
| **Push** | `syncWorker()` | LocalDB → Remote | pending_logs를 처리하여 서버로 전송 |
| **Pull** | `fetchNotes()`, `fetchFolders()` | Remote → LocalDB | 서버에서 최신 데이터를 가져와 LocalDB에 저장 |
| **양방향** | `pullSync()` | Push + Pull | syncWorker 후 fetchFolders + fetchNotes 실행 |

### pullSync 통합 함수 (v1.0)
```javascript
const pullSync = async () => {
    if (!hasIDB || !isAuthenticated.value || currentUserId.value === 'guest') return;
    
    try {
        // Push: 로컬 변경사항 서버로 전송
        await syncWorker();
        
        // Pull: 서버 최신 데이터 가져오기
        await Promise.all([fetchFolders(false), fetchNotes(false)]);
        
        // 완료 알림
        loadingState.value = { source: 'CLOUD', message: 'Sync Complete' };
        setTimeout(() => loadingState.value = { source: 'NONE', message: 'Idle' }, 2000);
        
    } catch (error) {
        console.error('Pull sync failed:', error);
        loadingState.value = { source: 'CLOUD', message: 'Sync Failed' };
    }
}
```

---

## 7. Notes 동기화 시계열 (Notes Sync Timeline)

| 시점 | 사용자 액션 | 메모리 | LocalDB | pending_logs | Remote | UI |
|------|-------------|--------|---------|--------------|--------|-----|
| **T0** | 노트 편집 시작 | 즉시 업데이트 | - | - | - | 즉시 반영 |
| **T1** | 1초 후 (debounced) | - | 저장됨 | UPDATE 로그 추가 | - | 이미 반영됨 |
| **T2** | 5초 후 (syncWorker) | - | `sync_status: 'dirty'` | 로그 존재 | 전송 전 | Syncing... |
| **T3** | 전송 성공 | - | `sync_status: 'synced'` | 로그 삭제됨 | 업데이트됨 | Sync Complete |
| **T4** | fetchNotes 실행 | - | 서버 데이터와 병합 | - | 최신 상태 | Pull Complete |

### Notes 주요 특징
- **낙관적 잠금**: `version` 필드로 동시 수정 충돌 방지
- **Version Injection**: 전송 시점에 메모리 상의 최신 버전을 사용하여 False Conflict 방지
- **배치 처리**: 노트는 병렬로 처리 (폴더는 순차 처리)

---

## 8. Folders 동기화 시계열 (Folders Sync Timeline)

| 시점 | 사용자 액션 | 메모리 | LocalDB | pending_logs | Remote | UI |
|------|-------------|--------|---------|--------------|--------|-----|
| **T0** | 폴더 생성/수정/삭제 | 즉시 업데이트 | - | - | - | 즉시 반영 |
| **T1** | 즉시 | - | 저장됨 | CREATE/UPDATE/DELETE 로그 | - | 이미 반영됨 |
| **T2** | 5초 후 (syncWorker) | - | `sync_status: 'dirty'` | 로그 존재 | 전송 전 | Syncing... |
| **T3** | 전송 성공 | - | `sync_status: 'synced'` | 로그 삭제됨 | 업데이트됨 | Sync Complete |
| **T4** | fetchFolders 실행 | - | 서버 데이터와 병합 | - | 최신 상태 | Pull Complete |

### Folders 주요 특징
- **간단한 구조**: `version` 필드 없음 (충돌 가능성 낮음)
- **순차 처리**: 폴더 작업은 순차적으로 처리 (구조적 무결성 보장)
- **Lightweight**: `payload`에 `name`만 저장 (데이터 효율성)

---

## 9. 동기화 트리거별 비교 (Sync Trigger Comparison)

| 트리거 방법 | Push | Pull | 폴더 동기화 | 노트 동기화 | 함수 호출 |
|------------|------|------|-------------|-------------|----------|
| **Status Bar Online** | ❌ | ✅ | ❌ | ✅ | `fetchNotes(true)` (수정 전) |
| **Status Bar Online** (수정 후) | ✅ | ✅ | ✅ | ✅ | `pullSync()` |
| **Status Bar Queue** | ✅ | ❌ | ✅ | ✅ | `syncWorker()` |
| **Command Palette** | ❌ | ✅ | ❌ | ✅ | `fetchNotes(true)` (수정 전) |
| **Command Palette** (수정 후) | ✅ | ✅ | ✅ | ✅ | `pullSync()` |
| **온라인 전환** | ✅ | ✅ | ✅ | ✅ | `pullSync()` |

### 개선 전/후 비교
| 상황 | 개선 전 | 개선 후 |
|------|---------|---------|
| **일관성** | 각기 다름 | 모두 동일 |
| **Push+Pull** | 일부만 | 항상 둘 다 |
| **폴더 동기화** | 안 됨 | 항상 됨 |
| **오류 처리** | 부족함 | 완벽함 |
| **사용자 피드백** | 불일치 | 일관됨 |

---

## 10. 문제 시나리오 및 해결: 폴더 삭제 (Folder Deletion Issue)

### 문제 발생 과정

| 단계 | 기존 동작 (문제) | 원인 |
|------|------------------|------|
| **1. 폴더 삭제** | LocalDB 삭제 + DELETE 로그 | 정상 |
| **2. Sync Now** | `fetchNotes(true)`만 호출 | 폴더 동기화 안 됨 |
| **3. fetchFolders** | 호출되지 않음 | 함수 분리 |
| **4. 서버 응답** | 삭제된 폴더 여전히 존재 | DELETE 로그 미처리 |
| **5. saveFoldersBulk** | 폴더 다시 저장 | pending_logs 무시 |
| **6. 결과** | 폴더 복원됨 ❌ | 사용자 혼란 |

### 해결 방안

#### 1. pullSync 통합 함수 도입
```javascript
const pullSync = async () => {
    await syncWorker();                              // 먼저 Push
    await Promise.all([fetchFolders(false), fetchNotes(false)]); // 그다음 Pull
}
```

#### 2. saveFoldersBulk 개선 필요 (TODO)
```javascript
async saveFoldersBulk(folders) {
    // pending_logs에서 DELETE 목록 확인
    const deletedFolderIds = new Set(
        (await LocalDB.getPendingLogs())
            .filter(l => l.entity === 'folder' && l.action === 'DELETE')
            .map(l => l.entity_id)
    );
    
    // 삭제 대상 필터링
    for (const folder of folders) {
        if (deletedFolderIds.has(folder.id)) {
            continue; // 저장하지 않고 건너뛰기
        }
        await store.put({ ...folder, sync_status: 'synced' });
    }
}
```

---

## 11. pending_logs 구조 (Pending Logs Structure)

| 속성 | 폴더 (Folder) | 노트 (Note) | 설명 |
|--------|----------------|--------------|------|
| **action** | CREATE, UPDATE, DELETE | CREATE, UPDATE, DELETE | 수행할 작업 타입 |
| **entity** | 'folder' | 'note' | 엔티티 유형 |
| **entity_id** | 폴더 ID | 노트 ID | 고유 식별자 |
| **payload** | `{ name: '새 이름' }` | `{ title, content, folder_id, version, content_hash }` | 변경된 데이터 |
| **created_at** | 생성 시간 | 생성 시간 | 로그 생성 시점 |

### pending_logs 처리 순서
1. **폴더 먼저**: 순차적으로 처리 (구조적 무결성)
2. **노트 다음**: 병렬로 배치 처리 (성능 최적화)
3. **삭제 로그**: 404도 성공으로 간주 (멱등성 보장)

---

## 12. sync_status 상태 변화 (Sync Status State Changes)

| 상태 | 생성/수정 후 | 전송 성공 후 | 전송 실패 후 |
|------|-------------|--------------|--------------|
| **폴더** | `'dirty'` | `'synced'` | `'dirty'` (유지) |
| **노트** | `'dirty'` | `'synced'` | `'dirty'` (유지) |

### markFolderSynced 함수
```javascript
async markFolderSynced(id) {
    const folder = await store.get(id);
    if (folder) {
        folder.sync_status = 'synced';  // ← 상태 변경
        await store.put(folder);
    }
}
```

### markNoteSynced 함수
```javascript
async markNoteSynced(id) {
    const note = await store.get(id);
    if (note) {
        note.sync_status = 'synced';  // ← 상태 변경
        await store.put(note);
    }
}
```

---

## 13. 핵심 개선 사항 (Key Improvements)

### v1.0 주요 개선

| 문제 | 원인 | 해결책 | 상태 |
|------|------|--------|------|
| **폴더 복원 문제** | saveFoldersBulk가 pending_logs 무시 | pending_logs 체크 로직 추가 | 🔴 TODO |
| **동기화 불일치** | 세 곳에서 다른 함수 호출 | `pullSync()`로 통일 | ✅ 완료 |
| **UI 오류** | `loadingState.value = null` | 기본값 객체로 변경 | ✅ 완료 |
| **Sync 기능 불안정** | Push+Pull이 분리되어 있음 | `pullSync()`로 양방향 통합 | ✅ 완료 |

### 추가 개선 필요 (TODO)

1. **saveFoldersBulk pending_logs 체크**: 삭제된 폴더 복원 방지
2. **Tombstone 방식 도입**: 삭제된 아이템 명시적 추적
3. **batchDeleteLogs 최적화**: 대량 로그 삭제 성능 개선
4. **Conflict Resolution UI**: 폴더 충돌 해결 인터페이스 개선
5. **Sync Status Visualization**: 상태별 아이콘/색상 표시 개선

---

## 14. 정리 (Summary)

SHYNOTE의 동기화 시스템은 **Local-First 아키텍처**를 기반으로 **낙관적 잠금**과 **최종 일관성** 모델을 따릅니다.

### 핵심 원칙
1. **Local-First**: 모든 작업은 LocalDB에 즉시 저장
2. **Optimistic UI**: 메모리 상태는 즉시 업데이트
3. **Eventual Consistency**: 백그라운드에서 최종 일관성 보장
4. **Idempotency**: 재시도해도 안전한 멱등성 보장

### 동기화 흐름
```
사용자 액션 
  → 즉시 메모리 업데이트 
  → LocalDB 저장 (dirty) 
  → pending_logs 기록
  → 5초 후 syncWorker (Push)
  → 성공 시 sync_status: synced
  → fetchFolders/fetchNotes (Pull)
  → 최종 일관성 확보
```

### 핵심 함수 매핑
| 함수 | 역할 | 호출 방식 |
|------|------|----------|
| **pullSync** | 양방향 동기화 (Push+Pull) | 사용자/온라인 전환 시 |
| **syncWorker** | Push 전용 | 5초 간격/수동 클릭 |
| **fetchNotes** | Pull 전용 (노트) | pullSync 내부/독립 호출 |
| **fetchFolders** | Pull 전용 (폴더) | pullSync 내부/독립 호출 |

이러한 설계 덕분에 SHYNOTE는 오프라인 상태에서도 안전하게 작동하고, 여러 기기 간의 데이터 일관성을 안정적으로 유지할 수 있습니다.
