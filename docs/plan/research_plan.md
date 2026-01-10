# SHYNOTE 기술 연구 및 로드맵 제안 (Technical Research & Roadmap)

## 1. 편집기 고도화 (Editor Enhancement) - [결정 완료]

초기에는 기능 확장을 위해 `CodeMirror 6` 등의 외부 라이브러리 도입을 검토하였으나, 모바일 호환성 및 유지보수 효율성을 위해 **Web Standard `textarea`를 유지하고 기능을 직접 확장**하는 방향으로 선회하였습니다.

### 결정 사항: Native Textarea 기반 자체 확장
- **결정 배경**:
  - `CodeMirror`, `Monaco` 등은 데스크탑 환경에서는 강력하나, 모바일 브라우저(iOS Safari 등)에서 가상 키보드 동작, 커서 제어, 스크롤 등 네이티브 동작과의 이질감이 발생함.
  - 외부 의존성을 제거하여 앱의 경량화 유지.

### 구현된 기능 (Implemented Features):
`textarea`의 한계를 극복하기 위해 바닐라 JS로 다음 기능들을 직접 구현하였습니다.

1.  **고급 텍스트 조작 (Keyboard Shortcuts)**:
    - **Indentation**: `Tab` (들여쓰기), `Shift+Tab` (내어쓰기) - 멀티라인 지원.
    - **Line Actions**: `Alt+↑/↓` (줄 이동), `Shift+Alt+↑/↓` (줄 복제), `Shift+Cmd+K` (줄 삭제).
    - **Editor Navigation**: 스마트한 커서 위치 조정 및 스크롤 동기화.

2.  **검색 및 바꾸기 (Search & Replace)**:
    - **자체 위젯**: 에디터 상단에 Native UI로 통합된 검색바 구현.
    - **기능**: 정규식(`Regex`), 대소문자 구분(`Case Sensitive`), 모두 바꾸기 지원.
    - **UX 최적화**: 
      - `Enter` 키 입력 시 포커스를 유지하며 다음 찾기 수행 (빠른 탐색).
      - 모바일 환경에서도 화면 가림 없이 동작하도록 레이아웃 최적화.

3.  **포맷팅 툴바 (Formatting Toolbar)**:
    - **Sticky Toolbar**: 스크롤 시에도 상단에 고정되어 접근성 확보.
    - **기능 확장**: 기존 Bold/Italic 외 `H4`, `H5`, `Code Block` 등 추가.

### 향후 계획 (Future Plan)
- **Overlay Highlight (보류)**: 검색어 하이라이팅을 위한 `Backdrop` 기법은 스크롤 동기화 및 폰트 렌더링 미세 오차 문제로 인해 현재는 제외되었습니다. 추후 필요 시 `Canvas` 기반 렌더링이나 단순 `mark` 태그 오버레이를 재검토할 수 있습니다.

---

## 2. 성능 및 데이터 안정성 (Performance & Data Safety)
현재의 `Debounce(1s)` 방식은 서버 부하를 줄여주지만, 저장 전 브라우저 종료 시 데이터 유실 위험이 있습니다. **Local-First** 전략을 제안합니다.

### 자동 저장 고도화 전략 (Proposed Strategy)
**Transaction Log & Checkpoint 방식**
1.  **Local Write (1차 저장)**:
    - 타이핑 발생 시 즉시(Throttle ~200ms) **localStorage** 또는 **IndexedDB**에 변경 사항을 기록합니다.
    - 이때 전체 텍스트보다는 `Diff` 혹은 `Last State`를 저장하여 I/O를 최적화합니다.
2.  **Background Sync (2차 저장 - Checkpoint)**:
    - 타이핑이 멈추거나 일정 주기(예: 30초)마다 서버로 데이터를 전송합니다.
    - 서버 저장 성공 시, Local Storage의 '변경 플래그'를 해제하거나 로그를 정리합니다.
3.  **Crash Recovery (복구)**:
    - 앱 로드 시, 서버 데이터(Server Time)와 로컬 데이터(Local Time)를 비교합니다.
    - 로컬이 더 최신이라면 "저장되지 않은 변경사항 복구" 프롬프트를 띄우거나 자동 동기화합니다.

---

## 3. 백업 및 복원 전략 (Backup & Restore Strategy)
데이터 이동성 및 안전을 위해 JSON 기반의 Export/Import 기능을 구현합니다.

### 1. 백업 (Export)
- **포맷**: JSON (메타데이터 포함)
- **구조**:
  ```json
  {
    "version": "1.0",
    "exported_at": "2024-12-23T12:00:00Z",
    "folders": [...],
    "notes": [...]
  }
  ```

### 2. 복원 (Import) 방식 비교
| 방식 | 동작 설명 | 장점 | 단점 |
|:---:|:---|:---|:---|
| **Reset & Restore** (덮어쓰기) | 기존 데이터를 모두 **삭제**하고 백업본으로 교체 | - 데이터 정합성 보장<br>- "마이그레이션" 용도에 적합 | - 기존 데이터 유실 위험<br>- 사용자 실수 용납 안 됨 |
| **Append Mode** (추가하기) | 기존 데이터 뒤에 백업 데이터를 **추가** | - 기존 데이터 보존<br>- "자료 병합" 용도에 적합 | - 중복 데이터 발생 가능<br>- 폴더명 충돌 시 처리 필요 (예: `Note` -> `Note (1)`) |

### 제안 (Recommendation)
기본적으로 **Append Mode(추가하기)**를 제공하되, 고급 옵션으로 **Reset(초기화 후 복원)**을 제공하는 것이 좋습니다.
- **충돌 처리**: 폴더나 노트 이름이 겹칠 경우 `(1)`, `(2)` 접미사를 붙여 자동 해결하거나 별도 'Imported' 폴더 하위에 격리하여 복원합니다.
