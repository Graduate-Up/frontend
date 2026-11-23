import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { CreditEntry, EvaluationResponse, GraduationRule, NonacademicRecord, StudentProfile } from '@/api'
import { FILL_GUIDES } from '@/content/fillGuides'
import { PageHeader } from '@/components/layout/PageHeader'
import { EnglishSection } from '@/components/EnglishSection'
import { LiberalAreaPicker } from '@/components/LiberalAreaPicker'
import { AUTO_COMPUTED_IDS } from '@/components/NonacademicForm'
import { InquiryCard, SideCard, SourceCard } from '@/components/side/SideCards'
import { PRACTICAL_ENGLISH_ID, isEnglishScoreRequirement } from '@/content/englishTests'
import { appliedSubstitutions, substitutionFor } from '@/content/substitutions'
import {
  EmptyState,
  ErrorState,
  Loading,
  ProgressBar,
  RequiredCourseBadge,
  StatusBadge,
  formatCredits,
  ui,
} from '@/components/ui'
import { CREDIT_AREA_LABEL, reasonText } from '@/constants/labels'
import { courseNameMap, useEvaluation, useRequirements } from '@/state/queries'
import {
  buildRequirementViews,
  entriesForArea,
  majorTitle,
  profileSummary,
  type RequirementView,
} from '@/state/requirementView'
import { sortSourcesForMajor } from '@/state/sources'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './RequirementDetailPage.module.css'

const PREVIEW_ROWS = 6

export function RequirementDetailPage() {
  const { id = '' } = useParams()
  const profile = useProfile()
  const { courses, records, setRecord, studentNumber } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)

  const views = evaluation.data ? buildRequirementViews(rule.data, evaluation.data) : []
  const view = views.find((v) => v.id === id)

  return (
    <>
      <PageHeader
        crumbs={[
          { label: '내 졸업 현황', to: '/' },
          { label: '나의 졸업요건', to: '/requirements' },
          { label: view?.name ?? '요건 상세' },
        ]}
      />
      <div className={ui.page}>
        {evaluation.status === 'loading' && !evaluation.data && <Loading />}
        {evaluation.status === 'error' && <ErrorState error={evaluation.error} />}
        {evaluation.data && !view && (
          <EmptyState
            action={
              <Link to="/" className={ui.buttonGhost}>
                내 졸업 현황으로
              </Link>
            }
          >
            이 요건은 지금 학적 기준에 없어요.
          </EmptyState>
        )}
        {view && evaluation.data && (
          <Detail
            view={view}
            rule={rule.data}
            entries={evaluation.data.credit_entries}
            evaluation={evaluation.data}
            profile={profile}
            studentNumber={studentNumber}
            record={records.find((x) => x.requirement_id === view.id)}
            onRecord={(amount) => setRecord(view.id, amount)}
          />
        )}
      </div>
    </>
  )
}

function Detail({
  view,
  rule,
  entries,
  profile,
  studentNumber,
  record,
  onRecord,
  evaluation,
}: {
  evaluation: EvaluationResponse
  view: RequirementView
  rule: GraduationRule | undefined
  entries: CreditEntry[]
  profile: StudentProfile
  studentNumber: string | null
  record: NonacademicRecord | undefined
  onRecord: (amount: number | null) => void
}) {
  const r = view.result
  const area = r.credit_area
  const names = courseNameMap(rule)
  const [showAllPending, setShowAllPending] = useState(false)
  const split = area ? entriesForArea(area, entries, rule?.major_transcript_categories ?? []) : null
  const pendingCredits = split?.pending.reduce((n, e) => n + (e.recognized_credits || 0), 0) ?? 0
  const { records } = useStudent()
  const substitution = substitutionFor(profile.major, view.id)
  const substitutionApplied = appliedSubstitutions(profile.major, records).has(view.id)
  const substitutionAmount = substitution
    ? (records.find((x) => x.requirement_id === substitution.source)?.amount ?? 0)
    : 0
  const showNumber = view.group !== 'verification' && !(view.group === 'nonacademic' && r.required === 1 && !view.unit)

  return (
    <div className={ui.split}>
      <div className={ui.stack}>
        {/* 요약 */}
        <section className={ui.card}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{view.name}</h1>
            <StatusBadge status={r.status} notStarted={view.notStarted} />
          </div>
          {showNumber ? (
            <>
              <p className={styles.big}>
                {formatCredits(r.current)}
                <small>
                  {' '}
                  / {formatCredits(r.required)}
                  {view.unit}
                </small>
                {r.shortfall > 0 && (
                  <em>
                    {formatCredits(r.shortfall)}
                    {view.unit} 부족
                  </em>
                )}
              </p>
              <div style={{ marginTop: 18 }}>
                <ProgressBar value={r.required ? r.current / r.required : 0} />
              </div>
            </>
          ) : (
            <p className={styles.state}>{view.valueText}</p>
          )}
          <p className={styles.basis}>
            기준: {majorTitle(profile)} · {profileSummary(profile)} → {view.name}
            {showNumber && ` ${formatCredits(r.required)}${view.unit} 이상`}
          </p>
          {r.reason && (
            <p className={ui.sub} style={{ marginTop: 6 }}>
              {reasonText(r.reason)}
            </p>
          )}
          {!!r.details?.length && (
            <ul className={styles.details}>
              {r.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 학점 요건: 확인되면 인정될 과목 */}
        {split && split.pending.length > 0 && (
          <section className={ui.highlight}>
            <h2>
              {area === 'total' ? '졸업학점' : CREDIT_AREA_LABEL[area!]}으로 인정될 수 있는 과목 {split.pending.length}
              개
            </h2>
            <div className={styles.pendingList}>
              {(showAllPending ? split.pending : split.pending.slice(0, 5)).map((e) => (
                <div key={`${e.course_code}@${e.semester}`} className={styles.pendingItem}>
                  <strong>{e.course_name ?? names.get(e.course_code) ?? e.course_code}</strong>
                  <span className={styles.pendingMeta}>
                    {formatCredits(e.recognized_credits || 0)}학점 · {e.semester}
                    <span className={styles.tag}>성적표: {e.transcript_category}</span>
                    <b>→ 교과구분 변경 신청 시 전공</b>
                  </span>
                </div>
              ))}
            </div>
            {split.pending.length > 5 && (
              <button type="button" className={styles.more} onClick={() => setShowAllPending((v) => !v)}>
                {showAllPending ? '접기' : `${split.pending.length - 5}개 더 보기`}
              </button>
            )}
            <p className={ui.sub} style={{ marginTop: 14, color: 'var(--color-teal-dark)' }}>
              교과구분 변경이 승인되면 최대 {formatCredits(pendingCredits)}
              학점이 전공으로 더 인정될 수 있어요.
            </p>
          </section>
        )}

        {/* 학점 요건: 인정된 과목 */}
        {split && (
          <EntryTable
            title={`${area === 'total' ? '졸업학점' : CREDIT_AREA_LABEL[area!]}으로 인정된 과목`}
            entries={split.recognized}
            names={names}
          />
        )}

        {/* 필수 과목 요건 */}
        {!!r.required_courses?.length && (
          <section className={ui.card}>
            <div className={ui.cardHead}>
              <h2 className={ui.cardTitle}>대상 과목</h2>
              <span className={ui.muted}>과목코드 기준 판정</span>
            </div>
            <div className={ui.tableWrap} style={{ marginTop: 16 }}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>과목코드</th>
                    <th>과목명</th>
                    <th style={{ textAlign: 'right' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {r.required_courses.map((c) => (
                    <tr key={c.course_code}>
                      <td className={ui.code} style={{ color: 'var(--color-text-sub)' }}>
                        {c.course_code}
                      </td>
                      <td style={{ fontWeight: 700 }}>{c.course_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <RequiredCourseBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 비교과 기록 입력 */}
        {view.group === 'nonacademic' &&
          (AUTO_COMPUTED_IDS.has(view.id) ? (
            <>
              <LiberalAreaPicker evaluation={evaluation} />
              <section className={ui.card}>
                <h2 className={ui.cardTitle}>이수 과목으로 자동 판정</h2>
                <p className={ui.sub} style={{ marginTop: 8 }}>
                  이 요건은 직접 입력하지 않아요. 이수 내역에 과목
                  {view.id === 'gpa' ? '과 성적' : ''}을 넣으면 서버가 계산해요.
                </p>
                <Link to="/courses" className={ui.textLink} style={{ marginTop: 12 }}>
                  이수 내역 입력 ›
                </Link>
              </section>
            </>
          ) : isEnglishScoreRequirement(view) || view.id === PRACTICAL_ENGLISH_ID ? (
            rule && <EnglishSection rule={rule} profile={profile} evaluation={undefined} />
          ) : (
            <RecordCard view={view} record={record} onRecord={onRecord} />
          ))}

        {substitution && (
          <section className={ui.highlight}>
            <h2>{substitutionApplied ? '대체 인정됐어요' : '대체할 수 있어요'}</h2>
            <p className={ui.sub} style={{ marginTop: 8, color: 'var(--color-teal-dark)' }}>
              창업 교과목을 {formatCredits(substitution.minimum)}학점 이상 이수하면 {view.name}을(를) 대신 인정받을 수
              있어요. 지금 입력된 창업 교과목: {formatCredits(substitutionAmount)}학점.
            </p>
            {!substitutionApplied && (
              <Link to="/courses?tab=nonacademic" className={ui.textLink} style={{ marginTop: 12 }}>
                창업 교과목 학점 입력 ›
              </Link>
            )}
          </section>
        )}

        {/* 비교과 상세 기준 */}
        {view.details.length > 0 && (
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>상세 기준</h2>
            <ul className={styles.details}>
              {view.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className={ui.stack}>
        <SourceCard sources={sortSourcesForMajor(view.sources, profile.major)} />
        <HowToFill view={view} pendingCount={split?.pending.length ?? 0} />
        <InquiryCard
          profile={profile}
          studentNumber={studentNumber}
          topic={view.name}
          detail={`${view.valueText} (${r.status})`}
        />
      </div>
    </div>
  )
}

function EntryTable({ title, entries, names }: { title: string; entries: CreditEntry[]; names: Map<string, string> }) {
  const [all, setAll] = useState(false)
  const total = entries.reduce((n, e) => n + (e.recognized_credits ?? 0), 0)
  const rows = all ? entries : entries.slice(0, PREVIEW_ROWS)
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>{title}</h2>
        <span className={ui.muted}>과목코드 기준 판정</span>
      </div>
      {entries.length === 0 ? (
        <p className={ui.sub} style={{ marginTop: 14 }}>
          아직 인정된 과목이 없어요.{' '}
          <Link to="/courses" className={ui.textLink}>
            이수 내역 입력 →
          </Link>
        </p>
      ) : (
        <>
          <div className={ui.tableWrap} style={{ marginTop: 16 }}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>과목코드</th>
                  <th>과목명</th>
                  <th>학점</th>
                  <th>학기</th>
                  <th>인정</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={`${e.course_code}@${e.semester}`}>
                    <td className={ui.code} style={{ color: 'var(--color-text-sub)' }}>
                      {e.course_code}
                    </td>
                    <td style={{ fontWeight: 700 }}>{e.course_name ?? names.get(e.course_code) ?? '-'}</td>
                    <td>{formatCredits(e.recognized_credits ?? 0)}</td>
                    <td>{e.semester}</td>
                    <td className={styles.ok}>
                      {e.excluded_credits ? `일부 (${formatCredits(e.excluded_credits)}학점 제외)` : '인정'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length > PREVIEW_ROWS && (
            <button type="button" className={styles.more} onClick={() => setAll((v) => !v)}>
              {all ? '접기' : `전체 보기 (${formatCredits(total)}학점)`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** 채우는 방법 — 요건 상태에 따라 추천 · 대안 */
function HowToFill({ view, pendingCount }: { view: RequirementView; pendingCount: number }) {
  const r = view.result
  if (r.status === 'satisfied') return null

  const options: {
    label: '추천' | '대안'
    title: string
    sub: string
    to?: string
    href?: string
  }[] = []
  if (view.group === 'credit') {
    if (pendingCount > 0)
      options.push({
        label: '추천',
        title: '인정 확인 · 교과구분 변경 신청',
        sub: '추가 수강 없이 해결 · 학부 승인 필요',
      })
    if (r.shortfall > 0)
      options.push({
        label: options.length ? '대안' : '추천',
        title: `${CREDIT_AREA_LABEL[r.credit_area!]} ${formatCredits(r.shortfall)}학점 추가 이수`,
        sub: '졸업 예정 학기 안에 수강 가능한지 확인',
        to: '/courses',
      })
  } else if (view.group === 'course') {
    const missing = r.required_courses?.filter((c) => c.status === 'missing').length ?? 0
    if (missing)
      options.push({
        label: '추천',
        title: `남은 과목 ${missing}개 수강`,
        sub: '개설 학기를 확인하고 수강신청',
        to: '/courses',
      })
    if (r.required_courses?.some((c) => c.status === 'approval_required' || c.status === 'verification_required'))
      options.push({
        label: options.length ? '대안' : '추천',
        title: '동일 · 대체과목 인정 확인',
        sub: '학부 사무실 확인 필요',
      })
  } else {
    const guide = FILL_GUIDES[r.id]
    // 신청 사이트가 있으면 그것만, 없으면 공지 확인 안내
    if (guide) options.push({ label: '추천', title: `${guide.title} ↗`, sub: guide.sub, href: guide.url })
    else
      options.push({
        label: '추천',
        title: '증빙 제출 · 학부 확인',
        sub: '근거 공지의 제출 방법과 기한을 확인',
      })
  }
  if (!options.length) return null

  return (
    <SideCard title="채우는 방법">
      <div className={styles.options}>
        {options.map((o) => {
          const body = (
            <>
              <span className={styles.optLabel}>{o.label}</span>
              <div>
                <strong>{o.title}</strong>
                <span>{o.sub}</span>
              </div>
            </>
          )
          const cls = `${styles.option} ${o.label === '추천' ? styles.optionMain : ''}`
          if (o.href)
            return (
              <a key={o.title} href={o.href} target="_blank" rel="noreferrer" className={cls}>
                {body}
              </a>
            )
          return o.to ? (
            <Link key={o.title} to={o.to} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={o.title} className={cls}>
              {body}
            </div>
          )
        })}
      </div>
    </SideCard>
  )
}

/** 비교과 기록 입력 — 누계 수치 또는 완료 여부 */
function RecordCard({
  view,
  record,
  onRecord,
}: {
  view: RequirementView
  record: NonacademicRecord | undefined
  onRecord: (amount: number | null) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const { hash } = useLocation()
  const r = view.result
  const isCheck = r.required === 1 && !view.unit
  const [value, setValue] = useState(record ? String(record.amount) : '')

  // 대시보드의 '기록 추가' 버튼으로 들어오면 입력칸으로 스크롤
  useEffect(() => {
    if (hash === '#record') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [hash])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (value.trim() === '' || Number.isNaN(n) || n < 0) return
    onRecord(n)
  }

  return (
    <section ref={ref} id="record" className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>내 기록</h2>
        {record && <span className={ui.muted}>판정에 반영 중</span>}
      </div>
      {isCheck ? (
        <div className={styles.recordRow}>
          <p className={ui.sub}>{record ? '취득 · 확인 완료로 표시했어요.' : '아직 표시하지 않았어요.'}</p>
          {record ? (
            <button type="button" className={ui.buttonGhost} onClick={() => onRecord(null)}>
              표시 취소
            </button>
          ) : (
            <button type="button" className={ui.button} onClick={() => onRecord(1)}>
              취득 · 확인 완료로 표시
            </button>
          )}
        </div>
      ) : (
        <form className={styles.recordRow} onSubmit={handleSubmit}>
          <label className={styles.recordField}>
            <span>지금까지 누계</span>
            <input
              className={ui.input}
              type="number"
              min={0}
              step="any"
              placeholder={`기준 ${formatCredits(r.required)}${view.unit}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {view.unit && <b>{view.unit}</b>}
          </label>
          <button type="submit" className={ui.button} disabled={value.trim() === ''}>
            {record ? '기록 수정' : '기록 추가'}
          </button>
          {record && (
            <button
              type="button"
              className={ui.linkButton}
              onClick={() => {
                setValue('')
                onRecord(null)
              }}
            >
              지우기
            </button>
          )}
        </form>
      )}
      <p className={ui.muted} style={{ marginTop: 12 }}>
        입력한 기록은 이 브라우저에만 저장돼요. 증빙은 학부에 따로 제출해야 해요.
      </p>
    </section>
  )
}
