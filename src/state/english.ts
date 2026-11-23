import type { GraduationRule, StudentProfile } from '@/api'
import {
  OFFICIAL_ENGLISH_KEY,
  PRACTICAL_ENGLISH_ID,
  PRACTICAL_METHODS,
  isEnglishScoreRequirement,
  scoreValidity,
  toeicEquivalent,
  type EnglishScore,
} from '@/content/englishTests'
import { useStudent } from './useStudent'

/**
 * 공인영어 성적 하나로 영어 관련 요건을 함께 채운다.
 * - 학부 영어 요건(TOEIC 기준 N점): 환산 점수를 기록 → 기준 이상이면 서버가 충족 판정
 * - 실용영어 졸업자격인정: '공인영어시험' 방법이면 TOEIC 700 이상일 때 체크
 */
export function useEnglish(rule: GraduationRule | undefined, profile: StudentProfile) {
  const { englishScores, setEnglishScore, records, setRecord, checkMethods, setCheckMethod } = useStudent()

  const scoreReqs = (rule?.nonacademic_requirements ?? []).filter(isEnglishScoreRequirement)
  const practical = rule?.nonacademic_requirements.find((r) => r.id === PRACTICAL_ENGLISH_ID)
  // 예전 버전은 요건 id로 저장했다
  const score = englishScores[OFFICIAL_ENGLISH_KEY] ?? scoreReqs.map((r) => englishScores[r.id]).find(Boolean)
  const practicalMethod = checkMethods[PRACTICAL_ENGLISH_ID] ?? null
  const methods = PRACTICAL_METHODS.filter((m) => !m.applies || m.applies(profile))

  const evaluate = (s: EnglishScore | undefined) => {
    if (!s) return { valid: false, equivalent: 0 }
    const valid = scoreValidity(s.takenAt, profile.admission_year, profile.expected_graduation_date).ok
    return { valid, equivalent: valid ? toeicEquivalent(s) : 0 }
  }
  const current = evaluate(score)

  function saveScore(next: EnglishScore | null) {
    setEnglishScore(OFFICIAL_ENGLISH_KEY, next)
    for (const r of scoreReqs) if (englishScores[r.id]) setEnglishScore(r.id, null)
    const { equivalent } = evaluate(next ?? undefined)
    for (const r of scoreReqs) setRecord(r.id, next ? equivalent : null)

    if (!practical) return
    const meets700 = !!next && equivalent >= 700
    // 방법을 아직 안 골랐는데 성적이 기준 이상이면 공인영어시험으로 채운다
    if (!practicalMethod && meets700) setCheckMethod(PRACTICAL_ENGLISH_ID, 'official')
    if (practicalMethod === 'official' || (!practicalMethod && meets700))
      setRecord(PRACTICAL_ENGLISH_ID, meets700 ? (practical.minimum ?? 1) : null)
  }

  function choosePracticalMethod(method: string | null) {
    if (!practical) return
    setCheckMethod(PRACTICAL_ENGLISH_ID, method)
    if (method === 'official') setRecord(PRACTICAL_ENGLISH_ID, current.equivalent >= 700 ? (practical.minimum ?? 1) : null)
    else setRecord(PRACTICAL_ENGLISH_ID, null)
  }

  /** 공인영어시험 외 방법은 학생이 충족했다고 직접 표시 */
  function confirmPractical(done: boolean) {
    if (!practical) return
    setRecord(PRACTICAL_ENGLISH_ID, done ? (practical.minimum ?? 1) : null)
  }

  return {
    hasEnglish: scoreReqs.length > 0 || !!practical,
    scoreReqs,
    practical,
    score,
    current,
    toeicMinimum: Math.max(700, ...scoreReqs.map((r) => r.minimum ?? 700)),
    methods,
    practicalMethod,
    practicalDone: records.some((r) => r.requirement_id === PRACTICAL_ENGLISH_ID),
    saveScore,
    choosePracticalMethod,
    confirmPractical,
  }
}
