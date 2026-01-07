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
