import type {
  CreditArea,
  CreditEntry,
  EvaluationResponse,
  GraduationRule,
  RequirementResult,
  Source,
  StudentProfile,
} from '@/api'
import { MULTI_MAJOR_LABEL, formatGraduation, reasonText } from '@/constants/labels'
import { formatAmount, formatCredits } from '@/components/ui/helpers'
import { MAJOR_LABEL } from '@/types/student'
import { classifyCategory } from './courseCategory'

export type RequirementGroup = 'credit' | 'course' | 'nonacademic' | 'verification'

export const GROUP_LABEL: Record<RequirementGroup, string> = {
  credit: '학점',
  course: '필수 과목',
  nonacademic: '졸업자격 · 비교과',
  verification: '학부 확인 필요',
}

export const GROUP_ORDER: RequirementGroup[] = ['credit', 'course', 'nonacademic', 'verification']

/** 요건을 정한 곳 — 경북대 전체 규정인지, 컴퓨터학부 졸업요건인지 */
export type RequirementScope = 'university' | 'department'

export const SCOPE_LABEL: Record<RequirementScope, string> = {
  university: '경북대',
  department: '컴퓨터학부',
}

/**
 * 경북대 전체 규정인 요건 (백엔드 common/graduation_qualification.json · policies.json).
 * 졸업자격인정제(실용영어 · 소프트웨어 · 지도교수 상담)와 평점평균. 나머지는 컴퓨터학부 졸업요건.
 */
const UNIVERSITY_REQUIREMENT_IDS = new Set(['practical-english', 'software', 'counseling', 'gpa'])

export function scopeOf(id: string): RequirementScope {
  return UNIVERSITY_REQUIREMENT_IDS.has(id) ? 'university' : 'department'
}

export type RequirementView = {
  id: string
  name: string
  scope: RequirementScope
  group: RequirementGroup
  result: RequirementResult
  /** 학점 · 과목 · 회 등 */
  unit: string
  /** 목록 가운데 칸 (예: 18 / 130학점) */
  valueText: string
  /** 이름 아래 보조 설명 */
  sub: string
  notStarted: boolean
  /** 졸업 학기에만 하면 되는 졸업심사 항목인데 아직 졸업 학기가 아님 — 회색 '진행 전' (미제출 빨강 대신) */
  later: boolean
  details: string[]
  sources: Source[]
}

const TRACK_LABEL: Record<string, string> = {
  multi_major: '다중전공(교직과정 포함) 트랙',
  overseas_dual_degree: '해외복수학위 트랙',
  bs_ms_linked: '학·석사연계 트랙',
}

export function majorTitle(p: StudentProfile) {
  return `${MAJOR_LABEL[p.major].name.replace(/전공$/, '')} ${String(p.admission_year).slice(2)}학번`
}

/** 예: ABEEK 미이수 · 다전공 없음 · 2027년 2월 졸업 예정 */
export function profileSummary(p: StudentProfile, program?: string) {
  const parts: string[] = []
  if (p.track) parts.push(TRACK_LABEL[p.track] ?? p.track)
  if (p.major === 'plsop' && p.abeek != null) parts.push(p.abeek ? 'ABEEK 이수' : 'ABEEK 미이수')
  // 융합전공을 골랐으면 '복수·연계·융합전공' 대신 실제 융합전공 이름을 보여준다
  parts.push(program ?? (p.multi_major && p.multi_major !== 'none' ? MULTI_MAJOR_LABEL[p.multi_major] : '다전공 없음'))
  const grad = formatGraduation(p.expected_graduation_date)
  if (grad) parts.push(`${grad} 졸업 예정`)
  return parts.join(' · ')
}

/** 이번 학기에 졸업하는 학기 (YYYY-02 또는 YYYY-08). 3~8월은 그해 8월, 9~12월은 다음 해 2월, 1~2월은 그해 2월 */
export function currentGraduationTerm(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  if (m >= 3 && m <= 8) return `${y}-08`
  return m >= 9 ? `${y + 1}-02` : `${y}-02`
}

/** 졸업심사(포트폴리오 · 면담 · TOPCIT)처럼 졸업 직전 학기에 하는 항목 */
const isGraduationReview = (id: string) => id.startsWith('review-')

export function buildRequirementViews(
  rule: GraduationRule | undefined,
  evaluation: EvaluationResponse,
  profile?: StudentProfile,
): RequirementView[] {
  // 졸업 예정 학기가 이번 학기가 아니면(또는 아직 모르면) 졸업심사 항목은 나중에 해도 된다
  const graduatingNow = profile?.expected_graduation_date === currentGraduationTerm()
  const groupOf = new Map<string, RequirementGroup>()
  const unitOf = new Map<string, string>()
  const detailsOf = new Map<string, string[]>()
  for (const r of rule?.credit_requirements ?? []) groupOf.set(r.id, 'credit')
  for (const r of rule?.course_requirements ?? []) groupOf.set(r.id, 'course')
  for (const r of rule?.nonacademic_requirements ?? []) {
    groupOf.set(r.id, 'nonacademic')
    if (r.unit) unitOf.set(r.id, r.unit)
    if (r.details?.length) detailsOf.set(r.id, r.details)
  }
  for (const r of rule?.verification_requirements ?? []) groupOf.set(r.id, 'verification')

  return evaluation.requirements.map((result) => {
    const group: RequirementGroup =
      groupOf.get(result.id) ??
      (result.credit_area ? 'credit' : result.required_courses?.length ? 'course' : 'nonacademic')
    const unit =
      group === 'credit'
        ? '학점'
        : group === 'course'
          ? '과목'
          : (unitOf.get(result.id) ?? (/\d+학점/.test(result.name) ? '학점' : ''))
    const details = detailsOf.get(result.id) ?? []

    const later = !!profile && !graduatingNow && isGraduationReview(result.id) && result.status !== 'satisfied'
    let valueText: string
    if (group === 'verification') valueText = '학부 확인 필요'
    else if (later) valueText = '졸업 학기에 진행'
    else if (group === 'nonacademic' && result.required === 1 && !unit)
      valueText = result.status === 'satisfied' ? '확인 완료' : '미제출'
    else valueText = `${formatAmount(result.current, result.id)} / ${formatAmount(result.required, result.id)}${unit}`

    let sub: string
    if (group === 'course' && result.required_courses?.length) {
      const names = result.required_courses.map((c) => c.course_name)
      sub = names.slice(0, 3).join(' · ') + (names.length > 3 ? ` 외 ${names.length - 3}개` : '')
    } else if (later) sub = '졸업 직전 학기에 하면 돼요'
    else if (details.length) sub = details[0]
    else sub = reasonText(result.reason)

    return {
      id: result.id,
      name: result.name,
      scope: scopeOf(result.id),
      group,
      result,
      unit,
      valueText,
      sub,
      notStarted: group !== 'credit' && result.current === 0 && result.status === 'unsatisfied',
      later,
      details,
      sources: result.sources,
    }
  })
}

/** 한 줄 요약 제목 */
export function headline(evaluation: EvaluationResponse, views: RequirementView[]) {
  if (evaluation.eligible)
    return { title: '졸업 요건을 모두 채웠어요', sub: '최종 졸업사정은 학부 사무실에서 확인해요.' }
  const unmet = views.filter((v) => v.result.status === 'unsatisfied')
  const pending = views.filter((v) => v.result.status !== 'unsatisfied' && v.result.status !== 'satisfied')
  const credit = unmet.filter((v) => v.group === 'credit')
  if (unmet.length === 1 && credit.length === 1) {
    const v = credit[0]
    return {
      title: `${v.name.replace(/학점$/, '')} ${formatCredits(v.result.shortfall)}학점만 채우면 돼요`,
      sub: pending.length
        ? `확인이 필요한 항목 ${pending.length}개도 함께 챙겨주세요.`
        : '나머지 요건은 모두 채웠어요.',
    }
  }
  const total = views.find((v) => v.result.credit_area === 'total')
  const title = unmet.length ? `졸업까지 ${unmet.length}개 요건이 남았어요` : '확인이 필요한 항목만 남았어요'
  const parts: string[] = []
  if (total && total.result.shortfall > 0) parts.push(`졸업학점 ${formatCredits(total.result.shortfall)}학점`)
  const others = unmet.filter((v) => v !== total).map((v) => v.name)
  parts.push(...others.slice(0, 2))
  const sub = parts.length
    ? `${parts.join(', ')}${others.length > 2 ? ` 등` : ''}이 남았어요.`
    : `확인이 필요한 항목 ${pending.length}개가 있어요.`
  return { title, sub }
}

/** 학점 영역별로 인정된 과목 · 확인 대기 과목 */
export function entriesForArea(
  area: CreditArea,
  entries: CreditEntry[],
  majorCategories: string[],
): { recognized: CreditEntry[]; pending: CreditEntry[] } {
  // 분류는 성적표 교과구분을 따른다
  const kind = (e: CreditEntry) =>
    majorCategories.includes(e.transcript_category) ? 'major' : classifyCategory(e.transcript_category, e.course_code)
  const inArea = (e: CreditEntry) =>
    area === 'total' ? !!e.counts_toward_total : kind(e) === (area === 'major' ? 'major' : 'liberal')
  // 교과구분을 바꾸면 전공으로 인정될 수 있는 과목 (백엔드 major_approval_required)
  const pending = area === 'major' ? entries.filter((e) => e.major_approval_required && kind(e) !== 'major') : []
  const recognized = entries.filter(
    (e) =>
      !pending.includes(e) &&
      (e.recognized_credits ?? 0) > 0 &&
      !e.reason?.match(/failed|in_progress|incomplete/) &&
      inArea(e),
  )
  return { recognized, pending }
}
