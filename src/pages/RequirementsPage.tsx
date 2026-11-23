import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { EvaluationResponse, GraduationRule, JudgementStatus } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  ErrorState,
  Loading,
  ProgressBar,
  RequiredCourseBadge,
  isNotNeeded,
  ScopeBadge,
  Sources,
  StatusBadge,
  formatAmount,
  formatCredits,
  ui,
} from '@/components/ui'
import { reasonText } from '@/constants/labels'
import { useEvaluation, useMyProgramName, useRequirements } from '@/state/queries'
import {
  GROUP_LABEL,
  GROUP_ORDER,
  buildRequirementViews,
  majorTitle,
  profileSummary,
  type RequirementView,
} from '@/state/requirementView'
import { useProfile, useStudent } from '@/state/useStudent'
import { SubstitutionToggle } from '@/components/SubstitutionToggle'
import { chosenSubstitutions } from '@/content/substitutions'
import { useHashScroll } from '@/state/useHashScroll'
import styles from './RequirementsPage.module.css'

type Filter = 'all' | 'unsatisfied' | 'pending' | 'satisfied'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'unsatisfied', label: '미충족 · 진행 전' },
  { key: 'pending', label: '확인 필요' },
  { key: 'satisfied', label: '충족' },
]

const PENDING: JudgementStatus[] = ['approval_required', 'verification_required']

function matches(filter: Filter, v: RequirementView) {
  const s = v.result.status
  if (filter === 'all') return true
  if (filter === 'pending') return PENDING.includes(s)
  return s === filter
}

export function RequirementsPage() {
  const profile = useProfile()
  const { courses, records } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  // 사이드바 소메뉴(#req-credit 등)로 들어오면 판정이 그려진 뒤 그 그룹으로 스크롤
  useHashScroll(!!evaluation.data)

  return (
    <>
      <PageHeader
        crumbs={[{ label: '내 졸업 현황', to: '/' }, { label: '나의 졸업요건' }]}
        right={evaluation.status === 'loading' && evaluation.data ? '다시 계산 중…' : undefined}
      />
      <div className={ui.page}>
        <div className={styles.intro}>
          <div>
            <h1 className={ui.heading}>나의 졸업요건</h1>
            <p className={ui.lead}>
              {majorTitle(profile)} 기준으로, 내가 입력한 이수 내역 · 비교과 기록을 넣어 판정했어요.
            </p>
          </div>
          <Link to="/onboarding" className={ui.buttonGhost}>
            학적 변경
          </Link>
        </div>

        {evaluation.status === 'loading' && !evaluation.data && <Loading label="판정 중…" />}
        {evaluation.status === 'error' && <ErrorState error={evaluation.error} />}
        {evaluation.data && <MyRequirements rule={rule.data} result={evaluation.data} courseCount={courses.length} />}
      </div>
    </>
  )
}

function MyRequirements({
  rule,
  result,
  courseCount,
}: {
  rule: GraduationRule | undefined
  result: EvaluationResponse
  courseCount: number
}) {
  const profile = useProfile()
  const programLabel = useMyProgramName()
  const [filter, setFilter] = useState<Filter>('all')
  const views = buildRequirementViews(rule, result, profile)
  const count = (f: Filter) => views.filter((v) => matches(f, v)).length
  const visible = views.filter((v) => matches(filter, v))
  const groups = GROUP_ORDER.map((g) => ({ group: g, items: visible.filter((v) => v.group === g) })).filter(
    (g) => g.items.length,
  )

  return (
    <>
      {/* 상태별 요약 = 필터 */}
      <div className={styles.summary} role="tablist" aria-label="판정 상태로 보기">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={styles.tab}
            data-kind={f.key}
            onClick={() => setFilter(f.key)}
          >
            <span>{f.label}</span>
            <strong>{count(f.key)}</strong>
          </button>
        ))}
      </div>

      <div className={styles.basis}>
        <strong>{majorTitle(profile)}</strong>
        <span>{profileSummary(profile, programLabel)}</span>
        {courseCount === 0 && (
          <Link to="/courses" className={styles.basisLink}>
            이수 내역을 입력하면 판정이 정확해져요 ›
          </Link>
        )}
      </div>

      {groups.length === 0 && (
        <div className={ui.state}>
          {filter === 'unsatisfied'
            ? '미충족 요건이 없어요.'
            : filter === 'pending'
              ? '확인이 필요한 요건이 없어요.'
              : '해당하는 요건이 없어요.'}
        </div>
      )}

      {groups.map(({ group, items }) => (
        <section key={group} id={`req-${group}`} className={`${ui.card} ${styles.groupSection}`}>
          <div className={styles.groupHead}>
            <h2 className={ui.cardTitle}>{GROUP_LABEL[group]}</h2>
            <span className={ui.muted}>
              {items.filter((v) => v.result.status === 'satisfied').length} / {items.length} 충족
            </span>
          </div>
          <div className={styles.items}>
            {items.map((v) => (
              <RequirementItem key={v.id} view={v} />
            ))}
          </div>
        </section>
      ))}

      {!!rule?.notes?.length && (
        <section className={ui.card}>
          <h2 className={ui.cardTitle}>적용 기준 참고</h2>
          <ul className={styles.notes}>
            {rule.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <Link to="/notices" className={ui.textLink} style={{ marginTop: 12 }}>
            근거 공지 {rule.sources.length}개 모아보기 ›
          </Link>
        </section>
      )}
    </>
  )
}

function RequirementItem({ view }: { view: RequirementView }) {
  const { checkMethods } = useStudent()
  // 대체를 고른 상태면 충족돼도 취소할 수 있게 버튼을 남긴다
  const substitutionChosen = chosenSubstitutions(checkMethods).has(view.id)
  const r = view.result
  const numeric = view.group !== 'verification' && !(view.group === 'nonacademic' && r.required === 1 && !view.unit)

  return (
    <article className={styles.item} data-status={view.notStarted ? 'not_started' : r.status}>
      <div className={styles.itemHead}>
        <div className={styles.itemTitle}>
          <ScopeBadge scope={view.scope} />
          <h3>{view.name}</h3>
          <StatusBadge
            status={r.status}
            notStarted={view.notStarted}
            notApplicable={r.not_applicable}
            later={view.later}
          />
        </div>
        <Link to={`/requirements/${encodeURIComponent(view.id)}`} className={styles.more}>
          자세히 ›
        </Link>
      </div>

      {numeric ? (
        <div className={styles.progress}>
          <span className={styles.value}>
            <b>{formatAmount(r.current, r.id)}</b> / {formatAmount(r.required, r.id)}
            {view.unit}
          </span>
          <div className={styles.bar}>
            <ProgressBar
              value={r.required ? r.current / r.required : 0}
              tone={r.status === 'unsatisfied' ? 'bad' : undefined}
            />
          </div>
          <span className={styles.gap} data-done={r.shortfall <= 0}>
            {r.shortfall > 0 ? `${formatAmount(r.shortfall, r.id)}${view.unit} 남음` : '채움'}
          </span>
        </div>
      ) : (
        <p className={styles.value}>
          <b data-missing={view.valueText === '미제출' || undefined}>{view.valueText}</b>
        </p>
      )}

      <p className={styles.reason}>{statusMessage(view)}</p>
      {view.result.status !== 'satisfied' || substitutionChosen ? <SubstitutionToggle targetId={view.id} /> : null}

      {!!r.required_courses?.length && (
        <ul className={styles.courses}>
          {r.required_courses.map((c) => (
            <li key={c.course_code} data-status={isNotNeeded(r.status, c.status) ? 'not_needed' : c.status}>
              <RequiredCourseBadge status={c.status} notNeeded={isNotNeeded(r.status, c.status)} />
              <span className={styles.courseName}>{c.course_name}</span>
              <span className={ui.muted}>{c.course_code}</span>
              {isNotNeeded(r.status, c.status) && <small className={styles.notNeeded}>채울 필요 없어요.</small>}
            </li>
          ))}
        </ul>
      )}

      {view.details.length > 1 && (
        <details className={styles.details}>
          <summary>상세 기준 {view.details.length}개</summary>
          <ul>
            {view.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}

      <Sources sources={view.sources} />
    </article>
  )
}

/** 내 상황을 한 문장으로 */
function statusMessage(view: RequirementView): string {
  const r = view.result
  if (view.later) return '졸업 직전 학기에 하면 돼요. 지금은 안 해도 괜찮아요.'
  const unit = view.unit
  switch (r.status) {
    case 'satisfied':
      return '이 요건은 채웠어요.'
    case 'approval_required':
      return `학부 승인이 필요해요. ${reasonText(r.reason)}`
    case 'verification_required':
      return view.group === 'verification'
        ? '자동으로 판정할 수 없는 항목이에요. 학부 사무실에 확인해주세요.'
        : `확인이 필요한 부분이 있어요. ${reasonText(r.reason)}`
    default:
      if (view.group === 'course') {
        const missing = r.required_courses?.filter((c) => c.status === 'missing').length ?? 0
        return missing ? `아직 안 들은 과목이 ${missing}개 있어요.` : `${formatCredits(r.shortfall)}과목이 더 필요해요.`
      }
      if (view.group === 'nonacademic' && r.required === 1 && !unit)
        return '아직 기록하지 않았어요. 취득했다면 자세히에서 표시해주세요.'
      if (r.current === 0) return `아직 시작 전이에요. ${formatAmount(r.required, r.id)}${unit}이 필요해요.`
      return `${formatAmount(r.shortfall, r.id)}${unit} 더 채워야 해요.`
  }
}
