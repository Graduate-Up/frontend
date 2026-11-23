import type { StudentProfile } from '@/api'

/** 플솝 ABEEK 이수가 가능한 마지막 졸업 시기 (백엔드 plsop_abeek_* program_end.last_graduation) */
export const ABEEK_LAST_GRADUATION = '2029-02'

/** student_status와 겹치는 불리언 필드를 맞춰서 보낸다 */
export function normalizeProfile(p: StudentProfile): StudentProfile {
  const status = p.student_status ?? 'new'
  return {
    ...p,
    student_status: status,
    transfer_student: status === 'general_transfer' || status === 'bachelor_transfer',
    international_student: status === 'foreign',
    disabled_student: status === 'disabled',
    // 2029년 2월 뒤 졸업이면 ABEEK 이수가 안 돼서(백엔드 오류) 미이수로 본다
    abeek:
      p.major !== 'plsop'
        ? null
        : p.abeek && p.expected_graduation_date && p.expected_graduation_date > ABEEK_LAST_GRADUATION
          ? false
          : (p.abeek ?? null),
  }
}
