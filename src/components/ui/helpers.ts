import { ApiError } from '@/api'

export { default as ui } from './ui.module.css'

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return '이 학번·전공 조합의 졸업요건이 아직 없어요.'
    if (error.status === 503) {
      const code = (error.body as { code?: string } | null)?.code
      return code === 'invalid_rule_data'
        ? '졸업요건 데이터에 문제가 있어요. 백엔드 담당자에게 알려주세요.'
        : '이 학번·전공 조합의 졸업요건 데이터가 아직 없어요.'
    }
    return error.message
  }
  if (error instanceof TypeError) return '서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해주세요.'
  return error instanceof Error ? error.message : '알 수 없는 오류가 났어요.'
}

export function formatCredits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** 요건 값 — 평점평균은 성적표처럼 소수 둘째 자리(3.85), 나머지는 학점 · 과목 수 */
export function formatAmount(n: number, requirementId: string) {
  return requirementId === 'gpa' ? n.toFixed(2) : formatCredits(n)
}

/** 요건을 이미 채웠는데 아직 안 들은 과목 (예: 종합설계 4과목 중 택1을 채운 뒤 나머지) */
export const isNotNeeded = (requirementStatus: string, courseStatus: string) =>
  requirementStatus === 'satisfied' && courseStatus === 'missing'
