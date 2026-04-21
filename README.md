# CAPD Frontend

CAPD(복막투석) 일일 기록 검토 및 AI 기반 후속 질문 지원 시스템의 프론트엔드입니다.

## 기술 스택

- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Routing:** React Router v7
- **상태 관리:** Zustand
- **HTTP:** Axios (JWT 자동 첨부)
- **배포 예정:** GCP Cloud Run

---

## 로컬 개발 환경 실행

### Docker (권장)
```bash
# 프로젝트 루트(CAPD/)에서 백엔드와 함께 실행
docker-compose up --build
```
→ http://localhost:5173

### 단독 실행
```bash
cd frontend
npm install
npm run dev
```

---

## 폴더 구조

```
frontend/src/
├── api/                     # 백엔드 API 호출 함수
│   ├── client.ts            # Axios 인스턴스 (JWT 자동 첨부, 401 처리)
│   ├── auth.ts              # 로그인 API
│   ├── records.ts           # 기록 조회/제출/수정 API
│   ├── questions.ts         # 공통 질문 CRUD API
│   └── ai.ts                # AI 맞춤 질문 / 설문 API
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx    # 로그인 (환자/의사 공용)
│   ├── doctor/
│   │   ├── Layout.tsx       # 의사 사이드바 레이아웃
│   │   ├── DashboardPage.tsx    # 환자 목록 + 최근 기록 현황
│   │   ├── RecordDetailPage.tsx # 환자 기록 상세 + 설문 응답
│   │   ├── CommonQPage.tsx      # 공통 질문 관리 (추가/수정/삭제/활성화)
│   │   └── AIReviewPage.tsx     # AI 질문 검토 (준비 중)
│   └── patient/
│       ├── RecordListPage.tsx   # 내 기록 목록
│       ├── RecordSubmitPage.tsx # 오늘 기록 제출 / 수정
│       ├── SurveyPage.tsx       # AI 맞춤 질문 + 공통 질문 응답
│       └── SurveyDonePage.tsx   # 설문 완료 화면
├── components/
│   ├── common/              # 공통 UI 컴포넌트
│   ├── doctor/              # 의사 전용 컴포넌트
│   └── patient/             # 환자 전용 컴포넌트
├── store/                   # Zustand 전역 상태
├── hooks/                   # 커스텀 훅
├── types/                   # TypeScript 타입 정의
├── utils/                   # 유틸 함수
└── router/
    └── index.tsx            # 라우팅 설정 (PrivateRoute 포함)
```

---

## 페이지 & 라우팅

| 경로 | 컴포넌트 | 설명 | 접근 |
|---|---|---|---|
| `/login` | LoginPage | 로그인 | 공용 |
| `/doctor` | DashboardPage | 환자 목록 + 기록 현황 | 의사 |
| `/doctor/record` | RecordDetailPage | 기록 상세 + 설문 확인 | 의사 |
| `/doctor/common-questions` | CommonQPage | 공통 질문 관리 | 의사 |
| `/doctor/ai-questions` | AIReviewPage | AI 질문 검토 | 의사 |
| `/patient` | RecordListPage | 내 기록 목록 | 환자 |
| `/patient/record` | RecordSubmitPage | 오늘 기록 제출/수정 | 환자 |
| `/patient/survey` | SurveyPage | 후속 설문 응답 | 환자 |
| `/patient/survey/done` | SurveyDonePage | 설문 완료 | 환자 |

모든 `/doctor`, `/patient` 경로는 JWT 토큰 없으면 `/login`으로 리다이렉트됩니다.

---

## 인증 흐름

1. `/login`에서 아이디/비밀번호 입력
2. 백엔드에서 JWT 발급 → `localStorage`에 `access_token` 저장
3. `api/client.ts`의 Axios 인터셉터가 모든 요청 헤더에 `Authorization: Bearer {token}` 자동 첨부
4. 401 응답 시 자동으로 `/login` 리다이렉트

---

## 환자 기록 제출 흐름

```
RecordSubmitPage 진입
    ↓
오늘 기록 존재 여부 확인 (GET /api/v1/records/)
    ├── 없음 → 빈 RecordForm (제출 가능)
    └── 있음 → 기존 데이터로 RecordForm 채움 (읽기 전용)
                    ↓
              "수정하기" 버튼 클릭 시 편집 모드 전환
                    ↓
              PUT /api/v1/records/{id} 로 수정 저장
```

---

## AI 설문 흐름

```
기록 제출 완료 후 SurveyPage 진입
    ↓
GET /api/v1/surveys/ai-questions/{record_id}
    → 없으면 자동 생성 (규칙 기반 + RAG + LM Studio)
    ↓
공통 질문(GET /api/v1/questions/) + AI 맞춤 질문 함께 표시
    ↓
환자 응답 후 POST /api/v1/surveys/responses 제출
    ↓
SurveyDonePage
```
