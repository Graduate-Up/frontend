import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryBadge, ErrorState, Loading, PageIntro, Sources, formatCredits, ui } from '@/components/ui'
import { hiddenCreditChecks, type HiddenCheck } from '@/state/hiddenCredits'
import { retakeCandidates, type RetakeSummary } from '@/state/retake'
import { useEvaluation, useGraduationSchedule, useRequirements } from '@/state/queries'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './HiddenCreditsPage.module.css'

export function HiddenCreditsPage() {
  const profile = useProfile()
  const { courses, records } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  const schedule = useGraduationSchedule(profile)
  const change = schedule.data ? { change: schedule.data.classification_change, major: profile.major } : undefined
  const checks = rule.data && evaluation.data ? hiddenCreditChecks(rule.data, evaluation.data, courses, change) : null
  const found = checks?.filter((c) => c.found) ?? []
  const info = checks?.filter((c) => c.info) ?? []
  const clear = checks?.filter((c) => !c.found && !c.info) ?? []
  const error = rule.error ?? evaluation.error

  return (
    <>
      <PageHeader crumbs={[{ label: '숨은 학점' }]} />
      <div className={ui.page}>
        {error ? <ErrorState error={error} /> : !checks && <Loading label="판정 중…" />}
        {checks && (
          <>
            <PageIntro
              heading={found.length ? `채울 수 있는데 놓친 학점, ${found.length}건 찾았어요` : '놓친 학점이 없어요'}
              lead={`다시 듣기 전에 신청만으로 해결되는지 먼저 확인하세요. ${checks.length}가지 항목을 검사했어요.`}
            />
            {courses.length === 0 && (
              <p className={styles.empty}>
                이수 과목을 넣으면 검사할 수 있어요. <Link to="/courses">이수 내역 입력하기 →</Link>
              </p>
            )}
            {found.map((c) => (
              <FoundCard key={c.id} check={c} />
            ))}
            <RetakeCard summary={retakeCandidates(courses, rule.data)} />
            {info.length > 0 && (
              <>
                <h2 className={styles.clearTitle}>참고</h2>
                <div className={styles.clearGrid}>
                  {info.map((c) => (
                    <div key={c.id} className={styles.clearCard} data-info>
                      <b>
                        <span aria-hidden>!</span> {c.title}
                      </b>
                      <p>{c.body}</p>
                      {c.courses && (
                        <p className={ui.muted}>
                          {c.courses.map((x) => `${x.name} ${formatCredits(x.credits)}학점`).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {clear.length > 0 && (
              <>
                <h2 className={styles.clearTitle}>이상 없는 항목</h2>
                <div className={styles.clearGrid}>
                  {clear.map((c) => (
                    <div key={c.id} className={styles.clearCard}>
                      <b>
                        <span aria-hidden>✓</span> {c.title}
                      </b>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

function FoundCard({ check }: { check: HiddenCheck }) {
  return (
    <section className={styles.found}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.tag}>발견 · {check.tag}</span>
          <h2>{check.title}</h2>
        </div>
        {check.result && <span className={styles.result}>{check.result}</span>}
      </div>
      <p className={styles.body}>{check.body}</p>

      {check.courses && check.courses.length > 0 && (
        <ul className={styles.courses}>
          {check.courses.map((c) => (
            <li key={`${c.code}@${c.semester}`}>
              <b>{c.name}</b>
              <span className={ui.muted}>
                {c.code} · {formatCredits(c.credits)}학점 · {c.semester}
              </span>
              <CategoryBadge category={c.category} code={c.code} />
            </li>
          ))}
        </ul>
      )}

      {check.steps && (
        <ol className={styles.steps}>
          {check.steps.map((s, i) => (
            <li key={s.title}>
              <span>STEP {i + 1}</span>
              <b>{s.title}</b>
              <small>{s.sub}</small>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.foot}>
        <Sources sources={check.sources} />
        {check.action?.href && (
          <a href={check.action.href} className={ui.button} target="_blank" rel="noreferrer">
            {check.action.label} ↓
          </a>
        )}
        {check.action?.to && (
          <Link to={check.action.to} className={ui.buttonGhost}>
            {check.action.label}
          </Link>
        )}
      </div>
    </section>
  )
}

const gpaText = (v: number | null) => (v == null ? '-' : v.toFixed(2))

/** 재이수하면 좋을 과목 — 신청만으로는 못 살리지만 다시 들으면 학점 · 평점이 오르는 과목 */
function RetakeCard({ summary }: { summary: RetakeSummary }) {
  const { candidates, gpa, gpaIfAll, assumedGrade } = summary
  if (!candidates.length) return null
  const failedCredits = candidates.filter((c) => c.failed).reduce((n, c) => n + c.credits, 0)
  return (
    <section className={styles.retake}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.retakeTag}>재이수 추천 · {candidates.length}과목</span>
          <h2>다시 들으면 좋은 과목</h2>
        </div>
        {gpa != null && gpaIfAll != null && (
          <span className={styles.retakeResult}>
            평점 {gpaText(gpa)} → 최대 {gpaText(gpaIfAll)}
          </span>
        )}
      </div>
      <p className={styles.body}>
        재이수할 수 있는 B- 이하 과목이에요. 재이수하면 <b>마지막 성적만</b> 남아요
        {failedCredits > 0 && `. F 과목을 다시 들어 통과하면 ${formatCredits(failedCredits)}학점이 더 생겨요`}. 평점은
        각 과목을 재이수 성적 상한인 {assumedGrade}로 받는다고 가정해 계산했어요.
      </p>
      <ul className={styles.courses}>
        {candidates.map((c) => (
          <li key={`${c.code}@${c.semester}`}>
            <b>{c.name}</b>
            <span className={ui.muted}>
              {c.code} · {formatCredits(c.credits)}학점 · {c.semester}
            </span>
            <CategoryBadge category={c.category} code={c.code} />
            <span className={styles.grade} data-failed={c.failed || undefined}>
              {c.grade}
            </span>
            {c.failed && <span className={styles.reason}>+{formatCredits(c.credits)}학점</span>}
            {c.required && <span className={styles.reason}>필수과목</span>}
            <span className={styles.gain}>평점 +{c.gpaGain.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.retakeNote}>
        폐지된 과목은 동일과목으로 재이수할 수 있으니 수강 신청 전에 학부 사무실에 확인하세요.
      </p>
    </section>
  )
}
