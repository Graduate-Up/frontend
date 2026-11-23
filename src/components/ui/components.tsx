import type { ReactNode } from 'react'
import type { JudgementStatus, RequiredCourseResult, Source } from '@/api'
import { JUDGEMENT_LABEL, REQUIRED_COURSE_LABEL } from '@/constants/labels'
import { classifyCategory, isStartupCourse, type CourseKind } from '@/state/courseCategory'
import { errorText } from './helpers'
import styles from './ui.module.css'

export type Tone = 'good' | 'bad' | 'warn' | 'check' | 'neutral' | 'info'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`tone-${tone}`]}`}>{children}</span>
}

const JUDGEMENT_TONE: Record<JudgementStatus, Tone> = {
  satisfied: 'good',
  unsatisfied: 'bad',
  approval_required: 'warn',
  verification_required: 'check',
}

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.pill} ${styles[`tone-${tone}`]}`}>{children}</span>
}

/**
 * notStarted: 아직 아무것도 채우지 않은 항목은 '진행 전'으로 보여준다
 * notApplicable: 다른 요건으로 대체해서 해당 없는 항목은 회색 '미해당'
 */
export function StatusBadge({
  status,
  notStarted = false,
  notApplicable = false,
}: {
  status: JudgementStatus
  notStarted?: boolean
  notApplicable?: boolean
}) {
  if (notApplicable) return <Pill tone="neutral">미해당</Pill>
  if (status === 'unsatisfied' && notStarted) return <Pill tone="neutral">진행 전</Pill>
  return <Pill tone={JUDGEMENT_TONE[status]}>{JUDGEMENT_LABEL[status]}</Pill>
}

const REQUIRED_TONE: Record<RequiredCourseResult['status'], Tone> = {
  completed: 'good',
  in_progress: 'info',
  missing: 'bad',
  approval_required: 'warn',
  verification_required: 'check',
}

/** notNeeded: 택1 요건을 이미 채워서 안 들어도 되는 과목 — 회색으로 */
export function RequiredCourseBadge({
  status,
  notNeeded = false,
}: {
  status: RequiredCourseResult['status']
  notNeeded?: boolean
}) {
  return <Pill tone={notNeeded ? 'neutral' : REQUIRED_TONE[status]}>{REQUIRED_COURSE_LABEL[status]}</Pill>
}

export function ProgressBar({ value, tone }: { value: number; tone?: 'bad' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={styles.barFill} data-tone={tone} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Sources({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null
  return (
    <div className={styles.sources}>
      <span>근거</span>
      {sources.map((s, i) =>
        s.url ? (
          <a key={i} href={s.url} target="_blank" rel="noreferrer">
            {s.title}
            {s.reference ? ` · ${s.reference}` : ''}
          </a>
        ) : (
          <span key={i}>
            {s.title}
            {s.reference ? ` · ${s.reference}` : ''}
          </span>
        ),
      )}
    </div>
  )
}

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return <div className={styles.state}>{label}</div>
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  return (
    <div className={`${styles.state} ${styles.stateError}`} role="alert">
      {errorText(error)}
      {action}
    </div>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      {children}
      {action}
    </div>
  )
}

export function PageIntro({ heading, lead, right }: { heading: string; lead?: ReactNode; right?: ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <div>
        <h1 className={styles.heading}>{heading}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {right}
    </div>
  )
}

const KIND_CLASS: Record<CourseKind, string> = {
  major: 'kind-major',
  liberal: 'kind-liberal',
  general: 'kind-general',
  startup: 'kind-startup',
  multi: 'kind-multi',
  other: 'kind-other',
}

/** 성적표 교과구분 뱃지 — 전공 · 교양 · 일반 · 창업 · 다전공을 색으로 구분 */
export function CategoryBadge({ category, code }: { category: string; code?: string }) {
  const kind = classifyCategory(category, code)
  return (
    <span className={styles.chipRow}>
      <span className={`${styles.badge} ${styles[KIND_CLASS[kind]]}`} title={`성적표 교과구분: ${category}`}>
        {kind === 'startup' ? '창업' : category}
      </span>
      {kind !== 'startup' && isStartupCourse(code) && (
        <span className={`${styles.badge} ${styles['kind-startup']}`} title="창업 교과목 학점에 들어가요">
          창업
        </span>
      )}
    </span>
  )
}

/** 요건을 정한 곳 라벨 — 경북대(학교 전체) · 컴퓨터학부 */
export function ScopeBadge({ scope }: { scope: 'university' | 'department' }) {
  return (
    <span
      className={`${styles.scope} ${styles[`scope-${scope}`]}`}
      title={scope === 'university' ? '경북대 전체 졸업 규정' : '컴퓨터학부 졸업요건'}
    >
      {scope === 'university' ? '경북대' : '컴퓨터학부'}
    </span>
  )
}
