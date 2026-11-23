import {
  SUBSTITUTE_METHOD,
  chosenSubstitutions,
  substitutionAmount,
  substitutionFor,
  withCourseRecords,
} from '@/content/substitutions'
import { formatCredits } from '@/components/ui'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './SubstitutionToggle.module.css'

/**
 * 대체 인정 고르기 버튼 (예: 스타트업 창업활동 → 창업 교과목 15학점, 추가 6학점).
 * 졸업요건 목록 · 상세 · 비교과 입력에서 같이 쓴다. 대체할 수 없는 요건이면 아무것도 안 그린다.
 */
export function SubstitutionToggle({ targetId }: { targetId: string }) {
  const profile = useProfile()
  const { courses, records, checkMethods, setCheckMethod } = useStudent()
  const sub = substitutionFor(profile.major, targetId)
  if (!sub) return null
  const allRecords = withCourseRecords(courses, records)
  const chosen = chosenSubstitutions(checkMethods)
  const isChosen = chosen.has(targetId)
  const now = substitutionAmount(sub, allRecords)
  const done = now >= sub.minimum

  return (
    <div className={styles.row}>
      {isChosen ? (
        <>
          <span className={styles.status} data-done={done}>
            {`${sub.label}했어요 — 창업 교과목 ${formatCredits(now)} / ${formatCredits(sub.minimum)}학점${done ? ' · 충족' : ''}`}
          </span>
          <button type="button" className={styles.cancel} onClick={() => setCheckMethod(targetId, null)}>
            대체 취소
          </button>
        </>
      ) : (
        <button type="button" className={styles.choose} onClick={() => setCheckMethod(targetId, SUBSTITUTE_METHOD)}>
          {sub.action}
        </button>
      )}
    </div>
  )
}
