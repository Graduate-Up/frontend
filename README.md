# 졸UP Frontend

경북대학교 컴퓨터학부 졸업요건 확인 서비스 **졸UP**의 프론트엔드입니다.

## 스택

- React 19 + TypeScript
- Vite
- React Router
- CSS Modules + 디자인 토큰(`src/styles/tokens.css`)
- oxlint

## 시작하기

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

개발 서버는 `/api` 요청을 `http://localhost:8000`(백엔드)으로 넘깁니다. 배포할 때는 `VITE_API_BASE_URL`에 백엔드 주소를 넣으세요.

이수 과목은 백엔드에 저장하지 않고 브라우저(localStorage)에만 보관합니다. 판정할 때마다 `/api/v1/evaluations/preview`로 보냅니다.

## 폴더 구조

```
src/
├── api/             # 백엔드 API 타입(openapi.json 기준)·요청 함수
├── state/           # 로그인·둘러보기 세션, 프로필, 이수 과목, 데이터 훅
├── constants/       # 화면 표시용 라벨
├── components/      # 공통 컴포넌트 (Logo, layout/, ui/)
├── pages/           # 화면 단위 컴포넌트
├── routes/          # 사이드바 메뉴 등 라우트 정의
├── types/           # 도메인 타입 (학적, 졸업요건 등)
├── mocks/           # 예시 학생 데이터
└── styles/          # 디자인 토큰
```

`@/` 경로 별칭이 `src/`를 가리킵니다.

## 라우트

| 경로 | 화면 |
| --- | --- |
| `/login` | 로그인 |
| `/onboarding` | 온보딩 (학번 → 세부전공 → 세부 조건) |
| `/` | 내 졸업 현황 |
| `/requirements` | 전체 졸업요건 |
| `/courses` | 이수 내역 |
| `/hidden-credits` | 숨은 학점 |
| `/schedule` | 졸업 일정 |
| `/recommend` | 과목 추천 |
| `/notices` | 근거 공지 모음 |

## 컬러

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-navy` | `#1D3A8A` | 메인 |
| `--color-teal` | `#0E9F8E` | 포인트 |
| `--color-ink` | `#0F1B2D` | 텍스트 · 사이드바 |
| `--color-teal-dark` | `#0B7A6E` | 틸을 텍스트로 쓸 때 |
