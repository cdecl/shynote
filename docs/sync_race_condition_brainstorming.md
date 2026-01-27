# 동기화 경쟁 상태 브레인스토밍 리포트 및 해결 계획

## 1. 현재 상황 분석 (Problem Deep Dive)

현재 SHYNOTE의 동기화 구조에서 발생하는 데이터 유실 문제는 단순히 "서버가 로컬을 덮어쓴다"는 현상을 넘어, **메모리(Vue) - 로컬 저장소(IndexedDB) - 서버(API)** 간의 비동기 흐름 불일치에서 기인합니다.

### 경쟁 상태 타임라인 (Race Condition Timeline)

| 시점 | 사용자 / 시스템 액션 | 메모리 (selectedNote) | LocalDB (IndexedDB) | 비고 |
|:---|:---|:---|:---|:---|
| **T=0** | 사용자 타이핑 시작 ("A") | `content: "A"` | `content: ""` (Synced) | `debouncedUpdate` 타이머 시작 (1s) |
| **T=200ms** | `pullSync` 트리거 (자동/수동) | `content: "A"` | `content: ""` (Synced) | |
| **T=300ms** | `fetchNotes` 실행 | `content: "A"` | `content: ""` (Synced) | IDB에서 데이터를 읽음 (여전히 빈 값) |
| **T=500ms** | 서버 응답 수신 | `content: "A"` | `content: ""` (Synced) | 서버도 빈 값을 보냄 (버전 동일할 수 있음) |
| **T=600ms** | `saveNotesBulk` 실행 | `content: "A"` | `content: ""` (Synced) | IDB가 `dirty`가 아니므로 서버 데이터로 덮어씀 |
| **T=700ms** | **[치명적]** `selectedNote` 재설정 | `content: ""` (Overwritten) | `content: ""` (Synced) | `fetchNotes` 내에서 `notes.value`를 갱신하며 참조를 바꿈 |
| **T=1000ms** | `debouncedUpdate` 실행 | `content: ""` | `LocalDB.saveNote("")` | **"A" 유실 확정** |

---

## 2. 브레인스토밍: 잠재적 위협 및 엣지 케이스 (Edge Cases)

### A. "Ghost Typing" 현상
사용자가 입력을 계속하고 있으면 `debouncedUpdate` 타이머가 계속 뒤로 밀립니다. 이 경우 `fetchNotes`가 여러 번 실행될 수 있으며, 사용자가 입력을 멈추기 전까지 IDB는 계속 `synced` 상태로 남아있어 덮어쓰기에 매우 취약해집니다.

### B. "Pull Sync" 중의 동기화 충돌 (409 Conflict)
`syncWorker`가 로컬 변경사항을 푸시하려 할 때, 동시에 `fetchNotes`가 서버에서 새 데이터를 가져오면 `LocalDB`의 상태가 급변합니다. 특히 `fetchNotes`가 `dirty` 검사를 하지만, `syncWorker`가 전송 중인(In-flight) 데이터는 아직 IDB에 반영되지 않았을 수도 있습니다.

### C. 에디터 리렌더링 (Cursor Jump)
`fetchNotes`가 성공하여 `selectedNote.value`의 참조를 바꿀 때, `initEditor()`가 호출되면서 사용자의 커서 위치가 초기화되거나 포커스를 잃는 UX 문제가 병행됩니다.

---

## 3. 해결 방안 브레인스토밍 (Brainstorming Solutions)

### 아이디어 1: 즉각적인 메모리 'Dirty' 플래그 도입 (In-Memory Protection)
- **방법**: 타이핑 첫 글자가 입력되는 순간, 메모리 상의 `selectedNote`에 `isDirtyInMemory: true` 플래그를 할당합니다.
- **장점**: IDB 저장(1s 지연) 전에도 `fetchNotes`가 이를 감지하여 덮어쓰기를 스킵할 수 있습니다.
- **확장**: `debouncedUpdate`가 완료되면 이 플래그를 해제합니다.

### 아이디어 2: 에디터 실제 내용 검증 (Strict Content Validation)
- **방법**: `selectedNote.value`를 교체하기 직전, `CodeMirror` 에디터의 실제 텍스트와 객체의 텍스트를 비교합니다.
- **로직**: `if (editorView.content !== selectedNote.content) abortSwap();`
- **장점**: 프로그래밍적 상태와 관계없이 실제 사용자 입력 데이터를 최우선 보호합니다.

### 아이디어 3: 동기화 잠금 (Sync Lock while Typing)
- **방법**: `debounceTimer`가 활성 상태인 동안 `pullSync`의 `fetch` 단계를 지연시키거나 건너뜜.
- **단점**: 동기화가 너무 오래 지연될 경우 다른 기기의 변경사항을 늦게 받게 됩니다.

### 아이디어 4: 'Dirty' 상태의 즉각적 로그 기록 (Early Logging)
- **방법**: `debouncedUpdate`가 호출되자마자 IDB의 `sync_status`를 `dirty`로만 먼저 바꿉니다 (내용 저장은 1s 후).
- **장점**: 기존 `saveNotesBulk` 보호 로직 (`is(dirty) continue`)을 그대로 활용 가능합니다.

---

## 4. 최종 제안 (Proposed Implementation Plan)

### 단계 1: 즉각적 Dirty 상태 반영 (Fast Path)
`debouncedUpdate` 시작 시, `selectedNote.value.sync_status = 'dirty'`를 메모리에서 즉시 설정합니다.

### 단계 2: 에디터-데이터 정합성 체크 강화
`fetchNotes`의 `selectedNote` 재설정 로직에 에디터 내용 비교 문구 추가.

```javascript
// static/app.js 수정 제안
if (selectedNote.value) {
    const freshReactiveNote = notes.value.find(n => n.id === selectedNote.value.id);
    if (freshReactiveNote) {
        // 에디터에 아직 저장되지 않은 변경사항이 있는지 최종 확인
        const isEditorDirty = editorView.value && editorView.value.state.doc.toString() !== selectedNote.value.content;
        
        if (selectedNote.value.sync_status === 'dirty' || isEditorDirty) {
            console.log('[Sync] Protecting active edit session. Skipping swap.');
            return;
        }
        selectedNote.value = freshReactiveNote;
    }
}
```

### 단계 3: IDB 비동기 보호 (`LocalDB.saveNote` 개선)
`saveNote` 시점에 `pending_logs`에 대한 동기적 마킹 또는 메모리 상태 공유.

## 5. 검증 계획

### 자동화 테스트 (Mocking)
- `fetchNotes`를 강제로 호출하는 테스트 스크립트 작성.
- 타이핑 시뮬레이션 직후(500ms) 동기화를 실행하여 데이터가 유실되는지 확인.

### 수동 테스트
1. 앱 로드 후 즉시 타이핑 시작.
2. 1초가 지나기 전에 'Sync Now' 버튼 클릭.
---

## 6. 구현 결과 (Implementation Result)

사용자 피드백을 반영하여 데이터 보호 로직을 더욱 강화했습니다.

### 적용된 변경 사항
1.  **즉각적인 Dirty 상태 및 리스트 동기화**: `debouncedUpdate`가 호출되는 즉시 `selectedNote.value.sync_status`를 `'dirty'`로 변경하고, 앱의 노트 리스트(`notes.value`)도 즉시 업데이트하여 UI와 동기화 엔진이 변경사항을 즉각 인지하도록 했습니다.
2.  **메모리 우선 충돌 감지 (Conflict Mode)**: `fetchNotes` 시 IDB 데이터뿐만 아니라 현재 메모리의 `selectedNote` 및 에디터의 실제 텍스트를 직접 검사합니다. 서버 데이터와 로컬(메모리/에디터) 데이터가 0.1초라도 차이가 난다면, 단순히 덮어쓰지 않고 **충돌 모드(Conflict Mode)**를 트리거합니다.
3.  **데이터 무결성 보장**: 이제 아주 짧은 찰나의 경쟁 상태(Race Condition)에서도 데이터가 서버 값으로 덮어써지는 대신, 충돌 모드를 통해 사용자가 직접 내용을 검토하고 보존할 수 있습니다.

### 기대 효과
- 앱 로드 직후 매우 빠른 입력 시 발생하던 유실 문제 차단.
- 동기화로 인한 에디터 초기화 및 커서 위치 유실 방지.
- 사용자에게 동기화 충돌 상황을 명확히 알리고 선택권을 제공.
