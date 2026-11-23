/**
 * 융합전공 목록 — 백엔드 GET /convergence-programs를 못 불러올 때(아직 배포 전 등) 쓰는 예비 목록.
 * id · 이름은 백엔드 data/recommendation_programs.json과 같다.
 */
export const CONVERGENCE_PROGRAMS: { id: string; name: string }[] = [
  { id: 'big-data', name: '빅데이터융합전공' },
  { id: 'fintech', name: '핀테크융합전공' },
  { id: 'bioinformatics', name: '생물정보학융합전공' },
  { id: 'business-intelligence', name: '비즈니스인텔리전스융합전공' },
  { id: 'electronic-information', name: '전자정보 융합전공' },
  { id: 'semiconductor-specialization', name: '반도체 특성화 융합전공' },
  { id: 'spatial-information', name: '공간정보융합전공' },
  { id: 'digital-arts', name: '디지털아트융합전공' },
  { id: 'digital-humanities-social-sciences', name: '디지털인문사회과학융합전공' },
  { id: 'cultural-content-development', name: '문화콘텐츠개발융합전공' },
  { id: 'cognitive-science', name: '인지과학융합전공' },
  { id: 'intellectual-property', name: '지식재산융합전공' },
  { id: 'ai-politics', name: 'AI정치융합전공' },
  { id: 'politics-philosophy-economics', name: '정치-경제-철학(PPE)융합전공' },
  { id: 'northern-culture-trade', name: '북방문화통상융합전공' },
  { id: 'chinese-culture-trade', name: '중국문화와통상융합전공' },
  { id: 'local-synergy', name: '로컬시너지 융합전공' },
  { id: 'welphilia', name: '웰필리아융합전공' },
]

/** 복수 · 연계 · 융합전공을 고른 다전공 형태 */
export const PROGRAM_MULTI_MAJORS = ['double_or_linked_or_convergence', 'interdisciplinary']

export const programName = (id: string | null | undefined) => CONVERGENCE_PROGRAMS.find((p) => p.id === id)?.name
