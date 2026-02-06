---
name: shynote
description: SHYNOTE 외부 공유 API 호출 스킬
---

# SHYNOTE 외부 공유 API 호출

## 목적
- 환경변수 `SHYNOTE_API_KEY`를 사용해 `/api/new`로 노트를 전송한다.
- 요청 헤더는 `Authorization: Bearer <API_KEY>` 형식을 사용한다.

## 기본 사용법 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
curl -sS -X POST "https://shynote.vercel.app/api/new" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"External Note","content":"# Hello"}'
```

## stdin 사용 예시 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
cat note.md | jq -Rs '{title:"From Stdin", content:.}' | \
  curl -sS -X POST "https://shynote.vercel.app/api/new" \
    -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @-
```

## 서버 주소 변경
```bash
export SHYNOTE_API_KEY="발급받은키"
BASE_URL="https://shynote.vercel.app"
curl -sS -X POST "${BASE_URL}/api/new" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Remote Note","content":"text"}'
```

## 체크리스트
- API Key가 로그인된 사용자 계정에서 발급되었는지 확인한다.
- `currentUserId`와 `/api/new` 응답의 `user_id`가 동일한지 확인한다.
- 노트가 보이지 않으면 `/api/notes` 응답을 먼저 확인한다.
