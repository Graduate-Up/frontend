import type { Course, EvaluationResponse, MajorCode, NonacademicRecord } from '@/api/types'
import { isStartupCourse } from '@/state/courseCategory'

/**
 * 백엔드 규칙 묶음에 아직 없는 대체 인정 규칙.
 * 백엔드에 들어가면 여기서 지운다.
 */
export type Substitution = {
  majors: MajorCode[]
  /** 대체로 채워지는 요건 id */
  target: string
  /** 대체 근거가 되는 요건 id와 필요한 수치 */
  source: string
  minimum: number
  label: string
}

export const SUBSTITUTIONS: Substitution[] = [
  {
    majors: ['glsop'],
    target: 'track-startup_activity',
    source: 'track-startup_credits',
    minimum: 15,
    label: '창업 교과목 15학점 이수로 대체',
  },
]

export function substitutionFor(major: MajorCode, target: string) {
  return SUBSTITUTIONS.find((s) => s.target === target && s.majors.includes(major))
}

/** 대체 조건을 채운 요건 id → 적용된 규칙 */
export function appliedSubstitutions(major: MajorCode, records: NonacademicRecord[]) {
  const applied = new Map<string, Substitution>()
  for (const s of SUBSTITUTIONS) {
    if (!s.majors.includes(major)) continue
    // 직접 입력 · 과목 자동 반영 중 큰 값
    const amount = Math.max(0, ...records.filter((r) => r.requirement_id === s.source).map((r) => r.amount))
    if (amount >= s.minimum) applied.set(s.target, s)
  }
  return applied
}

/** 판정 요청에 대체 인정 기록을 덧붙인다 (학생이 직접 입력한 기록이 있으면 그대로 둔다) */
export function withSubstitutions(major: MajorCode, records: NonacademicRecord[]): NonacademicRecord[] {
  const extra: NonacademicRecord[] = []
  for (const target of appliedSubstitutions(major, records).keys()) {
    if (!records.some((r) => r.requirement_id === target))
      extra.push({ requirement_id: target, amount: 1, status: 'satisfied' })
  }
  return extra.length ? [...records, ...extra] : records
}

/** 백엔드 현장실습 요건 id (비교과 체크 항목) */
export const FIELD_PRACTICE_ID = 'field-practice'

/**
 * 이수 과목 중 현장실습 과목 — 과목명에 현장실습 · 인턴십이 있거나 교과구분이 현장실습.
 * (예: 해외인턴십5 OVIN0213은 성적표 교과구분이 '일반선택'으로 와서 이름으로 알아본다)
 * 창업현장실습(STUP0311)은 별도 승인이 필요해 자동으로 넣지 않는다.
 */
export function fieldPracticeCourses(courses: Course[]): Course[] {
  return courses.filter(
    (c) =>
      c.status === 'completed' &&
      c.course_code !== 'STUP0311' &&
      (/현장실습|인턴십/.test(c.course_name ?? '') || c.transcript_category.includes('현장실습')),
  )
}

/** 백엔드 창업 교과목 학점 요건 id (글솝 트랙) */
export const STARTUP_CREDITS_ID = 'track-startup_credits'

/** 이수 과목 중 창업 교과목 — FUTR 과목 + 교육과정에 창업 표시가 있는 과목 */
export function startupCourses(courses: Course[]): Course[] {
  return courses.filter((c) => c.status === 'completed' && isStartupCourse(c.course_code))
}

const sumCredits = (list: Course[]) => list.reduce((n, c) => n + c.credits, 0)

/**
 * 이수 과목으로 채워지는 비교과 기록을 더한다 (백엔드는 기록 중 가장 큰 값을 쓴다)
 * - 현장실습: 현장실습 · 인턴십 과목 학점
 * - 창업 교과목: 창업 과목 학점
 */
export function withCourseRecords(courses: Course[], records: NonacademicRecord[]): NonacademicRecord[] {
  const derived: NonacademicRecord[] = [
    { requirement_id: FIELD_PRACTICE_ID, amount: sumCredits(fieldPracticeCourses(courses)), status: 'satisfied' },
    { requirement_id: STARTUP_CREDITS_ID, amount: sumCredits(startupCourses(courses)), status: 'satisfied' },
  ]
  const extra = derived.filter((d) => d.amount > 0)
  return extra.length ? [...records, ...extra] : records
}

/**
 * 창업 교과목 학점 보정.
 * 백엔드는 '창업교과목' 인정목록 과목만 세서 FUTR0208 같은 FUTR 과목이 빠진다.
 * 학부 기준으로 FUTR 과목은 모두 창업 교과목이라, 프론트 계산이 더 크면 그 값으로 판정한다.
 */
export function patchStartupCredits(e: EvaluationResponse, courses: Course[]): EvaluationResponse {
  const list = startupCourses(courses)
  const credits = sumCredits(list)
  return {
    ...e,
    requirements: e.requirements.map((r) => {
      if (r.id !== STARTUP_CREDITS_ID || credits <= r.current) return r
      const satisfied = credits >= r.required
      return {
        ...r,
        current: credits,
        shortfall: Math.max(0, r.required - credits),
        status: satisfied ? 'satisfied' : r.status === 'satisfied' ? 'unsatisfied' : r.status,
        details: [
          `인정: ${list.map((c) => `${c.course_code} ${c.course_name ?? ''} ${c.credits}학점`.replace(/\s+/g, ' ')).join(', ')}`,
        ],
      }
    }),
  }
}
