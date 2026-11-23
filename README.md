<div align="center">

# 🎓 졸UP

**경북대학교 컴퓨터학부 졸업요건, 한 화면에서 확인하고 채우기**

들은 과목을 넣으면 남은 졸업요건을 판정하고,<br />
놓친 학점 · 졸업 일정 · 들을 과목까지 알려주는 서비스의 프론트엔드예요.

[**서비스 바로가기 →**](https://frontend-xi-indol-43.vercel.app)

![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## ✨ 주요 기능

| | 기능 | 설명 |
| --- | --- | --- |
| 📊 | **내 졸업 현황** | 졸업학점 · 전공 · 교양 · 다전공 학점 구성과 진행률, 지금 챙겨야 할 것(부족 · 미제출)을 한눈에 |
| 📋 | **전체 졸업요건** | 학점 · 필수 과목 · 졸업자격 · 비교과로 나눠 충족 여부와 근거 공지를 표시. 학부 / 경북대 공통 요건 구분 |
| 📝 | **이수 내역** | 통합정보시스템 성적을 즐겨찾기 한 번으로 가져오기, 수기 입력, 교과 · 비교과 기록 관리 |
| 💎 | **숨은 학점** | 교과구분 오분류 · 대체 인정 · 다전공 분류처럼 *다시 듣지 않고 신청만으로* 살릴 수 있는 학점, 재이수 추천 과목 |
| 📅 | **졸업 일정** | 졸업 학기 기준 자격 확인 · 졸업심사 · 신청 마감 타임라인, 조기졸업 · 졸업유예 안내, 캘린더(.ics) 내보내기 |
| 🧭 | **과목 추천** | 남은 요건을 줄이는 과목만 골라 진로(AI · 데이터, 백엔드, 보안, 대학원, 프론트엔드, PM)에 맞게 정렬 |
| 🤖 | **챗봇에게 질문하기** | 내 판정 결과를 근거로 졸업요건 질문에 AI가 답변 |
| 🔗 | **융합전공** | 내 융합전공 과목 태그, 교과구분 변경, 다전공 이수학점(36 / 부전공 18) 추적 |

> 판정은 백엔드 규칙 엔진이 하고, AI는 추천 순서와 설명만 맡아요.<br />
> 최종 졸업 판정은 학부 확인이 필요합니다.

---

## 🚀 시작하기

```bash
npm install
npm run dev       # http://localhost:5173
```

개발 서버는 `/api` 요청을 `http://localhost:8000`(백엔드)으로 넘겨요. 백엔드를 먼저 띄워 주세요.

| 명령어 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint 검사 |

### 환경 변수

| 이름 | 예시 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://jolup-backend.onrender.com` | 배포 시 백엔드 주소. 비워두면 같은 출처의 `/api`를 써요 |

---

## 🧱 기술 스택

- **React 19 + TypeScript**, **React Router**
- **Vite** — 개발 서버 · 빌드
- **CSS Modules + 디자인 토큰** (`src/styles/tokens.css`)
- **oxlint** — 린트
- **Vercel** — 배포 (`main` 브랜치 머지 시 자동 배포, `vercel.json`으로 SPA 라우팅)

---

## 🗂 폴더 구조

```
src/
├── api/          # 백엔드 API 타입(openapi 기준) · 요청 함수
├── state/        # 세션 · 학적 · 이수 기록 상태, 데이터 훅, 판정 보정 · 추천 · 숨은 학점 · 재이수 로직
├── content/      # 화면 안내 콘텐츠 (채우는 방법, 대체 인정, 융합전공 목록, 영어 시험 등)
├── constants/    # 화면 표시용 라벨
├── components/   # 공통 컴포넌트 (layout/, ui/, courses/, side/)
├── pages/        # 화면 단위 컴포넌트
├── routes/       # 사이드바 메뉴 정의
├── types/        # 도메인 타입
├── mocks/        # 둘러보기용 예시 학생 데이터
└── styles/       # 디자인 토큰
```

`@/` 경로 별칭이 `src/`를 가리켜요.

---

## 🧭 화면 구성

| 경로 | 화면 |
| --- | --- |
| `/login` | 로그인 · 회원가입 · 비밀번호 재설정 (@knu.ac.kr 이메일 인증) |
| `/onboarding` | 학적 설정 (학번 · 세부전공 · ABEEK · 다전공 · 융합전공 · 졸업 예정 학기) |
| `/` | 내 졸업 현황 |
| `/requirements` | 전체 졸업요건 |
| `/requirements/:id` | 요건 상세 (내 기록 · 채우는 방법 · 근거) |
| `/courses` | 이수 내역 (교과 · 비교과) |
| `/hidden-credits` | 숨은 학점 |
| `/schedule` | 졸업 일정 |
| `/chat` | 챗봇에게 질문하기 |
| `/recommend` | 과목 추천 |
| `/notices` | 근거 공지 모음 |
| `/account` | 통합정보시스템 즐겨찾기가 성적을 넘겨주는 창 |

---

## 🔐 로그인과 데이터

| | 로그인 | 둘러보기 |
| --- | --- | --- |
| 학적 · 이수 기록 | 서버에 저장, 어느 기기에서나 이어보기 | 이 브라우저(localStorage)에만 |
| 성적 한 번에 가져오기 | ✅ | — |
| 과목 추천 | 서버 추천 + AI 정렬 | 브라우저에서 계산 |
| 챗봇 | ✅ | — |

- 통합정보시스템 성적 원문은 저장하지 않고, 과목 · 학점 · 성적등급만 남겨요.
- 챗봇과 AI 추천에는 계정 정보와 성적표 전체를 보내지 않아요.

---

## 🎨 컬러

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-navy` | `#1D3A8A` | 메인 |
| `--color-teal` | `#0E9F8E` | 포인트 · 충족 |
| `--color-ink` | `#0F1B2D` | 텍스트 · 사이드바 |
| `--color-teal-dark` | `#0B7A6E` | 틸을 텍스트로 쓸 때 |
| `--color-danger` | `#C0262D` | 부족 · 미제출 |
| `#B4236B` | — | 다전공 · 융합전공 |

---

<div align="center">

**졸UP** · 경북대학교 컴퓨터학부 · [Graduate-Up](https://github.com/Graduate-Up)

</div>
