import { createContext, useContext } from 'react'
import type {
  AccountResponse,
  Course,
  EnglishTestResult,
  LiberalSummary,
  NonacademicRecord,
  StudentProfile,
} from '@/api'
import type { EnglishScore } from '@/content/englishTests'

/**
 * - loading: 토큰으로 내 정보 불러오는 중
 * - anonymous: 로그인 안 함 → /login
 * - guest: 로그인 없이 둘러보기 (프로필·과목은 이 브라우저에만 저장)
 * - account: 로그인 (프로필은 백엔드에 저장)
 */
export type SessionKind = 'loading' | 'anonymous' | 'guest' | 'account'

/** 로그인 상태에서 이수 기록 서버 저장 상태 (둘러보기는 idle) */
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

export type StudentContextValue = {
  kind: SessionKind
  account: AccountResponse | null
  profile: StudentProfile | null
  studentNumber: string | null
  displayName: string
  /** 이수 과목 — 로그인하면 서버(/me/records)에, 둘러보기는 이 브라우저에 저장 */
  courses: Course[]
  setCourses: (updater: Course[] | ((prev: Course[]) => Course[])) => void
  /** 비교과 기록 (영어 점수, 상담 횟수 등) — 저장 위치는 과목과 같다 */
  records: NonacademicRecord[]
  /** englishTest: 영어 요건이면 시험 원본도 함께 서버에 저장 */
  setRecord: (requirementId: string, amount: number | null, englishTest?: EnglishTestResult | null) => void
  /** 성적표에서 읽은 교양 영역 요약 (서버에 저장된 값) */
  liberalSummary: LiberalSummary | null
  /** 성적표에서 읽은 교양 영역 요약을 서버에 저장 */
  setLiberalSummary: (summary: LiberalSummary) => void
  /** 영어 요건별로 입력한 시험 · 점수 원본 (판정에는 TOEIC 환산값이 records로 간다) */
  englishScores: Record<string, EnglishScore>
  setEnglishScore: (requirementId: string, score: EnglishScore | null) => void
  syncStatus: SyncStatus
  /** 체크 항목을 어떤 방법으로 채웠는지 (예: 실용영어 → 'official') — 이 브라우저에만 저장 */
  checkMethods: Record<string, string>
  setCheckMethod: (requirementId: string, method: string | null) => void
  /** 로그인 직후 호출 — 내 정보를 불러와 세션을 채운다. 프로필 유무를 돌려준다 */
  loadAccount: () => Promise<boolean>
  startGuest: () => void
  /**
   * program: 고른 융합전공 (undefined면 그대로). server가 true면 계정에 저장하고,
   * false면(백엔드가 아직 지원 안 함) 이 브라우저에만 둔다
   */
  saveProfile: (
    profile: StudentProfile,
    studentNumber?: string,
    program?: { id: string | null; server: boolean },
  ) => Promise<void>
  /** 학적에 저장한 융합전공 id */
  convergenceProgram: string | null
  signOut: () => Promise<void>
}

export const StudentContext = createContext<StudentContextValue | null>(null)

export function useStudent() {
  const ctx = useContext(StudentContext)
  if (!ctx) throw new Error('useStudent는 StudentProvider 안에서만 쓸 수 있어요')
  return ctx
}

/** 프로필이 있는 화면에서만 쓰는 버전 (AppLayout이 프로필 없으면 온보딩으로 보낸다) */
export function useProfile(): StudentProfile {
  const { profile } = useStudent()
  if (!profile) throw new Error('프로필이 없어요')
  return profile
}
