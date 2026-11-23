import type { EvaluationResponse, GraduationRule, MajorCode, Source } from '@/api/types'

/** 공지 제목에서 전공을 알아보는 단어 */
const MAJOR_KEYWORDS: Record<MajorCode, string[]> = {
  glsop: ['글솝', '글로벌SW', '글로벌소프트웨어'],
  // ABEEK(공학교육인증)은 플솝에만 있어서 ABEEK 공지는 플솝 공지로 본다
  plsop: ['플솝', '플랫폼SW', '플랫폼소프트웨어', 'ABEEK'],
  aicom: ['인컴', '인공지능컴퓨팅'],
  simcom: ['심컴', '심화컴퓨팅'],
  chumcom: ['첨컴', '첨단컴퓨팅'],
}

const mentions = (title: string, major: MajorCode) => MAJOR_KEYWORDS[major].some((k) => title.includes(k))

/**
 * 다른 전공 공지인지.
 * 백엔드 규칙 묶음은 내 전공 공지에 기준이 없을 때 다른 전공 공지를 참고해 추정한 항목이 있어서,
 * 화면에서는 내 전공 공지와 나눠 보여준다. 여러 전공을 함께 다룬 공지(예: 글솝/인컴)는 내 공지로 본다.
 */
export function isOtherMajorSource(source: Source, major: MajorCode) {
  if (mentions(source.title, major)) return false
  return (Object.keys(MAJOR_KEYWORDS) as MajorCode[]).some((m) => m !== major && mentions(source.title, m))
}

/** 내 전공 · 공통 공지를 앞으로 */
export function sortSourcesForMajor(sources: Source[], major: MajorCode) {
  return [...sources].sort((a, b) => Number(isOtherMajorSource(a, major)) - Number(isOtherMajorSource(b, major)))
}

const own = (sources: Source[] | undefined, major: MajorCode) =>
  (sources ?? []).filter((s) => !isOtherMajorSource(s, major))

/**
 * 다른 전공 공지는 근거로 보여주지 않는다.
 * (백엔드 규칙 묶음이 일부 공통 항목에 다른 전공 공지를 근거로 붙여 보낸다 — 백엔드 수정 필요)
 */
export function stripOtherMajorSources(rule: GraduationRule, major: MajorCode): GraduationRule {
  return {
    ...rule,
    sources: own(rule.sources, major),
    credit_requirements: rule.credit_requirements.map((r) => ({ ...r, sources: own(r.sources, major) })),
    course_requirements: rule.course_requirements.map((r) => ({ ...r, sources: own(r.sources, major) })),
    nonacademic_requirements: rule.nonacademic_requirements.map((r) => ({ ...r, sources: own(r.sources, major) })),
    verification_requirements: rule.verification_requirements?.map((r) => ({ ...r, sources: own(r.sources, major) })),
  }
}

export function stripOtherMajorSourcesFromEvaluation(e: EvaluationResponse, major: MajorCode): EvaluationResponse {
  return { ...e, requirements: e.requirements.map((r) => ({ ...r, sources: own(r.sources, major) })) }
}
