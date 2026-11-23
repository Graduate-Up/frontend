import { fillGuideFor } from '@/content/fillGuides'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type {
  Course,
  EvaluationResponse,
  GraduationRule,
  NonacademicRecord,
  NonacademicRequirement,
  StudentProfile,
} from '@/api'
import { SubstitutionToggle } from '@/components/SubstitutionToggle'
import { EnglishSection } from '@/components/EnglishSection'
import { LiberalAreaPicker } from '@/components/LiberalAreaPicker'
import { StatusBadge, formatCredits, ui } from '@/components/ui'
import {
  FIELD_PRACTICE_ID,
  STARTUP_CREDITS_ID,
  SUBSTITUTIONS,
  appliedSubstitutions,
  chosenSubstitutions,
  fieldPracticeCourses,
  startupCourses,
  substitutionFor,
} from '@/content/substitutions'
import { useProfile, useStudent } from '@/state/useStudent'
import { PRACTICAL_ENGLISH_ID, isEnglishScoreRequirement } from '@/content/englishTests'
import { reasonText } from '@/constants/labels'
import styles from './NonacademicForm.module.css'

/** 한 번 확인하면 끝나는 항목 (졸업자격인정 등) */
const isCheckType = (req: NonacademicRequirement) => (req.minimum ?? 1) === 1 && !req.unit

/** 백엔드가 단위를 안 보내는 'N학점' 항목은 이름에서 단위를 읽는다 */
const unitOf = (req: NonacademicRequirement) => req.unit ?? (/\d+학점/.test(req.name) ? '학점' : '')

/** 입력칸 소수점 단위 — 평점은 0.01, 나머지는 정수 */
const stepFor = (req: NonacademicRequirement) => (Number.isInteger(req.minimum ?? 1) ? 1 : 0.01)

/** 이수 과목으로 서버가 계산하는 비교과 요건 (입력칸 없음) */
export const AUTO_COMPUTED_IDS = new Set([
  'gpa',
  'foundation_a',
  'foundation_b',
  'core_humanities',
  'core_science',
  'sdg',
  'abeek-basic_literacy',
  'abeek-msc',
  'abeek-engineering_major',
  'abeek-design_min',
])

/** 서버가 과목으로 자동 충족시켰는지 (예: 소프트웨어 졸업자격인정 대체 과목) */
const autoSatisfiedReason = (reason: string | undefined) =>
  !!reason && /이수|대체 과목/.test(reason) && !reason.startsWith('Compared')

export function NonacademicForm({
  rule,
  evaluation,
  records,
  onRecord,
  profile,
}: {
  rule: GraduationRule
  evaluation: EvaluationResponse | undefined
  records: NonacademicRecord[]
  onRecord: (requirementId: string, amount: number | null) => void
  profile: StudentProfile
}) {
  const { courses, checkMethods } = useStudent()
  const autoCourses: Record<string, Course[]> = {
    [FIELD_PRACTICE_ID]: fieldPracticeCourses(courses),
    [STARTUP_CREDITS_ID]: startupCourses(courses),
  }
  // 대체 인정을 고르면 근거 요건(창업 교과목)의 이름 · 기준이 판정 결과처럼 15학점으로 바뀐다
  const raisedSources = new Set(
    SUBSTITUTIONS.filter((x) => chosenSubstitutions(checkMethods).has(x.target)).map((x) => x.source),
  )
  const reqs = rule.nonacademic_requirements.map((r) => {
    const result = raisedSources.has(r.id) ? evaluation?.requirements.find((x) => x.id === r.id) : undefined
    return result ? { ...r, name: result.name, minimum: result.required } : r
  })
  if (!reqs.length) return <div className={ui.state}>이 학번 · 전공에는 입력할 비교과 요건이 없어요.</div>

  const manual = reqs.filter(
    (r) => !AUTO_COMPUTED_IDS.has(r.id) && !isEnglishScoreRequirement(r) && r.id !== PRACTICAL_ENGLISH_ID,
  )
  const auto = reqs.filter((r) => AUTO_COMPUTED_IDS.has(r.id))
  const numeric = manual.filter((r) => !isCheckType(r))
  const checks = manual.filter(isCheckType)
  const chosen = chosenSubstitutions(checkMethods)
  const substituted = appliedSubstitutions(profile.major, chosen)
  const resultOf = (id: string) => evaluation?.requirements.find((r) => r.id === id)
  const recordOf = (id: string) => records.find((r) => r.requirement_id === id)

  return (
    <>
      <EnglishSection rule={rule} profile={profile} evaluation={evaluation} />

      {numeric.length > 0 && (
        <section className={ui.card}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>횟수 · 학점</h2>
            <span className={ui.muted}>지금까지 쌓은 누계를 입력하세요</span>
          </div>
          <div className={styles.rows}>
            {numeric.map((req) => (
              <NumericRow
                key={req.id}
                req={req}
                record={recordOf(req.id)}
                status={resultOf(req.id)?.status}
                onSave={(v) => onRecord(req.id, v)}
                autoNote={
                  autoCourses[req.id]?.length
                    ? `이수 과목으로 자동 반영 (${formatCredits(autoCourses[req.id].reduce((n, c) => n + c.credits, 0))}학점): ${autoCourses[
                        req.id
                      ]
                        .map((c) => `${c.course_name ?? c.course_code} ${formatCredits(c.credits)}`)
                        .join(', ')}`
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {checks.length > 0 && (
        <section className={ui.card}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>취득 · 확인 여부</h2>
            <span className={ui.muted}>한 번 확인되면 끝나는 항목</span>
          </div>
          <div className={styles.rows}>
            {checks.map((req) => {
              const record = recordOf(req.id)
              const result = resultOf(req.id)
              const sub = substitutionFor(profile.major, req.id)
              const applied = substituted.get(req.id)
              const autoByCourse = !record && result?.status === 'satisfied' && autoSatisfiedReason(result.reason)
              return (
                <div key={req.id} className={styles.row}>
                  <RowInfo req={req} status={result?.status} notApplicable={result?.not_applicable} />
                  {autoByCourse && <span className={styles.hint}>이수 과목으로 자동 충족: {result!.reason}</span>}
                  {sub && (
                    <div className={styles.subRow}>
                      <SubstitutionToggle targetId={req.id} />
                    </div>
                  )}
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={!!record || !!applied || autoByCourse}
                      disabled={(!!applied || autoByCourse) && !record}
                      onChange={(e) => onRecord(req.id, e.target.checked ? (req.minimum ?? 1) : null)}
                    />
                    {autoByCourse ? '자동 충족' : applied && !record ? '확인 완료 (대체)' : '취득 · 확인 완료'}
                  </label>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <LiberalAreaPicker evaluation={evaluation} />

      {auto.length > 0 && (
        <section className={ui.card}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>이수 과목으로 자동 판정</h2>
            <span className={ui.muted}>과목 탭에 과목 · 성적을 넣으면 계산돼요</span>
          </div>
          <div className={styles.rows}>
            {auto.map((req) => {
              const result = resultOf(req.id)
              return (
                <div key={req.id} className={styles.row}>
                  <RowInfo req={req} status={result?.status} />
                  <span className={styles.autoValue}>
                    {result
                      ? `${formatCredits(result.current)} / ${formatCredits(result.required)}${req.id === 'gpa' ? '' : '학점'}`
                      : '-'}
                  </span>
                  {result && result.status !== 'satisfied' && (
                    <span className={styles.subHint}>
                      {(result.details?.length ? result.details : [reasonText(result.reason)]).join(' · ')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className={ui.muted}>
        입력한 기록은 판정에 바로 반영돼요. 로그인하면 서버에 저장되고, 둘러보기 중에는 이 브라우저에만 저장돼요. 증빙은
        학부에 따로 제출해야 해요.
      </p>
    </>
  )
}

function RowInfo({
  req,
  status,
  notApplicable,
}: {
  req: NonacademicRequirement
  status?: EvaluationResponse['status']
  notApplicable?: boolean
}) {
  return (
    <div className={styles.info}>
      <div className={styles.name}>
        <Link to={`/requirements/${encodeURIComponent(req.id)}`}>{req.name}</Link>
        {status && <StatusBadge status={status} notApplicable={notApplicable} />}
      </div>
      <span className={ui.muted}>
        {isCheckType(req) ? '' : `기준 ${formatCredits(req.minimum ?? 1)}${unitOf(req)} 이상`}
        {!isCheckType(req) && req.details?.[0] ? ' · ' : ''}
        {req.details?.[0] ?? ''}
      </span>
    </div>
  )
}

function NumericRow({
  req,
  record,
  status,
  onSave,
  autoNote,
}: {
  req: NonacademicRequirement
  record: NonacademicRecord | undefined
  status?: EvaluationResponse['status']
  onSave: (amount: number | null) => void
  autoNote?: string
}) {
  const profile = useProfile()
  const guideLink = fillGuideFor(req.id, profile.major)?.link
  const saved = record ? String(record.amount) : ''
  const [value, setValue] = useState(saved)
  const dirty = value !== saved

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (value.trim() === '') return onSave(null)
    const n = Number(value)
    if (Number.isNaN(n) || n < 0) return
    onSave(n)
  }

  return (
    <form className={styles.row} onSubmit={handleSubmit}>
      <RowInfo req={req} status={status} />
      {autoNote && <span className={styles.hint}>{autoNote}</span>}
      {guideLink && (
        <a className={styles.guideLink} href={guideLink.url} target="_blank" rel="noreferrer">
          {guideLink.label} ↗
        </a>
      )}
      <div className={styles.inputWrap}>
        <input
          className={ui.input}
          type="number"
          inputMode="decimal"
          min={0}
          step={stepFor(req)}
          placeholder="미입력"
          aria-label={`${req.name} 누계`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className={styles.unit}>{unitOf(req)}</span>
        <button type="submit" className={dirty ? ui.button : ui.buttonGhost} disabled={!dirty}>
          {dirty ? '저장' : record ? '저장됨' : '저장'}
        </button>
      </div>
    </form>
  )
}
