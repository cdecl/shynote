# Skills 외부 공유 API

## 개요
SHYNOTE는 agent skills 용도로 사용할 수 있도록 API Key 기반의 외부 공유 API를 제공합니다.
이 API는 로그인 계정에서 발급한 API Key를 통해 노트를 생성, 수정, 조회, 검색, 목록 조회할 수 있습니다.

## 인증
모든 요청에 다음 헤더가 필요합니다.
`Authorization: Bearer <API_KEY>`

## 엔드포인트
`POST /api/new`
노트 생성.

`GET /api/view/{note_id}`
노트 1건 조회.

`PUT /api/update/{note_id}`
노트 수정.

`GET /api/search?q=...`
제목 LIKE 검색. 결과는 `{id, title}` 목록.

`GET /api/list?limit=50&skip=0`
최신 수정 기준 제목 목록. 결과는 `{id, title}` 목록.

## 예시
```bash
export SHYNOTE_API_KEY="발급받은키"

# 생성
curl -sS -X POST "https://shynote.vercel.app/api/new" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"External Note","content":"# Hello"}'

# 보기
NOTE_ID="노트ID"
curl -sS -X GET "https://shynote.vercel.app/api/view/${NOTE_ID}" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"

# 수정
curl -sS -X PUT "https://shynote.vercel.app/api/update/${NOTE_ID}" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","content":"Updated content"}'

# 제목 검색
curl -sS -X GET "https://shynote.vercel.app/api/search?q=meeting" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"

# 제목 목록
curl -sS -X GET "https://shynote.vercel.app/api/list?limit=50&skip=0" \
  -H "Authorization: Bearer ${SHYNOTE_API_KEY}"
```

## 주의사항
API Key는 사용자 계정에 종속됩니다.
조회/수정/검색/목록은 해당 API Key 소유자의 노트만 대상으로 합니다.
