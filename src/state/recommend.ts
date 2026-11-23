import type { CareerTag, CatalogCourse, Course, EvaluationResponse, GraduationRule, StudentProfile } from '@/api'
import { formatCredits } from '@/components/ui/helpers'
import { STARTUP_CREDITS_ID } from '@/content/substitutions'
import { isStartupCourse } from './courseCategory'
import { isLiberalCurriculum, isMajorCurriculum, offeredByDepartment } from './queries'

/**
 * 과목 추천 — 남은 요건을 채우는 과목만 후보로 고르고, 진로 키워드로 순서를 정한다.
 * (백엔드에 선수과목 · 진로 분류 · 강의계획서 데이터가 없어 과목명 키워드로 나눈다)
 */
/** 백엔드에 진로 태그가 없어 과목명 키워드로만 고르는 진로 */
export type LocalCareer = 'frontend' | 'pm'
/** 백엔드 진로 태그 (CareerTag) + 프론트 전용 진로 + '아직 모르겠어요' */
export type Career = CareerTag | LocalCareer | 'any'

const SERVER_CAREERS: readonly string[] = ['ai_data', 'backend', 'security', 'graduate_study']
/** 백엔드 추천 API에 보낼 수 있는 진로인지 */
export const isServerCareer = (c: Career): c is CareerTag => SERVER_CAREERS.includes(c)

export const CAREERS: { id: Career; label: string; keywords: string[] }[] = [
  {
    id: 'ai_data',
    label: 'AI · 데이터',
    keywords: [
      '인공지능',
      '기계학습',
      '딥러닝',
      '데이터',
      '데이타',
      '자연어',
      '비전',
      '마이닝',
      '병렬',
      '확률',
      '생물정보',
    ],
  },
  {
    id: 'backend',
    label: '백엔드',
    keywords: [
      '데이타베이스',
      '데이터베이스',
      '네트워크',
      '컴퓨터망',
      '데이타통신',
      '클라우드',
      '운영체제',
      '시스템',
      '소프트웨어설계',
      'SW공학',
      '오픈소스',
      '모바일앱',
    ],
  },
  {
    id: 'security',
    label: '보안',
    keywords: [
      '보안',
      '정보보호',
      '암호',
      '네트워크',
      '컴퓨터망',
      '시스템프로그래밍',
      '운영체제',
      '컴파일러',
      '컴퓨터구조',
    ],
  },
  {
    id: 'graduate_study',
    label: '대학원 진학',
    keywords: [
      '알고리즘',
      '수학',
      '확률',
      '컴파일러',
      '프로그래밍언어론',
      '고급문제해결',
      '인공지능',
      '기계학습',
      '그래픽스',
      '이산',
    ],
  },
  {
    id: 'frontend',
    label: '프론트엔드',
    keywords: [
      '웹',
      '모바일',
      '앱',
      '인터페이스',
      'UI',
      'HCI',
      '사용자',
      '그래픽스',
      '멀티미디어',
      '자바스크립트',
      '오픈소스',
      '소프트웨어설계',
    ],
  },
  {
    id: 'pm',
    label: 'PM · 기획',
    keywords: [
      '소프트웨어공학',
      'SW공학',
      '프로젝트',
      '종합설계',
      '창업',
      '경영',
      '기획',
      '마케팅',
      '인간',
      '데이터분석',
      '오픈소스',
    ],
  },
  { id: 'any', label: '아직 모르겠어요', keywords: [] },
]

/** 진로와 맞는 과목인지 — 백엔드 진로 태그가 있으면 그걸, 없으면(프론트 · PM 포함) 과목명 키워드로 */
export function careerMatches(career: Career, name: string, tags?: CareerTag[] | null) {
  if (career === 'any') return false
  if (isServerCareer(career) && tags?.length) return tags.includes(career)
  const keywords = CAREERS.find((c) => c.id === career)?.keywords ?? []
  return keywords.some((k) => name.includes(k))
}

export type Recommendation = {
  course: CatalogCourse
  /** 채우는 요건 (예: 전공 3학점 충족) */
  fills: string[]
  reason: string
  required: boolean
  careerMatch: boolean
}

export type RecommendSummary = {
  /** 예: 전공 3학점 */
  headline: string | null
  items: Recommendation[]
}

/** 지금 학년 (3월 기준) */
export function currentGrade(admissionYear: number, now = new Date()) {
  const year = now.getFullYear() - admissionYear + (now.getMonth() >= 2 ? 1 : 0)
  return Math.max(1, Math.min(4, year))
}

export function recommend(
  profile: StudentProfile,
  rule: GraduationRule,
  e: EvaluationResponse,
  catalog: CatalogCourse[],
  courses: Course[],
  career: Career,
): RecommendSummary {
  // 들었거나 듣는 중인 과목 (동일과목 포함)
  const taken = new Set(courses.filter((c) => c.status !== 'failed').map((c) => c.course_code))
  for (const [code, aliases] of Object.entries(rule.equivalent_courses ?? {})) {
    if (taken.has(code)) aliases.forEach((a) => taken.add(a))
    if (aliases.some((a) => taken.has(a))) taken.add(code)
  }
  const byCode = new Map(catalog.map((c) => [c.course_code, c]))
  const matches = (c: CatalogCourse) => careerMatches(career, c.course_name, c.career_tags)
  const grade = currentGrade(profile.admission_year)

  const req = (area: string) => e.requirements.find((r) => r.credit_area === area)
  const major = req('major')
  const liberal = req('liberal_arts')
  const total = req('total')
  const startup = e.requirements.find((r) => r.id === STARTUP_CREDITS_ID)

  const out = new Map<string, Recommendation>()
  // 필수 선수과목(예: 플솝 ABEEK)을 아직 안 들었으면 추천하지 않는다
  const prerequisitesMet = (c: CatalogCourse) =>
    c.prerequisite_kind !== 'required' || (c.prerequisite_groups ?? []).every((g) => g.some((code) => taken.has(code)))
  const add = (c: CatalogCourse, fill: string, reason: string, required = false) => {
    if (taken.has(c.course_code) || !prerequisitesMet(c)) return
    const prev = out.get(c.course_code)
    if (prev) {
      if (!prev.fills.includes(fill)) prev.fills.push(fill)
      prev.required ||= required
      return
    }
    out.set(c.course_code, { course: c, fills: [fill], reason, required, careerMatch: matches(c) })
  }

  // 1) 아직 안 들은 필수과목 (택1 요건은 아직 미충족일 때만)
  for (const r of e.requirements) {
    if (r.status === 'satisfied' || !r.required_courses?.length) continue
    const missing = r.required_courses.filter((rc) => rc.status === 'missing')
    // 몇 과목 중 택1처럼 고르는 요건이면 남은 개수만큼만 필수로 본다
    const needed = Math.max(0, Math.ceil(r.required - r.current))
    const choice = needed < missing.length
    const label = r.name.replace(/\s*\(.*\)$/, '')
    missing.forEach((rc, i) => {
      const c = byCode.get(rc.course_code) ?? {
        course_code: rc.course_code,
        course_name: rc.course_name,
        credits: 3,
        curriculum_category: '전공',
      }
      add(
        c,
        choice ? `${label} (택${needed || 1})` : label,
        choice
          ? `${r.name} 중 ${needed || 1}과목을 들어야 해요. 아직 하나도 이수하지 않았어요.`
          : `${r.name}에 들어가는 과목이에요. 아직 이수하지 않았어요.`,
        !choice || i < needed,
      )
    })
  }

  // 2) 부족한 학점 영역
  const majorShort = major && major.shortfall > 0 ? major.shortfall : 0
  if (majorShort)
    for (const c of catalog)
      if (offeredByDepartment(c) && isMajorCurriculum(c.curriculum_category))
        add(c, `전공 ${formatCredits(Math.min(c.credits, majorShort))}학점 충족`, '부족한 전공 학점을 채워요.')
  if (liberal && liberal.shortfall > 0)
    for (const c of catalog)
      if (isLiberalCurriculum(c.curriculum_category))
        add(c, `교양 ${formatCredits(c.credits)}학점`, '부족한 교양 학점을 채워요.')
  if (startup && startup.status !== 'satisfied')
    for (const c of catalog) if (isStartupCourse(c.course_code)) add(c, '창업 교과목', '창업 교과목 학점을 채워요.')
  // 졸업학점만 남았으면 전공 과목으로 채운다
  if (!out.size && total && total.shortfall > 0)
    for (const c of catalog)
      if (offeredByDepartment(c) && isMajorCurriculum(c.curriculum_category))
        add(c, `졸업학점 ${formatCredits(c.credits)}학점`, '남은 졸업학점을 채워요.')
  // 남은 요건이 없으면 진로 과목만
  if (!out.size && career !== 'any')
    for (const c of catalog) if (matches(c) && isMajorCurriculum(c.curriculum_category)) add(c, '관심 분야', '')

  const yearOf = (c: CatalogCourse) => Number(c.recommended_year) || grade
  const items = [...out.values()]
    .map((r) => ({ ...r, careerMatch: matches(r.course) }))
    .sort(
      (a, b) =>
        Number(b.required) - Number(a.required) ||
        Number(b.careerMatch) - Number(a.careerMatch) ||
        Math.abs(yearOf(a.course) - grade) - Math.abs(yearOf(b.course) - grade) ||
        a.course.course_name.localeCompare(b.course.course_name),
    )
    .map((r) => ({ ...r, reason: reasonFor(r, career, grade) }))

  const parts: string[] = []
  if (majorShort) parts.push(`전공 ${formatCredits(majorShort)}학점`)
  if (liberal && liberal.shortfall > 0) parts.push(`교양 ${formatCredits(liberal.shortfall)}학점`)
  const missingRequired = items.filter((r) => r.required).length
  if (missingRequired) parts.push(`필수과목 ${missingRequired}개`)
  if (!parts.length && total && total.shortfall > 0) parts.push(`졸업학점 ${formatCredits(total.shortfall)}학점`)
  return { headline: parts.length ? parts.join(' · ') : null, items }
}

function reasonFor(r: Recommendation, career: Career, grade: number) {
  const parts: string[] = []
  if (r.required) parts.push(r.reason)
  const label = CAREERS.find((c) => c.id === career)?.label
  if (r.careerMatch && label) parts.push(`${label} 진로와 관련 있는 과목이에요.`)
  if (!r.required) parts.push(r.reason || '관심 분야 과목이에요.')
  const y = Number(r.course.recommended_year)
  if (y)
    parts.push(
      `교육과정 권장 ${y}학년 ${r.course.recommended_semester ?? ''}학기${y < grade ? ' 과목이라 지금 들어도 좋아요' : ''}.`,
    )
  return parts.join(' ').replace(/\s+\./g, '.')
}
