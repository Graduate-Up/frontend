import type { StudentProfile } from '@/api'

/** student_status와 겹치는 불리언 필드를 맞춰서 보낸다 */
export function normalizeProfile(p: StudentProfile): StudentProfile {
  const status = p.student_status ?? 'new'
  return {
    ...p,
    student_status: status,
    transfer_student: status === 'general_transfer' || status === 'bachelor_transfer',
    international_student: status === 'foreign',
    disabled_student: status === 'disabled',
    abeek: p.major === 'plsop' ? (p.abeek ?? null) : null,
  }
}
