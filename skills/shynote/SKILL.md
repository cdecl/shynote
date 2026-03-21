---
name: shynote
description: SHYNOTE 외부 공유 API 호출 스킬
---

# SHYNOTE 외부 공유 API 호출

## 목적
- 환경변수 `SHYNOTE_API_KEY`를 사용해 외부 공유용 API를 호출한다.
- `/api/notes`로 노트 생성/목록 조회, `/api/notes/{note_id}`로 보기/수정/삭제,
  `/api/notes?q=...`로 제목 검색을 제공한다.
- 요청 헤더는 `Authorization: Bearer <API_KEY>` 형식을 사용한다.

## 기본 사용법 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
curl -sS -X POST "https://shynote.vercel.app/api/notes" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"External Note","content":"# Hello"}'
```

## 보기 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
NOTE_ID="노트ID"
curl -sS -X GET "https://shynote.vercel.app/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"
```

## 수정 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
NOTE_ID="노트ID"
curl -sS -X PUT "https://shynote.vercel.app/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","content":"Updated content"}'
```

## 제목 검색 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
curl -sS -X GET "https://shynote.vercel.app/api/notes?q=meeting" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"
```

## 제목 목록 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
curl -sS -X GET "https://shynote.vercel.app/api/notes?limit=50&skip=0" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"
```

## stdin 사용 예시 (curl)
```bash
export SHYNOTE_API_KEY="발급받은키"
cat note.md | jq -Rs '{title:"From Stdin", content:.}' | \
  curl -sS -X POST "https://shynote.vercel.app/api/notes" \
    -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @-
```

## 서버 주소 변경
```bash
export SHYNOTE_API_KEY="발급받은키"
BASE_URL="https://shynote.vercel.app"
curl -sS -X POST "${BASE_URL}/api/notes" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Remote Note","content":"text"}'
```

## 체크리스트
- API Key가 로그인된 사용자 계정에서 발급되었는지 확인한다.
- `currentUserId`와 `/api/notes` 응답의 `user_id`가 동일한지 확인한다.
- 노트가 보이지 않으면 `/api/notes` 응답을 먼저 확인한다.
