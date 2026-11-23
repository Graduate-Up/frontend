import type { EnglishTestResult } from '@/api/types'
/**
 * 공인영어 성적 환산 기준표 (글솝 졸업요건: 영어, 글로벌역량 공지, 2025-03-31)
 * TOEIC 700 / 800에 해당하는 시험별 점수. 700 기준은 경북대 졸업자격인정 실용영어 기준과 같다.
 */

export type EnglishTestId =
  | 'toeic'
  | 'toeic_speaking'
  | 'toefl_pbt'
  | 'toefl_ibt'
  | 'toefl_cbt'
  | 'teps'
  | 'new_teps'
  | 'teps_speaking'
  | 'opic'
  | 'gtelp'
  | 'ielts'

export const OPIC_LEVELS = ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'] as const

export type EnglishTest = {
  id: EnglishTestId
  label: string
  /** OPIc만 등급 선택 */
  levels?: readonly string[]
  min?: number
  max?: number
  step?: number
  /** TOEIC 700 · 800에 해당하는 점수 (OPIc는 등급 순번) */
  equivalent: { 700: number; 800: number }
  note?: string
}

export const ENGLISH_TESTS: EnglishTest[] = [
  { id: 'toeic', label: 'TOEIC', min: 10, max: 990, step: 5, equivalent: { 700: 700, 800: 800 } },
  { id: 'toeic_speaking', label: 'TOEIC Speaking', min: 0, max: 200, step: 10, equivalent: { 700: 120, 800: 130 } },
  { id: 'toefl_pbt', label: 'TOEFL PBT', min: 310, max: 677, step: 1, equivalent: { 700: 529, 800: 557 } },
  { id: 'toefl_ibt', label: 'TOEFL iBT', min: 0, max: 120, step: 1, equivalent: { 700: 71, 800: 83 } },
  { id: 'toefl_cbt', label: 'TOEFL CBT', min: 0, max: 300, step: 1, equivalent: { 700: 197, 800: 220 } },
  { id: 'teps', label: 'TEPS', min: 0, max: 990, step: 1, equivalent: { 700: 600, 800: 637 } },
  { id: 'new_teps', label: '개정 TEPS', min: 0, max: 600, step: 1, equivalent: { 700: 264, 800: 309 } },
  { id: 'teps_speaking', label: 'TEPS Speaking', min: 0, max: 99, step: 1, equivalent: { 700: 50, 800: 53 } },
  {
    id: 'opic',
    label: 'OPIc',
    levels: OPIC_LEVELS,
    equivalent: { 700: OPIC_LEVELS.indexOf('IM1'), 800: OPIC_LEVELS.indexOf('IM2') },
  },
  {
    id: 'gtelp',
    label: 'G-TELP (Level 2)',
    min: 0,
    max: 100,
    step: 1,
    equivalent: { 700: 65, 800: 73 },
    note: 'Level 2 점수 기준',
  },
  { id: 'ielts', label: 'IELTS', min: 0, max: 9, step: 0.5, equivalent: { 700: 6, 800: 7 } },
]

export const testById = (id: EnglishTestId) => ENGLISH_TESTS.find((t) => t.id === id)!

export type EnglishScore = {
  test: EnglishTestId
  /** OPIc는 등급 순번 */
  score: number
  /** 응시일 YYYY-MM */
  takenAt?: string
}

/** 서버에 저장할 영어 시험 원본 (응시일이 있어야 저장할 수 있다) */
export function toEnglishTestResult(s: EnglishScore | null | undefined): EnglishTestResult | null {
  if (!s?.takenAt) return null
  const t = testById(s.test)
  return { test_type: t.label, raw_score: t.levels ? t.levels[s.score] : s.score, taken_month: s.takenAt }
}

/** 서버에 저장된 영어 시험 원본 → 화면 입력값 */
export function fromEnglishTestResult(r: EnglishTestResult | null | undefined): EnglishScore | null {
  if (!r) return null
  const t = ENGLISH_TESTS.find((x) => x.label === r.test_type)
  if (!t) return null
  const score = t.levels ? t.levels.indexOf(String(r.raw_score)) : Number(r.raw_score)
  if (score < 0 || Number.isNaN(score)) return null
  return { test: t.id, score, takenAt: r.taken_month }
}

export function formatScore(s: EnglishScore) {
  const t = testById(s.test)
  return t.levels ? t.levels[s.score] : String(s.score)
}

/**
 * 판정에 보낼 TOEIC 환산 점수.
 * TOEIC은 점수 그대로, 다른 시험은 기준표에 있는 700 · 800 단계로만 환산한다 (미달이면 0).
 */
export function toeicEquivalent(s: EnglishScore): number {
  const t = testById(s.test)
  if (t.id === 'toeic') return s.score
  if (s.score >= t.equivalent[800]) return 800
  if (s.score >= t.equivalent[700]) return 700
  return 0
}

/** 이 기준(700 · 800)에 맞는 시험 점수 — 안내 문구용 */
export function thresholdText(t: EnglishTest, toeicMinimum: number) {
  const level = toeicMinimum >= 800 ? 800 : 700
  const v = t.equivalent[level]
  return t.levels ? t.levels[v] : String(v)
}

/** 인정 기간 확인: 입학 이후 취득 + 졸업사정 제출 기준 2년 이내 */
export function scoreValidity(
  takenAt: string | undefined,
  admissionYear: number,
  expectedGraduation: string | null | undefined,
): { ok: boolean; message?: string } {
  if (!takenAt) return { ok: true }
  const [y, m] = takenAt.split('-').map(Number)
  if (y < admissionYear || (y === admissionYear && m < 3))
    return { ok: false, message: '입학 전에 취득한 성적은 인정되지 않아요.' }
  if (expectedGraduation) {
    const [gy, gm] = expectedGraduation.split('-').map(Number)
    const months = (gy - y) * 12 + (gm - m)
    if (months > 24)
      return {
        ok: false,
        message: '졸업 예정 시점 기준 2년이 지난 성적이라 인정되지 않을 수 있어요. 다시 응시해야 할 수 있어요.',
      }
  }
  return { ok: true }
}

/** 영어 성적을 입력받는 비교과 요건인지 (예: 학부 영어 요건 (TOEIC 기준)) */
export function isEnglishScoreRequirement(req: { name: string; unit?: string | null }) {
  return req.unit === '점' && /TOEIC|영어/i.test(req.name)
}

/** 공인영어 성적은 학생당 하나 — 요건 id가 아니라 이 키로 저장한다 */
export const OFFICIAL_ENGLISH_KEY = 'official'

/** 경북대 졸업자격인정 실용영어 영역 요건 id (백엔드) */
export const PRACTICAL_ENGLISH_ID = 'practical-english'

export type PracticalMethod = {
  id: string
  label: string
  /** 공인영어 성적으로 자동 판정 */
  auto?: boolean
  /** 이 학생에게 해당하는지 */
  applies?: (p: { admission_year: number; student_status?: string | null }) => boolean
}

/** 실용영어 영역 인정 방법 (경북대 졸업자격인정제 안내) */
export const PRACTICAL_METHODS: PracticalMethod[] = [
  { id: 'official', label: '공인영어시험 TOEIC 700 이상 (모의TOEIC · 타 시험 환산 포함)', auto: true },
  { id: 'credits', label: '실용영어영역 4학점 이수' },
  { id: 'english_major', label: '영어영문학과 · 영어교육과 (복수전공 · 부전공 포함)' },
  { id: 'placement', label: '신입생 실용영어진단평가 700점 이상' },
  { id: 'conversation', label: '언어교육센터 원어민 영어회화과정 120시간 이상' },
  { id: 'abroad', label: '영어권 국가 어학연수 · 해외 인턴십 · 교환학생으로 3학점 이상' },
  {
    id: 'topik',
    label: 'TOPIK 4급 이상 (2022학번~ 외국인 학생, 편입 제외 · 시험일로부터 4년 이내)',
    applies: (p) => p.admission_year >= 2022 && p.student_status === 'foreign',
  },
]
