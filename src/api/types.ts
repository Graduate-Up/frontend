/**
 * 백엔드(졸UP Backend API 0.1.0) openapi.json 스키마를 옮긴 타입.
 * 백엔드 스키마가 바뀌면 여기를 같이 고쳐야 한다.
 */

// ── 공통 enum ──────────────────────────────────────────

export type MajorCode = 'glsop' | 'plsop' | 'aicom' | 'simcom' | 'chumcom'

export type MultiMajor =
  | 'none'
  | 'double_major'
  | 'minor'
  | 'interdisciplinary'
  | 'double_or_linked_or_convergence'
  | 'minor_1_only'
  | 'minor_2plus'
  | 'teaching_course'

export type StudentStatus = 'new' | 'general_transfer' | 'bachelor_transfer' | 'foreign' | 'disabled'

export type CreditCategory = 'major' | 'liberal_arts' | 'general'
export type CreditArea = 'total' | 'major' | 'liberal_arts'

/** 판정 상태 */
export type JudgementStatus = 'satisfied' | 'unsatisfied' | 'approval_required' | 'verification_required'

export type Dataset = 'official' | 'test'

/** 'YYYY-02' | 'YYYY-08' */
export type GraduationMonth = string

// ── 에러 ───────────────────────────────────────────────

export type ErrorResponse = { detail: string }

export type ValidationError = {
  loc: (string | number)[]
  msg: string
  type: string
  input?: unknown
  ctx?: Record<string, unknown>
}

export type HTTPValidationError = { detail?: ValidationError[] }

// ── 전공 · 트랙 ────────────────────────────────────────

export type MajorOption = { code: MajorCode; name: string }

export type MajorsResponse = { admission_year: number; majors: MajorOption[] }

export type TracksResponse = {
  tracks: string[]
  allows_no_track: boolean
  requires_abeek?: boolean
  /** track → 표시 이름 */
  track_labels?: Record<string, string>
  /** track → (variant → 표시 이름) */
  track_variants?: Record<string, Record<string, string>>
}

// ── 졸업요건 (GraduationRule) ───────────────────────────

export type Source = { title: string; url?: string | null; reference?: string | null }

export type Conditions = {
  admission_from?: number | null
  admission_to?: number | null
  graduation_from?: string | null
  graduation_to?: string | null
  tracks?: (string | null)[] | null
  abeek?: boolean | null
  abeek_values?: (boolean | null)[] | null
  disabled_student?: boolean | null
  multi_majors?: MultiMajor[] | null
  transfer_student?: boolean | null
  international_student?: boolean | null
}

type RequirementBase = {
  id: string
  name: string
  conditions?: Conditions
  sources?: Source[]
}

export type CreditRequirement = RequirementBase & {
  area: CreditArea
  minimum: number
}

export type CourseOption = {
  course_code: string
  course_name: string
  substitutes?: string[]
}

export type CourseRequirement = RequirementBase & {
  courses: CourseOption[]
  /** courses 중 몇 개를 들어야 하는지 */
  choose: number
  required_transcript_category?: string | null
  require_department?: boolean
  reject_transfer_courses?: boolean
  minimum_course_credits?: number
  accept_equivalent_codes?: boolean
}

export type NonacademicRequirement = RequirementBase & {
  minimum?: number
  unit?: string | null
  details?: string[]
  /** 대체 인정 과목 (예: 소프트웨어 졸업자격인정) */
  course_codes?: string[]
  /** 과목별 설계학점 등 */
  course_credits?: Record<string, number>
}

export type VerificationRequirement = RequirementBase

export type CreditTreatment = {
  category: CreditCategory
  status?: 'recognized' | 'approval_required' | 'verification_required'
  counts_toward_total?: boolean
}

export type CreditCap = {
  maximum: number
  category?: CreditCategory | null
  course_codes?: string[] | null
  code_prefix?: string | null
}

export type GraduationRule = {
  id: string
  dataset: Dataset
  major: MajorCode | 'common'
  admission_from: number
  admission_to: number
  allowed_tracks?: (string | null)[]
  conditions?: Conditions
  sources: Source[]
  notes?: string[]
  credit_requirements: CreditRequirement[]
  course_requirements: CourseRequirement[]
  nonacademic_requirements: NonacademicRequirement[]
  verification_requirements?: VerificationRequirement[]
  department_major_codes?: string[]
  major_transcript_categories?: string[]
  prefix_treatments?: Record<string, CreditTreatment>
  transcript_categories?: Record<string, CreditTreatment>
  course_treatments?: Record<string, CreditTreatment>
  equivalent_courses?: Record<string, string[]>
  review_equivalences?: Record<string, string[]>
  transfer_credit_max?: number | null
  credit_caps?: CreditCap[]
}

// ── 학생 프로필 ────────────────────────────────────────

/** 요건 조회·판정에 쓰는 학적 조건 (GET /requirements 쿼리와 같은 필드) */
export type StudentProfile = {
  admission_year: number
  major: MajorCode
  track?: string | null
  track_variant?: string | null
  abeek?: boolean | null
  multi_major?: MultiMajor
  expected_graduation_date?: GraduationMonth | null
  transfer_student?: boolean
  student_status?: StudentStatus | null
  international_student?: boolean
  disabled_student?: boolean
  /** 정규학기 등록 횟수 (조기졸업 판정용) */
  registered_semesters?: number | null
}

/** 로그인 사용자가 저장하는 프로필 (StudentProfile + 학번) */
/** 계정에 저장하는 학적 (판정 요청에는 student_number · convergence_program을 빼고 보낸다) */
export type StudentSettings = StudentProfile & {
  student_number: string
  /** GET /convergence-programs의 id. null이면 지운다, 빼고 보내면 그대로 둔다 */
  convergence_program?: string | null
}

/** 융합전공 과목 */
export type ProgramCourse = {
  code: string
  name: string
  credits: number
  /** 그 융합전공 자료에 적힌 원래 교과구분 */
  curriculum_category?: string | null
  career_tags?: CareerTag[]
}

/** 융합전공 목록 (GET /convergence-programs). courses는 최신 백엔드부터 온다 */
export type ProgramSummary = {
  id: string
  name: string
  kind: 'convergence' | 'double_major'
  source: Source
  courses?: ProgramCourse[]
}

// ── 판정 (evaluation) ──────────────────────────────────

export type CourseStatus = 'completed' | 'in_progress' | 'failed' | 'incomplete'

/** 성적등급 (4.3 만점) — 평점평균 계산에 쓴다 */
export type Grade = 'A+' | 'A0' | 'A-' | 'B+' | 'B0' | 'B-' | 'C+' | 'C0' | 'C-' | 'D+' | 'D0' | 'D-' | 'F' | 'P' | 'NP'

export type Course = {
  course_code: string
  course_name?: string | null
  /** 예: 2024-1, 2024-summer, 2024-2, 2024-winter */
  semester: string
  credits: number
  /** 성적표 교과구분 (예: 전공필수) */
  transcript_category: string
  offered_by_computer_science?: boolean | null
  prior_institution?: boolean | null
  grade?: Grade | null
  status: CourseStatus
}

/** 영어 시험 원본 (학부 영어 · 실용영어 기록에만) */
export type EnglishTestResult = {
  test_type: string
  /** 점수 또는 OPIc 등급 (예: 750, 'IM2') */
  raw_score: number | string
  /** 응시 연월 YYYY-MM */
  taken_month: string
}

export type NonacademicRecord = {
  requirement_id: string
  amount: number
  status: JudgementStatus
  english_test?: EnglishTestResult | null
}

export type EvaluationRequest = {
  student_profile: StudentProfile
  completed_courses: Course[]
  nonacademic_records?: NonacademicRecord[]
  /** 성적표의 첨성인 교양 영역별 이수학점 (있으면 교양 영역 요건을 이 숫자로 판정) */
  liberal_summary?: LiberalSummary | null
}

export type RequiredCourseResult = {
  course_code: string
  course_name: string
  status: 'completed' | 'in_progress' | 'missing' | 'approval_required' | 'verification_required'
}

export type RequirementResult = {
  id: string
  name: string
  status: JudgementStatus
  current: number
  required: number
  shortfall: number
  reason: string
  sources: Source[]
  credit_area?: CreditArea | null
  required_courses?: RequiredCourseResult[]
  details?: string[]
  /** (프론트에서만 붙임) 다른 요건으로 대체해서 이 요건은 해당 없음 — 예: 스타트업 창업활동 → 창업 교과목 15학점 */
  not_applicable?: boolean
}

export type CreditEntry = {
  course_code: string
  course_name?: string | null
  semester: string
  transcript_category: string
  recognized_category?: CreditCategory | null
  recognized_credits?: number
  counts_toward_total?: boolean
  excluded_credits?: number
  reason?: string | null
  /** 교과구분 변경을 신청하면 전공으로 인정될 수 있는 과목 */
  major_approval_required?: boolean
  offered_by_computer_science?: boolean | null
  /** 교육과정표 · 수강 학기 교양 영역 기준 구분 (예: 공학전공, 첨성인기초(글쓰기), 첨성인핵심(인문·사회), SDG, 창업교과목) */
  course_areas?: string[]
}

export type EvaluationResponse = {
  rule_id: string
  dataset: Dataset
  eligible: boolean
  status: JudgementStatus
  /** 졸업 진행률 0~100 (모든 요건 충족 전에는 최대 99) */
  progress: number
  progress_policy?: string
  requirement_counts: RequirementCounts
  requirements: RequirementResult[]
  credit_entries: CreditEntry[]
  /** 자동 판정에서 뺀 규칙 해석 확인 항목 (학부 확인 메모) */
  notices?: { id: string; name: string; sources: Source[] }[]
  early_graduation?: EarlyGraduationAssessment | null
}

export type EarlyGraduationPolicy = {
  min_semesters: number
  min_gpa: number
  rule: string
  not_for_transfer: boolean
  sources: Source[]
}

export type EarlyGraduationAssessment = {
  status: 'criteria_met' | 'criteria_not_met' | 'verification_required' | 'not_applicable'
  registered_semesters: number | null
  gpa: number | null
  graduation_requirements_met: boolean
  policy: EarlyGraduationPolicy
}

export type RequirementCounts = {
  satisfied?: number
  unsatisfied?: number
  approval_required?: number
  verification_required?: number
}

// ── 이수 기록 저장 · 과목 검색 · 성적표 ─────────────────

export type StudentRecords = {
  completed_courses?: Course[]
  nonacademic_records?: NonacademicRecord[]
  /** 성적표의 첨성인 교양 영역별 이수학점. 빼고 보내면 서버에 있던 값을 유지한다 */
  liberal_summary?: LiberalSummary | null
}

/** 첨성인기초 · 핵심 영역 8개 */
export type LiberalAreaKey =
  '독서와토론' | '사고교육' | '글쓰기' | '외국어' | '수리' | '기초과학' | '인문·사회' | '자연과학'

export type LiberalSummary = Record<LiberalAreaKey, number>

export type CatalogCourse = {
  course_code: string
  course_name: string
  credits: number
  /** 교육과정표 교과구분 (예: 전공, 교양) */
  curriculum_category: string
  recommended_year?: string | null
  recommended_semester?: string | null
  note?: string | null
  /** 컴퓨터학부 개설 여부 (백엔드 판단, 모르면 null) */
  offered_by_computer_science?: boolean | null
  career_tags?: CareerTag[]
  /** 선수과목 — 그룹마다 하나 이상 이수 (예: [['COMP0204', 'COMP0206']]) */
  prerequisite_groups?: string[][] | null
  prerequisite_kind?: 'required' | 'recommended' | null
  prerequisite_sources?: Source[]
}

export type CourseSearchResponse = {
  source?: string
  /** 어떤 교육과정표 기준인지 */
  basis: string
  /** 내 학번 교육과정표가 아니라 추정한 표인지 */
  inferred: boolean
  curriculum_source?: Source
  total: number
  items: CatalogCourse[]
}

export type TranscriptCourse = {
  course_code: string
  course_name?: string | null
  credits?: number | null
  semester?: string | null
  semester_label?: string | null
  transcript_category?: string | null
  grade?: string | null
  completed?: boolean
}

export type TranscriptPreview = {
  courses: TranscriptCourse[]
  failed_courses?: TranscriptCourse[]
  excluded_failed: number
  duplicates_removed: number
  needs_review: number
  completed_credits?: number
}

// ── 계정 ───────────────────────────────────────────────

/** 로그인 — 학교 이메일 전체(@knu.ac.kr)와 비밀번호 */
export type Credentials = { email: string; password: string }

/** 가입 — 이메일로 받은 인증번호 6자리. legacy_username을 주면 예전 아이디 계정의 기록을 옮긴다 */
export type Registration = Credentials & { code: string; legacy_username?: string | null }

/** username은 학교 이메일 */
export type AccountResponse = { id: number; username: string }

export type SessionResponse = {
  access_token: string
  token_type?: 'bearer'
  /** 초 */
  expires_in: number
}

export type MeResponse = {
  account: AccountResponse
  profile: StudentSettings | null
}

// ── 졸업 일정 (GET /graduation/schedule) ───────────────

export type QualificationDeadline = {
  /** 졸업 시기 YYYY-02 · YYYY-08 */
  graduation: string
  /** 졸업자격인정원 마감 YYYY-MM-DD */
  date: string
  note?: string | null
  sources: Source[]
}

export type GraduationEvent = {
  kind:
    | 'portfolio_submission'
    | 'graduation_interview'
    | 'classification_change'
    | 'general_elective_conversion'
    | 'graduation_review_result'
  graduation: string
  major?: MajorCode | null
  admission_from?: number | null
  admission_to?: number | null
  start_date?: string | null
  end_date?: string | null
  /** confirmed: 날짜 확정, tentative: 예정, standing_rule: 상시, unverified: 미확인 */
  status: 'confirmed' | 'tentative' | 'standing_rule' | 'unverified'
  note?: string | null
  sources: Source[]
}

export type ClassificationChange = {
  /** 학부 온라인 신청 안내의 컴퓨터학부 코드 */
  department_code: string
  major_department_codes: Partial<Record<MajorCode, string>>
  major_sources: Partial<Record<MajorCode, Source[]>>
  form_url: string
  form_name: string
  sources: Source[]
}

export type GraduationDeferral = {
  max_semesters: number
  min_completed_semesters: number
  facility_fee_percent: number
  tuition_by_credits: { min_credits: number; max_credits: number | null; tuition_fraction: string }[]
  note: string
  sources: Source[]
}

export type GraduationSchedule = {
  qualification_deadlines: QualificationDeadline[]
  department_deadline: { label: string; sources: Source[] }
  early_graduation: EarlyGraduationPolicy
  events: GraduationEvent[]
  classification_change: ClassificationChange
  deferral: GraduationDeferral
}

// ── 과목 추천 (POST /me/recommendations) ───────────────

export type CareerTag = 'ai_data' | 'backend' | 'security' | 'graduate_study'

export type RequirementGain = { requirement_id: string; name: string; amount: number }

export type CourseRecommendation = {
  course_code: string
  course_name: string
  credits: number
  curriculum_category: string
  recommended_year?: string | null
  recommended_semester?: string | null
  /** 이 과목을 들으면 줄어드는 부족분 */
  gains: RequirementGain[]
  career_tags: CareerTag[]
  reason: string
  /** 이 과목이 들어 있는 융합전공 · 복수전공 id */
  program_ids: string[]
}

export type ProgramRecommendation = {
  id: string
  name: string
  kind: 'convergence' | 'double_major'
  /** 이미 들은 과목 중 이 전공 과목 */
  overlapping_course_codes: string[]
  /** 진로 · 관심 분야와 이어지는 과목 */
  related_course_codes: string[]
  source: Source
}

export type Recommendations = {
  curriculum_source: Source
  inferred: boolean
  missing_course_requirements: RequirementGain[]
  recommended: CourseRecommendation[]
  alternatives: CourseRecommendation[]
  programs: ProgramRecommendation[]
  program_data_available: boolean
  /** rules: 규칙으로 정렬, openai: AI가 진로에 맞춰 순서 조정 */
  ranking: 'rules' | 'openai'
}

export type RecommendationRequest = {
  career?: CareerTag | null
  use_ai?: boolean
  /** 들을 학기 YYYY-1|2 */
  target_semester?: string | null
}
