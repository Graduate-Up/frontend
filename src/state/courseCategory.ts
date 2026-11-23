import type { CreditArea, CreditCategory, CreditEntry, EvaluationResponse } from '@/api/types'

/**
 * 성적표 교과구분으로 과목을 분류한다.
 * (백엔드의 '인정 영역 확인 필요'를 쓰지 않고, 학생이 받은 교과구분을 그대로 따른다)
 */
export type CourseKind = 'major' | 'liberal' | 'general' | 'startup' | 'multi' | 'other'

export const KIND_LABEL: Record<CourseKind, string> = {
  major: '전공',
  liberal: '교양',
  general: '일반선택',
  startup: '창업',
  multi: '다전공',
  other: '기타',
}

/** 다전공 계열 교과구분 — 내 전공과 따로 표기한다 */
export const MULTI_MAJOR_CATEGORIES = ['복수전공', '부전공', '연계전공', '융합전공', '다중전공', '교직']

/** FUTR(KNU미래설계)로 시작하는 과목은 창업으로 분류 */
export const STARTUP_PREFIX = 'FUTR'

/**
 * 교육과정표에 '창업' 표시가 있는 전공 · 교양 과목 (글솝 2023학년도 교육과정).
 * 교과구분(전공 · 교양)은 그대로 두고 창업 교과목 학점에만 더한다.
 */
export const STARTUP_TAGGED = new Set(['CLTR0089', 'GLSO0223', 'ITEC0403', 'COMP0428', 'GLSO0229'])

export function isStartupCourse(code: string | null | undefined) {
  const c = (code ?? '').toUpperCase()
  return c.startsWith(STARTUP_PREFIX) || STARTUP_TAGGED.has(c)
}

export function classifyCategory(category: string | null | undefined, code?: string | null): CourseKind {
  if ((code ?? '').toUpperCase().startsWith(STARTUP_PREFIX)) return 'startup'
  const c = (category ?? '').replace(/\s/g, '')
  if (!c) return 'other'
  if (/(복수|부|연계|융합|다중)전공|교직/.test(c)) return 'multi'
  if (c.startsWith('전공')) return 'major'
  if (c.startsWith('교양')) return 'liberal'
  if (c.startsWith('일반')) return 'general'
  return 'other'
}

export const KIND_ORDER: CourseKind[] = ['major', 'liberal', 'general', 'startup', 'multi', 'other']


const PENDING_CREDIT_REASON = 'Credit classification or approval is pending'
const NOT_COUNTED = new Set(['failed', 'in_progress', 'incomplete', 'duplicate_course'])

const KIND_TO_CATEGORY: Record<CourseKind, CreditCategory> = {
  major: 'major',
  liberal: 'liberal_arts',
  general: 'general',
  startup: 'general',
  multi: 'general',
  other: 'general',
}

/**
 * 백엔드가 '인정 영역 확인 필요'로 보류한 과목을 성적표 교과구분대로 분류하고,
 * 그 때문에 '확인 필요'가 된 학점 요건(총 · 전공 · 교양)을 다시 계산한다.
 */
export function classifyByTranscript(e: EvaluationResponse): EvaluationResponse {
  const entries: CreditEntry[] = e.credit_entries.map((entry) => {
    const kind = classifyCategory(entry.transcript_category, entry.course_code)
    // 백엔드 규칙에 없는 다전공 교과구분(예: 부전공)은 학점에서 빠지는데, 교과구분대로 졸업학점에 넣는다
    if (kind === 'multi' && !NOT_COUNTED.has(entry.reason ?? '') && !entry.counts_toward_total && entry.excluded_credits) {
      return {
        ...entry,
        recognized_category: 'general' as const,
        recognized_credits: (entry.recognized_credits ?? 0) + entry.excluded_credits,
        excluded_credits: 0,
        counts_toward_total: true,
        reason: null,
      }
    }
    return entry.reason === 'verification_required'
      ? { ...entry, recognized_category: KIND_TO_CATEGORY[kind], reason: null }
      : entry
  })
  const changedTotal = entries.some((x, i) => x !== e.credit_entries[i] && x.counts_toward_total && !e.credit_entries[i].counts_toward_total)
  const counted = entries.filter(
    (x) => !NOT_COUNTED.has(x.reason ?? '') && ((x.recognized_credits ?? 0) > 0 || x.counts_toward_total),
  )
  const sum = (list: CreditEntry[]) => list.reduce((n, x) => n + (x.recognized_credits ?? 0), 0)
  const current: Record<CreditArea, number> = {
    total: sum(counted.filter((x) => x.counts_toward_total)),
    major: sum(counted.filter((x) => classifyCategory(x.transcript_category) === 'major')),
    liberal_arts: sum(counted.filter((x) => classifyCategory(x.transcript_category) === 'liberal')),
  }
  const requirements = e.requirements.map((r) => {
    const pending = r.reason === PENDING_CREDIT_REASON
    if (!r.credit_area || (!pending && !(changedTotal && r.credit_area === 'total'))) return r
    const now = current[r.credit_area]
    const shortfall = Math.max(0, r.required - now)
    return {
      ...r,
      current: now,
      shortfall,
      status: shortfall > 0 ? ('unsatisfied' as const) : ('satisfied' as const),
      reason: 'Calculated from transcript categories',
    }
  })
  return { ...e, credit_entries: entries, requirements }
}
