import type { Course, EvaluationResponse, GraduationRule, StudentProfile } from '@/api'
import { formatCredits } from '@/components/ui/helpers'
import { fillGuideFor } from '@/content/fillGuides'
import { guideFor } from '@/content/majorGuides'
import { hiddenCreditChecks } from './hiddenCredits'
import type { RequirementView } from './requirementView'

/**
 * 대시보드 오른쪽 '지금 챙길 것' — 학생 상황에 맞게 부족한 것을 여러 개 고른다.
 * - short: 입력했는데 기준에 못 미침 (영어 점수 부족, ABEEK 덜 채움, 평점 미달 등)
 * - todo: 아직 안 한 일 (상담, 교양 영역, 필수과목, 숨은 학점 신청 등)
 */
export type Alert = {
  id: string
  tone: 'short' | 'todo'
  title: string
  body: string
  to: string
  cta: string
  /** 외부 신청 사이트 */
  href?: string
}

const req = (id: string) => `/requirements/${encodeURIComponent(id)}`
const unsat = (v: RequirementView) => v.result.status !== 'satisfied'
const short = (v: RequirementView) => `${formatCredits(v.result.shortfall)}${v.unit}`

export function buildAlerts({
  profile,
  views,
  rule,
  evaluation,
  courses,
  hasEnglishScore,
}: {
  profile: StudentProfile
  views: RequirementView[]
  rule: GraduationRule | undefined
  evaluation: EvaluationResponse
  courses: Course[]
  hasEnglishScore: boolean
}): Alert[] {
  const out: Alert[] = []
  const byId = (id: string) => views.find((v) => v.id === id)

  // 1) 영어 — 입력했는데 부족 / 인정 기간 밖
  for (const v of views.filter((x) => x.unit === '점' && /영어|TOEIC/i.test(x.name) && unsat(x))) {
    const r = v.result
    if (hasEnglishScore && r.current > 0)
      out.push({
        id: v.id,
        tone: 'short',
        title: `영어 점수가 ${short(v)} 부족해요`,
        body: `입력한 성적이 TOEIC 환산 ${formatCredits(r.current)}점이에요. ${v.name}은 ${formatCredits(r.required)}점 이상이 필요해요.`,
        to: req(v.id),
        cta: '성적 다시 입력',
      })
    else if (hasEnglishScore)
      out.push({
        id: v.id,
        tone: 'short',
        title: '입력한 영어 성적이 인정되지 않아요',
        body: '입학 전에 취득했거나 졸업 시점 기준 2년이 지난 성적이에요. 다시 응시해야 할 수 있어요.',
        to: req(v.id),
        cta: '성적 확인',
      })
  }

  // 2) ABEEK — 영역별 부족 학점을 한 번에
  const abeek = views.filter((v) => v.id.startsWith('abeek-') && unsat(v))
  if (abeek.length)
    out.push({
      id: 'abeek',
      tone: 'short',
      title: `ABEEK ${abeek.length}개 영역을 덜 채웠어요`,
      body: abeek.map((v) => `${v.name.replace(/^ABEEK\s*/, '')} ${short(v)}`).join(' · ') + ' 부족',
      to: req(abeek[0].id),
      cta: '자세히 보기',
    })

  // 3) 평점 미달
  const gpa = byId('gpa')
  if (gpa && gpa.result.status === 'unsatisfied' && gpa.result.current > 0)
    out.push({
      id: 'gpa',
      tone: 'short',
      title: `평점이 기준보다 낮아요`,
      body: `지금 평점 ${gpa.result.current.toFixed(2)}이에요. 졸업하려면 ${gpa.result.required} 이상이 필요해요.`,
      to: req('gpa'),
      cta: '자세히 보기',
    })

  // 4) 필수과목 — 아직 안 들은 과목 (택1을 채운 요건은 빼고)
  for (const v of views.filter((x) => x.group === 'course' && unsat(x))) {
    const missing = (v.result.required_courses ?? []).filter((c) => c.status === 'missing').map((c) => c.course_name)
    if (!missing.length) continue
    out.push({
      id: v.id,
      tone: 'todo',
      title: `${v.name.replace(/\s*\(.*\)$/, '')} ${short(v)} 남았어요`,
      body: `${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? ` 외 ${missing.length - 3}개` : ''}을(를) 아직 안 들었어요.`,
      to: req(v.id),
      cta: '과목 보기',
    })
  }

  // 5) 숨은 학점 — 신청만으로 채울 수 있는 학점
  if (rule) {
    const found = hiddenCreditChecks(rule, evaluation, courses).filter((c) => c.found)
    if (found.length)
      out.push({
        id: 'hidden',
        tone: 'todo',
        title: `신청만으로 채울 수 있는 학점 ${found.length}건`,
        body: found.map((c) => `${c.title}(${c.tag})`).join(' · '),
        to: '/hidden-credits',
        cta: '숨은 학점 보기',
      })
  }

  // 6) 전공별 강조 항목 (예: 첨컴 연구행사)
  const guide = guideFor(profile.major).highlight
  const guided = guide && byId(guide.requirementId)
  if (guide && guided && unsat(guided))
    out.push({
      id: guided.id,
      tone: 'todo',
      title: guide.title,
      body: guide.body,
      to: `${req(guided.id)}#record`,
      cta: guide.cta,
    })

  // 7) 지도교수 상담 · 현장실습 등 쌓아야 하는 비교과
  for (const v of views.filter(
    (x) =>
      x.group === 'nonacademic' &&
      !!x.unit &&
      x.unit !== '점' &&
      unsat(x) &&
      !x.id.startsWith('abeek-') &&
      // 교양 영역은 아래에서 한 줄로 묶는다
      !x.name.startsWith('교양 영역'),
  )) {
    if (out.some((a) => a.id === v.id)) continue
    const r = v.result
    const link = fillGuideFor(v.id, profile.major)?.link
    out.push({
      id: v.id,
      tone: 'todo',
      title: `${v.name.replace(/\s*\d+(학점|회)$/, '')} ${short(v)} 남았어요`,
      body:
        r.current > 0
          ? `지금 ${formatCredits(r.current)} / ${formatCredits(r.required)}${v.unit}이에요.`
          : `졸업까지 ${formatCredits(r.required)}${v.unit}이 필요해요. 학기마다 나눠서 채워두세요.`,
      to: `${req(v.id)}#record`,
      cta: '기록 추가 +',
      href: link?.url,
    })
  }

  // 8) 교양 영역 — 아직 못 채운 영역을 한 번에
  const areas = views.filter((v) => v.name.startsWith('교양 영역') && unsat(v))
  if (areas.length)
    out.push({
      id: 'liberal-areas',
      tone: 'todo',
      title: `교양 영역 ${areas.length}개가 비어 있어요`,
      body: areas.map((v) => v.name.replace(/^교양 영역:\s*/, '')).join(' · '),
      to: req(areas[0].id),
      cta: '자세히 보기',
    })

  // 9) 영어 성적 미입력
  const english = views.find((x) => x.unit === '점' && /영어|TOEIC/i.test(x.name) && unsat(x))
  if (english && !hasEnglishScore)
    out.push({
      id: 'english-empty',
      tone: 'todo',
      title: '영어 성적을 아직 입력하지 않았어요',
      body: `${english.name}은 TOEIC ${formatCredits(english.result.required)}점 이상이 필요해요. 성적이 있으면 입력해두세요.`,
      to: req(english.id),
      cta: '성적 입력',
    })

  return out
}
