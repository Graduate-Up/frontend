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
  /** 근거 요건 기준에서 더 들어야 하는 양 (예: 창업 교과목 9학점 + 추가 6학점) */
  extra: number
  label: string
  /** 대체를 고르는 버튼 문구 */
  action: string
}

export const SUBSTITUTIONS: Substitution[] = [
  {
    majors: ['glsop'],
    target: 'track-startup_activity',
    source: 'track-startup_credits',
    minimum: 15,
    extra: 6,
    label: '창업 교과목 15학점 이수로 대체',
    action: '창업 교과목 15학점으로 대체 (추가 6학점)',
  },
]

export function substitutionFor(major: MajorCode, target: string) {
  return SUBSTITUTIONS.find((s) => s.target === target && s.majors.includes(major))
}

/** 학생이 대체 인정을 고른 요건 — checkMethods[target] 값 */
export const SUBSTITUTE_METHOD = 'substitute'

/** 학생이 대체로 채우기로 고른 요건 id */
export function chosenSubstitutions(checkMethods: Record<string, string>): Set<string> {
  return new Set(SUBSTITUTIONS.filter((s) => checkMethods[s.target] === SUBSTITUTE_METHOD).map((s) => s.target))
}

/** 대체 근거 수치 (직접 입력 · 과목 자동 반영 중 큰 값) */
export function substitutionAmount(s: Substitution, records: NonacademicRecord[]) {
  return Math.max(0, ...records.filter((r) => r.requirement_id === s.source).map((r) => r.amount))
}

/**
 * 대체로 넘긴 요건 id → 적용된 규칙.
 * 고르면 바로 적용한다 — 대상(스타트업 창업활동)은 미해당이 되고, 근거 요건(창업 교과목)이 15학점으로 늘어나 거기서 판정한다.
 */
export function appliedSubstitutions(major: MajorCode, chosen: Set<string>) {
  const applied = new Map<string, Substitution>()
  for (const s of SUBSTITUTIONS) {
    if (s.majors.includes(major) && chosen.has(s.target)) applied.set(s.target, s)
  }
  return applied
}

/** 판정 요청에 대체 인정 기록을 덧붙인다 (학생이 직접 입력한 기록이 있으면 그대로 둔다) */
export function withSubstitutions(
  major: MajorCode,
  records: NonacademicRecord[],
  chosen: Set<string>,
): NonacademicRecord[] {
  const extra: NonacademicRecord[] = []
  for (const target of appliedSubstitutions(major, chosen).keys()) {
    if (!records.some((r) => r.requirement_id === target))
      extra.push({ requirement_id: target, amount: 1, status: 'satisfied' })
  }
  return extra.length ? [...records, ...extra] : records
}

/**
 * 대체로 채우기로 골랐으면 판정 결과를 맞춘다.
 * - 근거 요건(창업 교과목)의 기준을 대체 기준(15학점)으로 올린다
 * - 아직 기준을 못 채운 대체 대상(스타트업 창업활동)에는 진행 상황을 적는다
 */
export function patchSubstitutions(e: EvaluationResponse, major: MajorCode, chosen: Set<string>): EvaluationResponse {
  const subs = SUBSTITUTIONS.filter((s) => s.majors.includes(major) && chosen.has(s.target))
  if (!subs.length) return e
  return {
    ...e,
    requirements: e.requirements.map((r) => {
      const asSource = subs.find((s) => s.source === r.id)
      if (asSource && r.required < asSource.minimum) {
        const required = asSource.minimum
        return {
          ...r,
          name: `${r.name.replace(/\s*\d+학점$/, '')} ${required}학점 (스타트업 창업활동 대체)`,
          required,
          shortfall: Math.max(0, required - r.current),
          status: r.current >= required ? 'satisfied' : r.status === 'satisfied' ? 'unsatisfied' : r.status,
        }
      }
      const asTarget = subs.find((s) => s.target === r.id)
      if (asTarget) {
        // 근거 요건은 이 함수에서 15학점으로 바뀌므로 원래 이름 대신 대체 기준으로 적는다
        const source = e.requirements.find((x) => x.id === asTarget.source)
        return {
          ...r,
          status: 'satisfied',
          not_applicable: true,
          current: r.required,
          shortfall: 0,
          details: [
            `${asTarget.label} — 창업 교과목 ${asTarget.minimum}학점 요건에서 판정해요 (지금 ${source?.current ?? 0}학점)`,
          ],
        }
      }
      return r
    }),
  }
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
