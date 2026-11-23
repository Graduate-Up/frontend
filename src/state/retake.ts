import type { Course, GraduationRule } from '@/api'

/** 경북대 4.3 만점 평점 (백엔드 gpa.py 와 같은 기준, F 포함 · P/NP 제외) */
const POINTS: Record<string, number> = {
  'A+': 4.3,
  A0: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B0: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C0: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D0: 1.0,
  'D-': 0.7,
  F: 0,
}

/** 재이수할 수 있는 성적 (B- 이하, B0부터는 재이수 불가) */
const RETAKE_MAX_POINT = POINTS['B-']
/** 재이수 성적 상한 (A-) — 다시 들으면 최대 이 성적까지 받는다 */
const ASSUMED_GRADE = 'A-'

export type RetakeCandidate = {
  code: string
  name: string
  credits: number
  semester: string
  grade: string
  category: string
  required: boolean
  failed: boolean
  /** 직전 학기(계절 포함)에 들은 과목 — 바로 다음 학기엔 재수강할 수 없다 */
  lastTerm: boolean
  /** 상한 성적(A-)을 받으면 오르는 평점 */
  gpaGain: number
}

export type RetakeSummary = {
  gpa: number | null
  /** 추천 과목을 모두 A-로 다시 받으면 */
  gpaIfAll: number | null
  candidates: RetakeCandidate[]
  assumedGrade: string
  /** 직전 학기 (예: 2025-summer) */
  lastSemester: string | null
}

/** 학기 순서 — 1학기 → 여름계절 → 2학기 → 겨울계절 */
const TERM_ORDER: Record<string, number> = { '1': 1, summer: 2, '2': 3, winter: 4 }
const semesterKey = (s: string) => {
  const [year, term] = s.split('-')
  return Number(year) * 10 + (TERM_ORDER[term] ?? 0)
}

/** 같은 과목코드는 마지막 학기 성적만 남긴다 (재이수 = 마지막 성적) */
function latestGraded(courses: Course[]) {
  const byCode = new Map<string, Course>()
  for (const c of courses) {
    if (!c.grade || !(c.grade in POINTS)) continue
    const prev = byCode.get(c.course_code)
    if (!prev || semesterKey(prev.semester) < semesterKey(c.semester)) byCode.set(c.course_code, c)
  }
  return [...byCode.values()]
}

function gpaOf(list: { credits: number; point: number }[]) {
  const credits = list.reduce((n, c) => n + c.credits, 0)
  if (!credits) return null
  return list.reduce((n, c) => n + c.credits * c.point, 0) / credits
}

export function retakeCandidates(courses: Course[], rule: GraduationRule | undefined): RetakeSummary {
  const required = new Set((rule?.course_requirements ?? []).flatMap((r) => r.courses.map((c) => c.course_code)))
  const graded = latestGraded(courses).map((c) => ({ course: c, credits: c.credits, point: POINTS[c.grade!] }))
  const gpa = gpaOf(graded)
  const assumed = POINTS[ASSUMED_GRADE]
  // 가장 최근에 들은 학기(수강 중 포함, 계절 포함) = 다음 수강신청 기준 직전 학기
  const lastSemester = courses.reduce<string | null>(
    (last, c) => (!last || semesterKey(c.semester) > semesterKey(last) ? c.semester : last),
    null,
  )

  const candidates = graded
    .filter((g) => g.point <= RETAKE_MAX_POINT && g.course.status !== 'in_progress')
    .map(({ course: c, point }) => {
      const after = gpaOf(graded.map((g) => (g.course === c ? { ...g, point: assumed } : g)))
      return {
        code: c.course_code,
        name: c.course_name ?? c.course_code,
        credits: c.credits,
        semester: c.semester,
        grade: c.grade!,
        category: c.transcript_category,
        required: required.has(c.course_code),
        failed: point === 0,
        lastTerm: c.semester === lastSemester,
        gpaGain: after != null && gpa != null ? after - gpa : 0,
      }
    })
    // 다음 학기에 바로 들을 수 있는 과목 먼저, 그 안에서 F(학점 0) → 필수과목 → 평점 상승 폭 순
    .sort(
      (a, b) =>
        Number(a.lastTerm) - Number(b.lastTerm) ||
        Number(b.failed) - Number(a.failed) ||
        Number(b.required) - Number(a.required) ||
        b.gpaGain - a.gpaGain,
    )

  const codes = new Set(candidates.map((c) => c.code))
  const gpaIfAll = gpaOf(graded.map((g) => (codes.has(g.course.course_code) ? { ...g, point: assumed } : g)))
  return { gpa, gpaIfAll, candidates, assumedGrade: ASSUMED_GRADE, lastSemester }
}
