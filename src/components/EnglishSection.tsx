import type { EvaluationResponse, GraduationRule, StudentProfile } from '@/api'
import { EnglishAlternativeNote, EnglishScoreInput } from '@/components/EnglishScoreInput'
import { StatusBadge, ui } from '@/components/ui'
import { useEnglish } from '@/state/english'
import styles from './EnglishSection.module.css'

/** 공인영어 성적 + 실용영어 졸업자격인정 충족 방법 */
export function EnglishSection({
  rule,
  profile,
  evaluation,
}: {
  rule: GraduationRule
  profile: StudentProfile
  evaluation: EvaluationResponse | undefined
}) {
  const en = useEnglish(rule, profile)
  if (!en.hasEnglish) return null
  const statusOf = (id: string) => evaluation?.requirements.find((r) => r.id === id)?.status

  const method = en.methods.find((m) => m.id === en.practicalMethod)

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>영어</h2>
        <span className={ui.muted}>가장 높은 공인영어 성적 하나를 입력하세요</span>
      </div>

      <div className={styles.reqs}>
        {en.scoreReqs.map((r) => (
          <span key={r.id} className={styles.req}>
            {r.name} · TOEIC {r.minimum}점 {statusOf(r.id) && <StatusBadge status={statusOf(r.id)!} />}
          </span>
        ))}
        {en.practical && (
          <span className={styles.req}>
            {en.practical.name} {statusOf(en.practical.id) && <StatusBadge status={statusOf(en.practical.id)!} />}
          </span>
        )}
      </div>

      <EnglishScoreInput
        toeicMinimum={en.toeicMinimum}
        saved={en.score}
        profile={profile}
        onSave={(score) => en.saveScore(score)}
      />
      {en.scoreReqs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <EnglishAlternativeNote />
        </div>
      )}

      {en.practical && (
        <div className={styles.practical}>
          <div>
            <h3>{en.practical.name} · 충족 방법</h3>
            <p className={ui.muted}>
              {en.scoreReqs.length > 0
                ? '학부 영어 요건과 별도로 경북대 졸업자격인정원에 제출해 인정받아야 해요. 둘 다 채워야 졸업할 수 있어요.'
                : '경북대 졸업자격인정원에 제출해 인정받아야 해요. 아래 중 하나를 채우면 돼요.'}
            </p>
          </div>
          <select
            className={ui.select}
            value={en.practicalMethod ?? ''}
            onChange={(e) => en.choosePracticalMethod(e.target.value || null)}
          >
            <option value="">충족 방법 선택</option>
            {en.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {method?.auto && (
            <p className={styles.result} data-ok={en.current.equivalent >= 700}>
              {!en.score
                ? '위에 공인영어 성적을 입력하면 자동으로 판정해요.'
                : en.current.equivalent >= 700
                  ? '입력한 성적이 TOEIC 700 기준 이상이라 충족으로 표시했어요.'
                  : en.current.valid
                    ? '입력한 성적이 TOEIC 700 기준에 못 미쳐요.'
                    : '입력한 성적이 인정 기간 밖이에요.'}
            </p>
          )}
          {method && !method.auto && (
            <label className={styles.check}>
              <input type="checkbox" checked={en.practicalDone} onChange={(e) => en.confirmPractical(e.target.checked)} />
              이 방법으로 충족했어요
            </label>
          )}
          <p className={ui.muted}>
            공인영어시험 · 모의TOEIC 성적은 졸업자격인정원 제출일 기준 2년 이내, 입학 이후 취득한 성적만 인정돼요.
          </p>
        </div>
      )}
    </section>
  )
}
