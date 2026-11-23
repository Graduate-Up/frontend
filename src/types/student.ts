import type { MajorCode, StudentProfile as ApiStudentProfile } from '@/api/types'

/** 세부전공 — 백엔드 코드 그대로 사용 */
export type Major = MajorCode

export const MAJOR_LABEL: Record<Major, { name: string; short: string }> = {
  glsop: { name: '글로벌SW융합전공', short: '글솝' },
  plsop: { name: '플랫폼SW&데이터과학전공', short: '플솝' },
  aicom: { name: '인공지능컴퓨팅전공', short: '인컴' }, // 2023학번~
  simcom: { name: '심화컴퓨팅전공', short: '심컴' }, // 2026학번~
  chumcom: { name: '첨단컴퓨팅연구전공', short: '첨컴' }, // 2026학번~
}

/**
 * 화면에서 쓰는 학생 정보.
 * 백엔드에 보내는 학적 조건(`profile`)은 API 타입 그대로 들고 있고,
 * 화면 표시용 값만 따로 둔다.
 */
export type Student = {
  displayName: string
  profile: ApiStudentProfile
}
