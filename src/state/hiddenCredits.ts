import type {
  ClassificationChange,
  Course,
  CreditEntry,
  EvaluationResponse,
  GraduationRule,
  MajorCode,
  Source,
} from '@/api'
import { formatCredits } from '@/components/ui/helpers'
import { classifyCategory } from './courseCategory'
import { entriesForArea } from './requirementView'

/**
 * 숨은 학점 — 다시 듣지 않고 신청만으로 채울 수 있는 학점을 찾는다.
 * 모두 판정 결과(credit_entries · requirements)와 졸업요건 규칙에서 계산한다.
 */
export type HiddenCheck = {
  id: string
  found: boolean
  /** 신청으로 못 살리지만 알아둘 것 (예: FUTR 12학점 초과) */
  info?: boolean
  /** 발견 뱃지 (예: 전공 +3학점) */
  tag: string
  title: string
  /** 오른쪽 위 결과 한 줄 */
  result?: string
  body: string
  /** 발견됐을 때 해당 과목 */
  courses?: { code: string; name: string; credits: number; semester: string; category: string }[]
  steps?: { title: string; sub: string }[]
  sources: Source[]
  action?: { label: string; to?: string; href?: string }
}

/** 교과구분 변경 신청 정보 (백엔드 graduation_schedule.classification_change) */
type ChangeInfo = { change: ClassificationChange; major: MajorCode }

const codeOf = (info?: ChangeInfo) =>
  info ? (info.change.major_department_codes[info.major] ?? info.change.department_code) : null

/** 교과구분 변경 신청 3단계 — 신청학과 코드 · 서식은 백엔드 값 */
function changeSteps(info: ChangeInfo | undefined, from: string) {
  const code = codeOf(info)
  return [
    {
      title: '교과구분 변경 신청서 작성',
      sub: code ? `신청학과 코드 ${code} · ${from}` : `${from} · 신청학과 코드 확인 필요`,
    },
    { title: '학부 사무실 제출', sub: '성적표에 성적이 오른 뒤 졸업 전까지 상시 신청' },
    { title: '성적표 반영 확인', sub: '반영되면 이수 내역에서 교과구분만 바꿔주세요' },
  ]
}

const formAction = (info?: ChangeInfo) => (info ? { label: '신청서 서식 받기', href: info.change.form_url } : undefined)

const changeSources = (info: ChangeInfo | undefined, fallback: Source[]) =>
  info ? [...(info.change.major_sources[info.major] ?? []), ...info.change.sources] : fallback

const entryCourse = (e: CreditEntry, credits = e.recognized_credits ?? 0) => ({
  code: e.course_code,
  name: e.course_name ?? e.course_code,
  credits,
  semester: e.semester,
  category: e.transcript_category,
})

const sum = (list: { credits: number }[]) => list.reduce((n, c) => n + c.credits, 0)

/** 교과구분 오분류 — 학부 개설 과목이 일반선택 등으로 잡혀 전공에 안 들어간 경우 */
function misclassified(rule: GraduationRule, e: EvaluationResponse, info?: ChangeInfo): HiddenCheck {
  const { pending } = entriesForArea('major', e.credit_entries, rule.major_transcript_categories ?? [])
  const courses = pending.map((x) => entryCourse(x))
  const credits = sum(courses)
  const major = e.requirements.find((r) => r.credit_area === 'major')
  const sources = rule.credit_requirements.find((r) => r.area === 'major')?.sources ?? []
  if (!courses.length)
    return {
      id: 'misclassified',
      found: false,
      tag: '',
      title: '교과구분 오분류',
      body: '학부 개설 과목이 일반선택 등으로 잘못 잡힌 경우가 없어요.',
      sources,
    }
  const after = major ? major.current + credits : null
  return {
    id: 'misclassified',
    found: true,
    tag: `전공 +${formatCredits(credits)}학점`,
    title: '교과구분 오분류',
    result:
      major && after != null
        ? `승인되면 전공 ${formatCredits(major.current)} → ${formatCredits(after)}학점 · ${after >= major.required ? '충족' : `${formatCredits(major.required - after)}학점 부족`}`
        : undefined,
    body: `학부 개설 과목 ${courses.map((c) => `${c.name}(${formatCredits(c.credits)}학점)`).join(', ')}이 ${[
      ...new Set(courses.map((c) => c.category)),
    ].join(' · ')}(으)로 잡혀 있어요. 전공으로 바꾸면 전공 학점에 들어가요. 총 이수 학점은 그대로예요.`,
    courses,
    steps: changeSteps(info, '일반선택 → 전공'),
    sources: changeSources(info, sources),
    action: formAction(info),
  }
}

/** 졸업자격인정제 소프트웨어 영역 — 학부 대체 과목을 이미 들었는데 아직 미충족인 경우 */
function softwareSubstitute(rule: GraduationRule, e: EvaluationResponse, courses: Course[]): HiddenCheck {
  const req = rule.nonacademic_requirements.find((r) => r.id === 'software')
  const result = e.requirements.find((r) => r.id === 'software')
  const codes = (req?.details ?? []).flatMap((d) => (d.includes('대체 과목') ? (d.match(/[A-Z]{4}\d{4}/g) ?? []) : []))
  const taken = courses.filter((c) => c.status === 'completed' && codes.includes(c.course_code))
  const base = { id: 'software', title: '졸업자격인정제 소프트웨어 영역', sources: req?.sources ?? [] }
  if (!req || !result) return { ...base, found: false, tag: '', body: '이 학번 · 전공에는 해당하지 않아요.' }
  if (result.status === 'satisfied') return { ...base, found: false, tag: '', body: '이미 충족했어요.' }
  if (!taken.length)
    return {
      ...base,
      found: false,
      tag: '',
      body: `대체 과목(${codes.join(' · ')}) 중 이수한 과목이 아직 없어요.`,
    }
  return {
    ...base,
    found: true,
    tag: '신청 가능',
    result: '대체과목으로 신청 가능',
    body: `${taken.map((c) => c.course_name ?? c.course_code).join(' · ')}을(를) 이미 이수했어요. 별도 시험 없이 대체과목으로 신청할 수 있어요. 신청한 뒤 졸업요건에서 충족으로 표시해주세요.`,
    courses: taken.map((c) => ({
      code: c.course_code,
      name: c.course_name ?? c.course_code,
      credits: c.credits,
      semester: c.semester,
      category: c.transcript_category,
    })),
    action: { label: '충족 표시하러 가기', to: '/requirements/software' },
  }
}

/** 필수과목이 다전공(복수 · 부전공 등) 교과구분으로 잡힌 경우 */
function requiredAsMultiMajor(rule: GraduationRule, courses: Course[], info?: ChangeInfo): HiddenCheck {
  const required = new Set(rule.course_requirements.flatMap((r) => r.courses.map((c) => c.course_code)))
  const hits = courses.filter(
    (c) =>
      c.status === 'completed' &&
      required.has(c.course_code) &&
      classifyCategory(c.transcript_category, c.course_code) === 'multi',
  )
  const base = {
    id: 'required-multi',
    title: '필수과목 다전공 분류',
    sources: rule.course_requirements[0]?.sources ?? [],
  }
  if (!hits.length) return { ...base, found: false, tag: '', body: '필수과목이 다전공 학점으로 잡힌 경우가 없어요.' }
  return {
    ...base,
    found: true,
    tag: `필수 ${hits.length}과목`,
    result: '전공으로 바꾸면 필수과목 인정',
    body: `${hits.map((c) => c.course_name ?? c.course_code).join(' · ')}이(가) 다전공 교과구분으로 잡혀 있어요. 내 전공 필수과목으로 인정받으려면 교과구분 변경을 신청해야 해요.`,
    courses: hits.map((c) => ({
      code: c.course_code,
      name: c.course_name ?? c.course_code,
      credits: c.credits,
      semester: c.semester,
      category: c.transcript_category,
    })),
    steps: changeSteps(info, '다전공 → 전공'),
    sources: changeSources(info, base.sources),
    action: formAction(info),
  }
}

const capLabel = (c: { code_prefix?: string | null; category?: string | null; maximum: number }) =>
  c.code_prefix
    ? `${c.code_prefix} 과목 ${formatCredits(c.maximum)}학점`
    : c.category === 'liberal_arts'
      ? `교양 ${formatCredits(c.maximum)}학점`
      : `${formatCredits(c.maximum)}학점`

/**
 * 상한 초과 — 졸업학점에 안 들어간 학점.
 * 교양 초과분은 일반선택 전환 신청으로 살릴 수 있고(발견),
 * FUTR처럼 과목코드로 묶인 상한은 신청으로 못 살려서 참고로만 보여준다.
 */
function overCaps(rule: GraduationRule, e: EvaluationResponse): HiddenCheck[] {
  const caps = rule.credit_caps ?? []
  const over = e.credit_entries.filter((x) => x.reason === 'credit_cap' && (x.excluded_credits ?? 0) > 0)
  const sources = rule.sources.slice(0, 1)
  if (!caps.length) return []
  return caps.map((cap, i) => {
    const hits = over.filter((x) =>
      cap.code_prefix
        ? x.course_code.startsWith(cap.code_prefix)
        : !caps.some((c) => c.code_prefix && x.course_code.startsWith(c.code_prefix)),
    )
    const base = { id: `over-cap-${i}`, title: `${capLabel(cap)} 초과`, sources }
    if (!hits.length)
      return { ...base, found: false, tag: '', body: `상한 이내예요. 넘으면 초과분은 졸업학점에 안 들어가요.` }
    const courses = hits.map((x) => entryCourse(x, x.excluded_credits ?? 0))
    const credits = formatCredits(sum(courses))
    if (cap.code_prefix)
      return {
        ...base,
        found: false,
        info: true,
        tag: '',
        body: `${credits}학점이 졸업학점에서 빠졌어요. ${capLabel(cap)}까지만 인정돼서 신청으로 살릴 수 없어요. 더 들어도 졸업학점은 늘지 않아요.`,
        courses,
      }
    return {
      ...base,
      found: true,
      tag: `${credits}학점 제외됨`,
      result: '일반선택 전환 신청으로 살릴 수 있어요',
      body: `상한을 넘은 ${credits}학점이 졸업학점에서 빠졌어요. 초과한 과목을 일반선택으로 바꾸면 졸업학점에 들어갈 수 있어요.`,
      courses,
      steps: [
        { title: '일반선택 전환 신청', sub: '신청 기간 확인 필요' },
        { title: '학부 사무실 제출', sub: '전환할 과목 지정' },
        { title: '성적표 반영 확인', sub: '반영되면 이수 내역에서 교과구분만 바꿔주세요' },
      ],
    }
  })
}

export function hiddenCreditChecks(
  rule: GraduationRule,
  evaluation: EvaluationResponse,
  courses: Course[],
  /** 교과구분 변경 신청 정보가 있으면 신청학과 코드 · 서식을 채운다 */
  info?: ChangeInfo,
): HiddenCheck[] {
  return [
    misclassified(rule, evaluation, info),
    softwareSubstitute(rule, evaluation, courses),
    requiredAsMultiMajor(rule, courses, info),
    ...overCaps(rule, evaluation),
  ]
}
