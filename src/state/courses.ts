import type { Course, Grade } from '@/api'

/** 백엔드 학기 표기: 2024-1, 2024-summer, 2024-2, 2024-winter */
export const SEMESTER_PATTERN = /^\d{4}-(1|2|summer|winter)$/

const SEASON_ALIASES: Record<string, string> = {
  s: 'summer',
  summer: 'summer',
  여름: 'summer',
  하계: 'summer',
  w: 'winter',
  winter: 'winter',
  겨울: 'winter',
  동계: 'winter',
}

/** 2024-S, 2024-여름 같은 입력을 백엔드 표기로 바꾼다 */
export function normalizeSemester(value: string): string {
  const v = value.trim()
  const m = v.match(/^(\d{4})\s*[-.\s]\s*(.+)$/)
  if (!m) return v
  const term = m[2].replace(/학기$/, '').toLowerCase()
  if (term === '1' || term === '2') return `${m[1]}-${term}`
  return SEASON_ALIASES[term] ? `${m[1]}-${SEASON_ALIASES[term]}` : v
}

const TERM_LABEL: Record<string, string> = { '1': '1학기', '2': '2학기', summer: '여름', winter: '겨울' }

/** 2024-summer → 2024 여름 */
export function semesterLabel(semester: string) {
  const [y, t] = semester.split('-')
  return TERM_LABEL[t] ? `${y} ${TERM_LABEL[t]}` : semester
}

export function normalizeCourses(courses: Course[]): Course[] {
  return courses.map((c) => {
    const semester = normalizeSemester(c.semester)
    return semester === c.semester ? c : { ...c, semester }
  })
}

export const GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'P', 'NP']

const GRADE_ALIASES: Record<string, Grade> = { A: 'A0', B: 'B0', C: 'C0', D: 'D0', S: 'P', PASS: 'P', U: 'NP', FAIL: 'NP' }

/** 성적 표기를 백엔드 등급으로 (모르는 값이면 null) */
export function normalizeGrade(value: string | null | undefined): Grade | null {
  if (!value) return null
  const v = value.trim().toUpperCase().replace(/\s/g, '')
  if ((GRADES as string[]).includes(v)) return v as Grade
  return GRADE_ALIASES[v] ?? null
}
