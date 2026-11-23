import { BASE_URL, request, tokenStore } from './client'
import type {
  AccountResponse,
  CourseSearchResponse,
  StudentRecords,
  TranscriptPreview,
  Credentials,
  Registration,
  EvaluationRequest,
  EvaluationResponse,
  GraduationRule,
  GraduationSchedule,
  RecommendationRequest,
  Recommendations,
  MajorCode,
  MajorsResponse,
  MeResponse,
  SessionResponse,
  StudentProfile,
  StudentSettings,
  TracksResponse,
} from './types'

export { ApiError, tokenStore } from './client'
export type * from './types'

type Opts = { signal?: AbortSignal }

const V1 = '/api/v1'

// ── 요건 조회 (로그인 불필요) ───────────────────────────

/** 졸업자격인정원 마감 · 학부 요건 마감 · 조기졸업 기준 */
export function getGraduationSchedule(
  params: { graduation?: string | null; major?: MajorCode; admission_year?: number } = {},
  opts?: Opts,
) {
  const query: Record<string, string | number> = {}
  if (params.graduation) query.graduation = params.graduation
  if (params.major) query.major = params.major
  if (params.admission_year) query.admission_year = params.admission_year
  return request<GraduationSchedule>(`${V1}/graduation/schedule`, { query, ...opts })
}

/** 입학년도에 선택 가능한 세부전공 */
export function getMajors(admissionYear: number, opts?: Opts) {
  return request<MajorsResponse>(`${V1}/majors`, { query: { admission_year: admissionYear }, ...opts })
}

/** 전공·학번에 고를 수 있는 트랙 / ABEEK 선택 필요 여부 */
export function getTracks(admissionYear: number, major: MajorCode, opts?: Opts) {
  return request<TracksResponse>(`${V1}/requirements/tracks`, {
    query: { admission_year: admissionYear, major },
    ...opts,
  })
}

/** 학적 조건에 맞는 졸업요건 */
export function getRequirements(profile: StudentProfile, opts?: Opts) {
  return request<GraduationRule>(`${V1}/requirements`, { query: { ...profile }, ...opts })
}

/** 이수 과목으로 졸업요건 판정 (저장 안 함) */
export function previewEvaluation(body: EvaluationRequest, opts?: Opts) {
  return request<EvaluationResponse>(`${V1}/evaluations/preview`, { method: 'POST', body, ...opts })
}

// ── 계정 ───────────────────────────────────────────────

/** 학교 이메일로 가입 인증번호 6자리를 보낸다 */
export function sendEmailCode(email: string, purpose: 'register' | 'reset' = 'register') {
  return request<void>(`${V1}/auth/email-code`, { method: 'POST', body: { email, purpose } })
}

/** 재설정 인증번호가 맞으면 새 비밀번호로 바꾸고 바로 로그인한다 */
export async function resetPassword(reset: { email: string; code: string; password: string }) {
  const session = await request<SessionResponse>(`${V1}/auth/password-reset`, { method: 'POST', body: reset })
  tokenStore.set(session.access_token)
  return session
}

export function register(registration: Registration) {
  return request<AccountResponse>(`${V1}/auth/register`, { method: 'POST', body: registration })
}

export async function login(credentials: Credentials) {
  const session = await request<SessionResponse>(`${V1}/auth/login`, { method: 'POST', body: credentials })
  tokenStore.set(session.access_token)
  return session
}

export async function logout() {
  try {
    await request<void>(`${V1}/auth/logout`, { method: 'POST', auth: true })
  } finally {
    tokenStore.clear()
  }
}

export function getMe(opts?: Opts) {
  return request<MeResponse>(`${V1}/me`, { auth: true, ...opts })
}

export function saveProfile(settings: StudentSettings) {
  return request<MeResponse>(`${V1}/me/profile`, { method: 'PUT', body: settings, auth: true })
}

/** 저장된 프로필 기준 졸업요건 (프로필 없으면 409) */
export function getMyRequirements(opts?: Opts) {
  return request<GraduationRule>(`${V1}/me/requirements`, { auth: true, ...opts })
}

// ── 과목 검색 · 이수 기록 · 성적표 ─────────────────────

/** 교육과정 과목 검색 (코드 또는 과목명) — 로그인 불필요 */
export function searchCourses(
  params: {
    admission_year: number
    major: MajorCode
    q?: string
    limit?: number
    offset?: number
    /** 플솝 ABEEK 이수면 선수과목 정보를 같이 준다 */
    abeek?: boolean
  },
  opts?: Opts,
) {
  return request<CourseSearchResponse>(`${V1}/courses`, { query: params, ...opts })
}

/** 저장된 이수 과목 · 비교과 기록 */
export function getMyRecords(opts?: Opts) {
  return request<StudentRecords>(`${V1}/me/records`, { auth: true, ...opts })
}

/** 이수 과목 · 비교과 기록 전체를 교체 저장 */
/** 서버에 저장된 이수 기록으로 과목 추천 (진로 · AI 순서 선택) */
export function getMyRecommendations(body: RecommendationRequest, opts?: Opts) {
  return request<Recommendations>(`${V1}/me/recommendations`, { method: 'POST', body, auth: true, ...opts })
}

export function saveMyRecords(records: StudentRecords) {
  return request<StudentRecords>(`${V1}/me/records`, { method: 'PUT', body: records, auth: true })
}

/** 복사한 성적표 텍스트를 읽어 미리보기 (원문은 저장 안 함) */
export function parseTranscript(text: string) {
  return request<TranscriptPreview>(`${V1}/me/transcript/parse`, { method: 'POST', body: { text }, auth: true })
}

/** 성적 가져오기 즐겨찾기(북마클릿) 원본 스크립트 — 백엔드가 최신본을 준다 */
export async function getBookmarkletSource(): Promise<string> {
  const res = await fetch(`${BASE_URL}/transcript-bookmarklet.js`)
  if (!res.ok) throw new Error('즐겨찾기 스크립트를 불러오지 못했어요.')
  return (await res.text()).trim()
}
