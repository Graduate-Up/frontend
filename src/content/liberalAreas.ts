import type { Course, EvaluationResponse } from '@/api/types'

/**
 * 교양 영역 직접 지정.
 * 백엔드는 과목코드 → 영역 매핑표(일부 과목만 있음)로 교양 영역을 판정하고,
 * 표에 없으면 성적표 교과구분에 적힌 영역(예: '교양(인문·사회)')을 쓴다.
 * 그래서 학생이 고른 영역을 교과구분에 덧붙여 보낸다.
 */
export const LIBERAL_AREA_GROUPS: { group: string; areas: string[] }[] = [
  { group: '첨성인기초', areas: ['독서와토론', '사고교육', '글쓰기', '외국어', '수리', '기초과학', 'SW'] },
  { group: '첨성인핵심', areas: ['인문·사회', '자연과학'] },
  { group: '첨성인소양 · 그 밖의 교양', areas: ['소양'] },
]

/** 영역 요건(기초 · 핵심)에 들어가지 않는 교양 */
export const NON_AREA = '소양'

export function areaCategory(area: string) {
  return `교양(${area})`
}

/** 교과구분에 적힌 영역 (없으면 null) */
export function areaOf(category: string): string | null {
  const m = category.match(/\(([^)]+)\)/)
  return m ? m[1] : null
}

const UNKNOWN_PREFIX = '영역을 확인하지 못한 교양:'

/** 판정 근거에서 '영역을 확인하지 못한 교양' 과목코드를 뽑는다 */
export function unknownAreaCodes(details: string[] | undefined): string[] {
  const line = (details ?? []).find((d) => d.startsWith(UNKNOWN_PREFIX))
  return line ? [...new Set(line.match(/[A-Z]{4}\d{4}/g) ?? [])] : []
}

/**
 * 학생이 '소양'으로 지정한 과목만 남아서 '확인 필요'가 된 교양 영역 요건은
 * 학점 기준으로 충족 · 미충족을 정한다.
 */
export function resolveLiberalAreas(e: EvaluationResponse, courses: Course[]): EvaluationResponse {
  const nonArea = new Set(courses.filter((c) => areaOf(c.transcript_category) === NON_AREA).map((c) => c.course_code))
  return {
    ...e,
    requirements: e.requirements.map((r) => {
      if (r.status !== 'verification_required') return r
      const unknown = unknownAreaCodes(r.details)
      if (!unknown.length || !unknown.every((code) => nonArea.has(code))) return r
      return {
        ...r,
        status: r.current >= r.required ? 'satisfied' : 'unsatisfied',
        details: (r.details ?? []).filter((d) => !d.startsWith(UNKNOWN_PREFIX)),
      }
    }),
  }
}
