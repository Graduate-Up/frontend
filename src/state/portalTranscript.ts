import type { LiberalSummary } from '@/api/types'

/**
 * 통합정보시스템 → 졸UP 성적 가져오기 (백엔드 북마클릿 규약)
 *
 * 1. 학생이 통합정보시스템 '전체성적' 화면에서 즐겨찾기(북마클릿)를 누른다.
 * 2. 북마클릿이 그 화면의 성적표를 읽고, 졸UP `/account?transcript=1`을 새 창으로 연다.
 * 3. 새 창이 'jolup-transcript-ready'를 보내면, 북마클릿이 읽은 과목을 postMessage로 넘긴다.
 * 4. 졸UP은 받은 과목을 sessionStorage에 잠시 두고 이수 내역 화면에서 미리보기 → 저장한다.
 */

/** 북마클릿을 실행할 수 있는 통합정보시스템 주소 (백엔드 스크립트와 같아야 한다) */
export const PORTAL_ORIGINS = ['https://knuin.knu.ac.kr', 'https://yes.knu.ac.kr']

/** 학생에게 안내할 통합정보시스템 바로가기 */
export const PORTAL_URL = 'https://knuin.knu.ac.kr'

export type PortalCapture = {
  source: 'jolup-visible-transcript'
  /** 북마클릿이 읽은 행 수 */
  scanned: number
  /** 화면에 표시된 '전체성적 N건' */
  expected: number | null
  data: Record<string, string>[]
  /** 성적표의 첨성인 교양 영역별 이수학점 (화면에 요약표가 있을 때만) */
  liberal_summary?: LiberalSummary | null
}

const PENDING_KEY = 'graduate-up.transcript.pending'

export function isPortalCapture(value: unknown): value is PortalCapture {
  const v = value as PortalCapture | null
  return (
    !!v &&
    v.source === 'jolup-visible-transcript' &&
    Array.isArray(v.data) &&
    v.data.length > 0 &&
    v.data.length <= 500
  )
}

export function savePendingCapture(capture: PortalCapture) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(capture))
}

/** 기다리는 가져오기 결과를 꺼낸다 (한 번 꺼내면 지운다) */
export function takePendingCapture(): PortalCapture | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isPortalCapture(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function hasPendingCapture() {
  try {
    return !!sessionStorage.getItem(PENDING_KEY)
  } catch {
    return false
  }
}
