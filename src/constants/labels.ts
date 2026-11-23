import type {
  CourseStatus,
  CreditArea,
  CreditCategory,
  JudgementStatus,
  MultiMajor,
  RequiredCourseResult,
  StudentStatus,
} from '@/api/types'

/** 온보딩에서 보여줄 다전공 선택지 (백엔드 규칙 파일 README 기준) */
export const MULTI_MAJOR_OPTIONS: { value: MultiMajor; label: string }[] = [
  { value: 'none', label: '안 함' },
  { value: 'double_or_linked_or_convergence', label: '복수 · 연계 · 융합전공' },
  { value: 'minor_1_only', label: '부전공 1개' },
  { value: 'minor_2plus', label: '부전공 2개 이상' },
  { value: 'teaching_course', label: '교직과정' },
]

export const MULTI_MAJOR_LABEL: Record<MultiMajor, string> = {
  none: '다전공 없음',
  double_major: '복수전공',
  minor: '부전공',
  interdisciplinary: '연계전공',
  double_or_linked_or_convergence: '복수·연계·융합전공',
  minor_1_only: '부전공 1개',
  minor_2plus: '부전공 2개 이상',
  teaching_course: '교직과정',
}

export const STUDENT_STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: 'new', label: '신입학' },
  { value: 'general_transfer', label: '일반편입' },
  { value: 'bachelor_transfer', label: '학사편입' },
  { value: 'foreign', label: '외국인' },
  { value: 'disabled', label: '장애학생' },
]

export const JUDGEMENT_LABEL: Record<JudgementStatus, string> = {
  satisfied: '충족',
  unsatisfied: '미충족',
  approval_required: '승인 필요',
  verification_required: '확인 필요',
}

export const REQUIRED_COURSE_LABEL: Record<RequiredCourseResult['status'], string> = {
  completed: '이수',
  in_progress: '수강 중',
  missing: '미이수',
  approval_required: '승인 필요',
  verification_required: '확인 필요',
}

export const COURSE_STATUS_OPTIONS: { value: CourseStatus; label: string }[] = [
  { value: 'completed', label: '이수' },
  { value: 'in_progress', label: '수강 중' },
  { value: 'failed', label: 'F · 미취득' },
  { value: 'incomplete', label: '미완료' },
]

export const CREDIT_AREA_LABEL: Record<CreditArea, string> = {
  total: '졸업학점',
  major: '전공',
  liberal_arts: '교양',
}

export const CREDIT_CATEGORY_LABEL: Record<CreditCategory, string> = {
  major: '전공',
  liberal_arts: '교양',
  general: '일반선택',
}

/** 성적표 교과구분 기본 후보 — 백엔드 요건에 후보가 없을 때 사용 */
export const DEFAULT_TRANSCRIPT_CATEGORIES = ['전공기초', '전공필수', '전공선택', '교양필수', '교양선택', '일반선택']

export function formatGraduation(value: string | null | undefined) {
  if (!value) return null
  const [y, m] = value.split('-')
  return `${y}년 ${Number(m)}월`
}

/** 백엔드 판정 사유(영문·코드) → 화면 문구. 모르는 값은 그대로 보여준다 */
const REASON_LABEL: Record<string, string> = {
  // 요건별
  'Calculated from recognized completed credits': '인정된 이수 학점으로 계산했어요.',
  'Calculated from transcript categories': '성적표 교과구분 기준으로 계산했어요.',
  'Credit classification or approval is pending': '인정 영역 확인이나 승인이 남은 과목이 있어요.',
  'Matched course codes and applicable offering and transcript classification rules':
    '과목코드와 개설 학부 · 교과구분 기준으로 확인했어요.',
  'Compared with submitted nonacademic records': '입력한 비교과 기록과 비교했어요.',
  'Additional evidence or interpretation is needed to automate this requirement':
    '자동으로 판정할 수 없어요. 증빙을 학부 사무실에서 확인해야 해요.',
  // 과목별 (credit_entries.reason)
  verification_required: '확인 필요',
  approval_required: '승인 필요',
  duplicate_course: '중복 이수 — 한 번만 인정',
  credit_cap: '인정 상한 초과분 제외',
  excluded_from_total: '졸업학점에 포함 안 됨',
  in_progress: '수강 중',
  failed: '미취득',
  incomplete: '미완료',
  completed: '이수',
  recognized: '인정',
}

export function reasonText(reason: string | null | undefined): string {
  if (!reason) return ''
  return REASON_LABEL[reason] ?? reason
}
