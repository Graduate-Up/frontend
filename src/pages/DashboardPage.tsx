import { Link } from 'react-router-dom'
import type { EvaluationResponse, GraduationRule, StudentProfile } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { HighlightCard, InfoCard, RoadmapCard } from '@/components/side/GuideCards'
import { InquiryCard } from '@/components/side/SideCards'
import { ErrorState, Loading, Pill, ScopeBadge, StatusBadge, formatCredits, ui } from '@/components/ui'
import { useEvaluation, useRequirements } from '@/state/queries'
import {
  GROUP_LABEL,
  GROUP_ORDER,
  buildRequirementViews,
  headline,
  majorTitle,
  profileSummary,
  type RequirementView,
} from '@/state/requirementView'
import { sortSourcesForMajor } from '@/state/sources'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const profile = useProfile()
  const { courses, records, displayName, studentNumber } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)

  return (
    <>
      <PageHeader
        crumbs={[{ label: '내 졸업 현황' }]}
        right={evaluation.status === 'loading' && evaluation.data ? '다시 계산 중…' : undefined}
      />
      <div className={ui.page}>
        {evaluation.status === 'loading' && !evaluation.data && <Loading label="판정 중…" />}
        {evaluation.status === 'error' && <ErrorState error={evaluation.error} />}
        {evaluation.data && (
          <Dashboard
            profile={profile}
            displayName={displayName}
            studentNumber={studentNumber}
            courseCount={courses.length}
            rule={rule.data}
            result={evaluation.data}
          />
        )}
      </div>
    </>
  )
}

function Dashboard({
  profile,
  displayName,
  studentNumber,
  courseCount,
  rule,
  result,
}: {
  profile: StudentProfile
  displayName: string
  studentNumber: string | null
  courseCount: number
  rule: GraduationRule | undefined
  result: EvaluationResponse
}) {
  const views = buildRequirementViews(rule, result)
  const head = courseCount
    ? headline(result, views)
    : { title: '들은 과목을 입력하면 판정을 시작해요', sub: '지금은 내 학적 기준으로 채워야 할 요건만 보여드려요.' }
  const groups = GROUP_ORDER.map((g) => ({ group: g, items: views.filter((v) => v.group === g) })).filter(
    (g) => g.items.length,
  )

  return (
    <>
      <div>
        <p className={ui.eyebrow}>MY GRADUATION / {displayName}</p>
        <h1 className={styles.title}>{head.title}</h1>
        <p className={ui.lead}>{head.sub}</p>
      </div>

      <div className={styles.profileBar}>
        <strong>{majorTitle(profile)}</strong>
        <span>{profileSummary(profile)}</span>
        <span className={styles.progressChip} title="요건마다 같은 비중으로 계산한 진행률 (서버 기준)">
          졸업 진행률 <b>{formatCredits(result.progress)}%</b>
        </span>
        <Link to="/onboarding" className={styles.profileLink}>
          학적 변경 ›
        </Link>
      </div>

      <div className={ui.split}>
        <div className={ui.stack}>
          <CreditSummary views={views} rule={rule} majorCode={profile.major} />

          {courseCount === 0 && (
            <div className={ui.highlight}>
              <h2>이수 내역부터 채워주세요</h2>
              <p className={ui.sub} style={{ marginTop: 8 }}>
                과목코드 · 학점 · 교과구분만 넣으면 요건마다 충족 여부를 바로 계산해요.
              </p>
              <Link to="/courses" className={ui.button} style={{ marginTop: 16, background: 'var(--color-teal-dark)' }}>
                이수 내역 입력 +
              </Link>
            </div>
          )}

          <section className={ui.card}>
            <div className={styles.listHead}>
              <h2 className={ui.cardTitle}>나의 졸업요건</h2>
              <span className={ui.muted}>
                {groups.length}개 영역 · {views.length}개 항목
              </span>
            </div>
            {groups.map(({ group, items }, gi) => (
              <div key={group} className={styles.group}>
                <div className={styles.groupHead}>
                  {String(gi + 1).padStart(2, '0')} {GROUP_LABEL[group]}
                  {group === 'course' && ` · ${items.reduce((n, v) => n + v.result.required, 0)}과목`}
                  {group === 'nonacademic' && (
                    <Link to="/courses?tab=nonacademic" className={styles.groupLink}>
                      기록 입력 ›
                    </Link>
                  )}
                </div>
                {items.map((v) => (
                  <RequirementRow key={v.id} view={v} />
                ))}
              </div>
            ))}
          </section>

          <p className={styles.footnote}>
            {result.dataset === 'test' && '테스트 데이터 기준 판정이에요. '}
            요건 기준은 {majorTitle(profile)} 졸업요건을 따라요.
            <br />
            최종 졸업 판정은 학부 확인이 필요합니다.
          </p>
        </div>

        <div className={ui.stack}>
          <RoadmapCard profile={profile} />
          <HighlightCard profile={profile} views={views} />
          <InfoCard profile={profile} sources={rule?.sources ?? []} />
          <PendingCard views={views} />
          <InquiryCard profile={profile} studentNumber={studentNumber} />
        </div>
      </div>
    </>
  )
}

function RequirementRow({ view }: { view: RequirementView }) {
  return (
    <Link to={`/requirements/${encodeURIComponent(view.id)}`} className={styles.row}>
      <div className={styles.rowName}>
        <strong>
          <ScopeBadge scope={view.scope} /> {view.name}
        </strong>
        {view.sub && <span>{view.sub}</span>}
      </div>
      <span className={styles.rowValue}>{view.valueText}</span>
      <span className={styles.rowStatus}>
        <StatusBadge status={view.result.status} notStarted={view.notStarted} />
      </span>
    </Link>
  )
}

/** 학점 요약 + 구성 막대 */
function CreditSummary({
  views,
  rule,
  majorCode,
}: {
  views: RequirementView[]
  rule: GraduationRule | undefined
  majorCode: StudentProfile['major']
}) {
  // 총 졸업학점 요건의 근거 중 내 전공 공지
  const totalSources = views.find((v) => v.result.credit_area === 'total')?.sources ?? rule?.sources ?? []
  const mainSource = sortSourcesForMajor(totalSources, majorCode)[0]
  const byArea = (area: string) => views.find((v) => v.result.credit_area === area)?.result
  const total = byArea('total')
  const major = byArea('major')
  const liberal = byArea('liberal_arts')
  const courseViews = views.filter((v) => v.group === 'course')
  const coursesDone = courseViews.reduce((n, v) => n + Math.min(v.result.current, v.result.required), 0)
  const coursesReq = courseViews.reduce((n, v) => n + v.result.required, 0)

  if (!total) return null

  const totalReq = Math.max(total.required, 1)
  const otherReq = Math.max(0, total.required - (major?.required ?? 0) - (liberal?.required ?? 0))
  const otherCur = Math.max(0, total.current - (major?.current ?? 0) - (liberal?.current ?? 0))
  const segments = [
    { key: 'major', label: '전공', cur: major?.current ?? 0, req: major?.required ?? 0, cls: styles.segMajor },
    { key: 'liberal', label: '교양', cur: liberal?.current ?? 0, req: liberal?.required ?? 0, cls: styles.segLiberal },
    { key: 'other', label: '그 외', cur: otherCur, req: otherReq, cls: styles.segOther },
  ].filter((s) => s.req > 0 || s.cur > 0)

  return (
    <section className={ui.card}>
      <div className={styles.metrics}>
        <div>
          <span className={styles.metricLabel}>이수 학점</span>
          <p className={styles.metric}>
            {formatCredits(total.current)}
            <small> / {formatCredits(total.required)}학점</small>
          </p>
        </div>
        {coursesReq > 0 && (
          <div style={{ textAlign: 'right' }}>
            <span className={styles.metricLabel}>필수 과목</span>
            <p className={`${styles.metric} ${styles.metricTeal}`}>
              {formatCredits(coursesDone)}
              <small> / {formatCredits(coursesReq)}과목</small>
            </p>
          </div>
        )}
      </div>

      <p className={styles.compTitle}>학점 구성 · {formatCredits(total.required)}학점</p>
      <div className={styles.stacked}>
        {segments.map((s) => {
          const size = Math.max(s.req, s.cur, 1)
          return (
            <div key={s.key} className={s.cls} style={{ flexGrow: size / totalReq }}>
              <div className={styles.segFill} style={{ width: `${(Math.min(s.cur, size) / size) * 100}%` }} />
            </div>
          )
        })}
      </div>
      <div className={styles.legend}>
        {segments.map((s) => (
          <span key={s.key} className={s.cls}>
            <i />
            {s.label} {formatCredits(s.cur)} / {formatCredits(s.req)}
          </span>
        ))}
      </div>
      {mainSource && (
        <p className={ui.muted} style={{ marginTop: 14 }}>
          근거:{' '}
          {mainSource.url ? (
            <a href={mainSource.url} target="_blank" rel="noreferrer">
              {mainSource.title} ↗
            </a>
          ) : (
            mainSource.title
          )}
        </p>
      )}
    </section>
  )
}

/** 승인 · 확인이 필요한 항목 */
function PendingCard({ views }: { views: RequirementView[] }) {
  const pending = views.filter(
    (v) => v.result.status === 'approval_required' || v.result.status === 'verification_required',
  )
  if (!pending.length) return null
  return (
    <aside className={ui.sideCard}>
      <h3>확인이 필요한 항목 {pending.length}개</h3>
      <p className={ui.sub} style={{ marginTop: 6 }}>
        자동으로 판정할 수 없어 학부 확인이나 승인이 필요해요.
      </p>
      <ul className={styles.pendingList}>
        {pending.slice(0, 5).map((v) => (
          <li key={v.id}>
            <Link to={`/requirements/${encodeURIComponent(v.id)}`}>{v.name}</Link>
            <Pill tone={v.result.status === 'approval_required' ? 'warn' : 'check'}>
              {v.result.status === 'approval_required' ? '승인' : '확인'}
            </Pill>
          </li>
        ))}
      </ul>
      {pending.length > 5 && (
        <p className={ui.muted} style={{ marginTop: 8 }}>
          외 {pending.length - 5}개
        </p>
      )}
    </aside>
  )
}
