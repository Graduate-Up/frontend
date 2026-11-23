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
