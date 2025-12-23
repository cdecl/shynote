# SHYNOTE 기술 연구 및 로드맵 제안 (Technical Research & Roadmap)

## 1. 편집기 고도화 (Editor Enhancement)
현재 `textarea` 기반의 에디터는 가볍지만, 찾기/바꾸기, 정규식 지원, 미니맵 등 고급 기능을 구현하기에는 한계가 있습니다. 이를 위해 기존 오픈소스 에디터 도입을 검토합니다.

### 비교 분석
| 후보 (Option) | 장점 (Pros) | 단점 (Cons) | 추천 여부 |
|:---:|:---|:---|:---:|
| **CodeMirror 6** | - 모듈 방식으로 가벼움<br>- 모바일 친화적<br>- Obsidian(모바일), Replit 등에서 사용<br>- 확장성 우수 | - 설정 난이도 있음<br>- UI 커스터마이징 필요 | **강력 추천** |
| **Monaco Editor** | - VS Code와 동일한 사용자 경험<br>- 강력한 기능 기본 내장 (Find, Replace, Minimap)<br>- Intellisense 지원 | - 매우 무거운 번들 사이즈 (>2MB)<br>- 모바일 지원 약함 | 보류 (IDE급 기능 필요 시 고려) |
| **자체 구현** | - 완벽한 제어 가능<br>- 필요한 기능만 구현하여 경량화 | - 유지보수 비용 매우 높음<br>- 텍스트 버퍼, Undo/Redo 등 기본기 재구현 필요 | 비추천 |

### 제안 (Recommendation)
**CodeMirror 6** 도입을 권장합니다.
- **이유**: `textarea`의 한계를 넘어서면서도 Monaco보다 가볍고 모바일에 대응하기 좋습니다. Markdown 파싱 및 Syntax Highlighting 생태계가 풍부합니다.

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
