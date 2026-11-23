import type { Student } from '@/types/student'

/** "예시 학생으로 둘러보기"용 데모 데이터 */
export const sampleStudent: Student = {
  displayName: '학생 A',
  profile: {
    admission_year: 2021,
    major: 'plsop',
    abeek: false,
    multi_major: 'none',
    expected_graduation_date: '2027-02',
    student_status: 'new',
  },
}
