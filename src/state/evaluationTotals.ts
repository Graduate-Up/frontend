import type { EvaluationResponse, GraduationRule, JudgementStatus, RequirementCounts, RequirementResult } from '@/api/types'

/**
 * 백엔드 '학부 확인 필요'(verification_requirements) 항목은 규칙 데이터가 비어 있다는 내부 메모라
 * (교육과정표 차이 · 교양 영역 매핑표 · 현장실습 적용 범위 등) 학생 화면에서는 뺀다.
 */
const VERIFICATION_REASON = 'Additional evidence or interpretation is needed to automate this requirement'

const isVerificationItem = (r: RequirementResult) => r.reason === VERIFICATION_REASON

export function stripVerificationRequirements(rule: GraduationRule): GraduationRule {
  return rule.verification_requirements?.length ? { ...rule, verification_requirements: [] } : rule
}

/** 백엔드 evaluator와 같은 방식 (충족 1, 학점 · 과목은 부분 반영, 평점은 0/1) */
function fraction(r: RequirementResult) {
  if (r.status === 'satisfied') return 1
  if (r.id === 'gpa' || !r.required) return 0
  return Math.min(1, r.current / r.required)
}

/**
 * 학부 확인 항목을 빼고, 프론트에서 바꾼 판정(대체 인정 · 종합설계 · 교양 영역)까지 반영해
 * 전체 상태 · 졸업 가능 여부 · 진행률 · 개수를 다시 계산한다.
 */
export function finalizeEvaluation(e: EvaluationResponse): EvaluationResponse {
  const requirements = e.requirements.filter((r) => !isVerificationItem(r))
  const counts: RequirementCounts = {}
  for (const r of requirements) counts[r.status] = (counts[r.status] ?? 0) + 1
  const order: JudgementStatus[] = ['verification_required', 'approval_required', 'unsatisfied']
  const status = order.find((s) => counts[s]) ?? 'satisfied'
  const progress = !requirements.length
    ? 0
    : status === 'satisfied'
      ? 100
      : Math.min(99, Math.round((1000 * requirements.reduce((n, r) => n + fraction(r), 0)) / requirements.length) / 10)
  return { ...e, requirements, status, eligible: status === 'satisfied', progress, requirement_counts: counts }
}
