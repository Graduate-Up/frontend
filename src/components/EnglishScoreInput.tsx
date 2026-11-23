import { useState, type FormEvent } from 'react'
import type { StudentProfile } from '@/api'
import { ui } from '@/components/ui'
import {
  ENGLISH_TESTS,
  formatScore,
  scoreValidity,
  testById,
  thresholdText,
  toeicEquivalent,
  type EnglishScore,
  type EnglishTestId,
} from '@/content/englishTests'
import styles from './EnglishScoreInput.module.css'

/**
 * 공인영어 성적 입력 — 시험을 고르고 점수(OPIc는 등급)와 응시일을 넣는다.
 * 판정에는 TOEIC 환산 점수를 보낸다. 인정 기간 밖이면 0으로 보낸다.
 */
export function EnglishScoreInput({
  toeicMinimum,
  saved,
  profile,
  onSave,
}: {
  /** 요건의 TOEIC 기준 (700 또는 800) */
  toeicMinimum: number
  saved: EnglishScore | undefined
  profile: StudentProfile
  onSave: (score: EnglishScore | null, amount: number | null) => void
}) {
  const [test, setTest] = useState<EnglishTestId>(saved?.test ?? 'toeic')
  const [score, setScore] = useState(saved ? String(saved.score) : '')
  const [takenAt, setTakenAt] = useState(saved?.takenAt ?? '')

  const t = testById(test)
  const draft: EnglishScore | null = score === '' ? null : { test, score: Number(score), takenAt: takenAt || undefined }
  const validity = scoreValidity(draft?.takenAt, profile.admission_year, profile.expected_graduation_date)
  const equivalent = draft ? toeicEquivalent(draft) : null
  const meets = equivalent != null && validity.ok && equivalent >= toeicMinimum
  const dirty =
    (saved?.test ?? 'toeic') !== test || (saved ? String(saved.score) : '') !== score || (saved?.takenAt ?? '') !== takenAt

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft) return onSave(null, null)
    if (Number.isNaN(draft.score)) return
    onSave(draft, validity.ok ? toeicEquivalent(draft) : 0)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>시험</span>
          <select
            className={ui.select}
            value={test}
            onChange={(e) => {
              setTest(e.target.value as EnglishTestId)
              setScore('')
            }}
          >
            {ENGLISH_TESTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>{t.levels ? '등급' : '점수'}</span>
          {t.levels ? (
            <select className={ui.select} value={score} onChange={(e) => setScore(e.target.value)}>
              <option value="">선택</option>
              {t.levels.map((lv, i) => (
                <option key={lv} value={i}>
                  {lv}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={ui.input}
              type="number"
              inputMode="decimal"
              min={t.min}
              max={t.max}
              step={t.step}
              placeholder={`예: ${thresholdText(t, toeicMinimum)}`}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          )}
        </label>

        <label className={styles.field}>
          <span>응시일</span>
          <input className={ui.input} type="month" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
        </label>

        <button type="submit" className={dirty ? ui.button : ui.buttonGhost} disabled={!dirty}>
          {dirty ? (draft ? '저장' : '지우기') : saved ? '저장됨' : '저장'}
        </button>
      </div>

      <p className={ui.muted}>
        {t.label} 기준 <b>{thresholdText(t, toeicMinimum)}</b>
        {t.levels ? '' : '점'} 이상 = TOEIC {toeicMinimum} 해당{t.note ? ` · ${t.note}` : ''}
      </p>

      {draft && !Number.isNaN(draft.score) && (
        <p className={styles.result} data-ok={meets}>
          {t.label} {formatScore(draft)}
          {t.id === 'toeic' ? '' : equivalent ? ` → TOEIC ${equivalent} 해당` : ' → 환산 기준 미달'}
          {' · '}
          {meets ? '기준 충족' : validity.ok ? `TOEIC ${toeicMinimum} 기준 미달` : '인정 기간 밖'}
        </p>
      )}
      {validity.message && <p className={styles.warn}>{validity.message}</p>}
    </form>
  )
}

/** 기준 미달 시 대체 방법 (공지 원문) */
export function EnglishAlternativeNote() {
  return (
    <p className={ui.muted} style={{ lineHeight: 1.7 }}>
      공인영어성적증명서(발급번호로 진위 확인 가능, 화면 캡처 불가)를 제출해요. 졸업사정 자료 제출일 기준 2년 이내,
      입학 이후 취득 성적만 인정돼요. 기준을 못 채웠다면 기준 미달 영어성적표 3회 이상과 언어교육센터 영어 강좌
      120시간 이상 이수 증빙으로 대신할 수 있어요.
    </p>
  )
}
