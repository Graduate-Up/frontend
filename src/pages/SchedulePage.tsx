import type {
  Course,
  EvaluationResponse,
  GraduationRule,
  EarlyGraduationAssessment,
  GraduationDeferral,
  GraduationSchedule,
  RequirementResult,
  Source,
  StudentProfile,
} from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, Loading, PageIntro, Sources, ui } from '@/components/ui'
import { formatGraduation } from '@/constants/labels'
import { OFFICIAL_ENGLISH_KEY, formatScore, testById, type EnglishScore } from '@/content/englishTests'
import { hiddenCreditChecks } from '@/state/hiddenCredits'
import { useEvaluation, useGraduationSchedule, useRequirements } from '@/state/queries'
import { useProfile, useStudent } from '@/state/useStudent'
import { MAJOR_LABEL } from '@/types/student'
import styles from './SchedulePage.module.css'

type Step = {
  key: string
  title: string
  /** YYYY-MM-DD — 없으면 '확인 필요' */
  date?: string
  when: string
  body: string
  sources: Source[]
}

const DAY = 24 * 60 * 60 * 1000
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function today() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const dDay = (date: string) => Math.round((parseDate(date).getTime() - today().getTime()) / DAY)

function formatDate(s: string) {
  const d = parseDate(s)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} (${WEEKDAY[d.getDay()]})`
}

const QUALIFICATION_IDS = ['practical-english', 'software', 'counseling']
const pendingOf = (e: EvaluationResponse, ids: string[]) =>
  e.requirements.filter((r) => ids.includes(r.id) && r.status !== 'satisfied')

type EventKind = GraduationSchedule['events'][number]['kind']

const EVENT_TITLE: Record<EventKind, string> = {
  portfolio_submission: '졸업 포트폴리오 제출',
  graduation_interview: '졸업 인터뷰',
  classification_change: '교과구분 변경 신청',
  general_elective_conversion: '일반선택 전환 신청',
  graduation_review_result: '졸업사정 결과 발표',
}

/** 일정 ↔ 졸업요건 (이미 채운 요건의 일정은 숨긴다) */
const EVENT_REQUIREMENT: Partial<Record<EventKind, string>> = {
  portfolio_submission: 'review-portfolio',
  graduation_interview: 'review-interview',
}
const REQUIREMENT_EVENT: Record<string, EventKind> = {
  'review-portfolio': 'portfolio_submission',
  'review-interview': 'graduation_interview',
}

function eventWhen(ev: GraduationSchedule['events'][number]) {
  const range =
    ev.start_date && ev.end_date
      ? `${formatDate(ev.start_date)} ~ ${formatDate(ev.end_date)}`
      : ev.end_date
        ? `${formatDate(ev.end_date)}까지`
        : ev.start_date
          ? `${formatDate(ev.start_date)}부터`
          : ''
  if (ev.status === 'confirmed') return range || '일정 확정'
  if (ev.status === 'tentative') return range ? `${range} (예정)` : '날짜 미정 (예정)'
  if (ev.status === 'standing_rule') return '상시 신청'
  return '일정 확인 필요'
}

function buildSteps(
  profile: StudentProfile,
  rule: GraduationRule,
  e: EvaluationResponse,
  courses: Course[],
  schedule: GraduationSchedule,
): Step[] {
  const steps: Step[] = []
  const req = (id: string) => rule.nonacademic_requirements.find((r) => r.id === id)

  // 졸업자격인정원
  const qualification = schedule.qualification_deadlines.find((q) => q.graduation === profile.expected_graduation_date)
  const qualPending = pendingOf(e, QUALIFICATION_IDS)
  steps.push({
    key: 'qualification',
    title: '졸업자격인정원 신청',
    date: qualification?.date,
    when: qualification
      ? `${formatDate(qualification.date)}까지${qualification.note ? ` · ${qualification.note}` : ''}`
      : '졸업 학기 공고 확인 필요',
    body: qualPending.length
      ? `${qualPending.map((r) => r.name.replace(/ 졸업자격인정$/, '')).join(' · ')} 증빙을 함께 내요. 아직 ${qualPending.length}개 영역이 남았어요.`
      : '실용영어 · 소프트웨어 · 상담 영역을 모두 채웠어요. 증빙을 함께 내요.',
    sources: qualification?.sources ?? req('practical-english')?.sources ?? [],
  })

  // 학부 일정 (백엔드 graduation_schedule.events — 내 졸업 시기 · 전공 · 학번에 맞는 것만 온다)
  const hidden = hiddenCreditChecks(rule, e, courses).filter((c) => c.found && c.steps)
  const covered = new Set<string>()
  for (const ev of schedule.events) {
    covered.add(ev.kind)
    const reqId = EVENT_REQUIREMENT[ev.kind]
    const result = reqId ? e.requirements.find((r) => r.id === reqId) : undefined
    // 이미 채운 졸업심사 항목은 일정에서 뺀다
    if (result?.status === 'satisfied') continue
    // 교과구분 변경 · 일반선택 전환은 숨은 학점을 찾았을 때만
    const related = hidden.filter((h) => (ev.kind === 'general_elective_conversion') === h.id.startsWith('over-cap'))
    if ((ev.kind === 'classification_change' || ev.kind === 'general_elective_conversion') && !related.length) continue
    const date = ev.end_date ?? ev.start_date ?? undefined
    steps.push({
      key: `event-${ev.kind}`,
      title: EVENT_TITLE[ev.kind],
      date: ev.status === 'confirmed' ? date : undefined,
      when: eventWhen(ev),
      body:
        ev.kind === 'classification_change' || ev.kind === 'general_elective_conversion'
          ? `숨은 학점(${related.map((h) => h.tag).join(', ')})을 반영하려면 졸업사정 전에 승인돼야 해요.${ev.note ? ` ${ev.note}` : ''}`
          : ev.kind === 'graduation_review_result'
            ? `최종 판정은 학부 사무실에서 해요.${ev.note ? ` ${ev.note}` : ''}`
            : (ev.note ?? '학부 공지에 맞춰 제출해요. 마치면 졸업요건에서 확인 완료로 표시해주세요.'),
      sources: ev.sources,
    })
  }

  // 일정이 안 온 졸업심사 항목 (예: 플솝 TOPCIT)은 요건으로 보여준다
  for (const r of e.requirements.filter(
    (x) => x.id.startsWith('review-') && x.status !== 'satisfied' && !covered.has(REQUIREMENT_EVENT[x.id] ?? ''),
  )) {
    const details = req(r.id)?.details ?? []
    steps.push({
      key: r.id,
      title: r.name,
      when: '제출 기간 확인 필요',
      body: details.length
        ? details.join(' · ')
        : '학부 공지에 맞춰 제출해요. 마치면 졸업요건에서 확인 완료로 표시해주세요.',
      sources: r.sources,
    })
  }

  // 학부 졸업요건 마감
  const deptPending = e.requirements.filter(
    (r) => r.status !== 'satisfied' && !QUALIFICATION_IDS.includes(r.id) && !r.id.startsWith('review-'),
  )
  steps.push({
    key: 'department',
    title: '학부 졸업요건 마감',
    when: schedule.department_deadline.label,
    body: deptPending.length
      ? `학점 · 비교과 등 ${deptPending.length}개 요건이 남았어요: ${deptPending
          .slice(0, 3)
          .map((r) => r.name)
          .join(', ')}${deptPending.length > 3 ? ' 등' : ''}.`
      : '학부 졸업요건을 모두 채웠어요.',
    sources: schedule.department_deadline.sources,
  })

  if (!covered.has('graduation_review_result'))
    steps.push({
      key: 'result',
      title: '졸업사정 결과 발표',
      when: '일정 확인 필요',
      body: '최종 판정은 학부 사무실에서 해요.',
      sources: [],
    })

  // 날짜 있는 것부터 가까운 순
  return steps.sort(
    (a, b) => (a.date ? parseDate(a.date).getTime() : Infinity) - (b.date ? parseDate(b.date).getTime() : Infinity),
  )
}

/** 날짜가 있는 절차를 .ics로 내려받는다 */
function downloadCalendar(steps: Step[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const events = steps
    .filter((s) => s.date)
    .map((s) => {
      const d = s.date!.replace(/-/g, '')
      const next = new Date(parseDate(s.date!).getTime() + DAY)
      const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`
      return [
        'BEGIN:VEVENT',
        `UID:${s.key}-${d}@jolup`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:[졸UP] ${s.title}`,
        `DESCRIPTION:${s.body.replace(/[,;]/g, '\\$&')}`,
        'END:VEVENT',
      ].join('\r\n')
    })
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jolup//schedule//KO', ...events, 'END:VCALENDAR'].join(
    '\r\n',
  )
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'jolup-schedule.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export function SchedulePage() {
  const profile = useProfile()
  const { courses, records, englishScores } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  const grad = formatGraduation(profile.expected_graduation_date)
  const schedule = useGraduationSchedule(profile)
  const steps =
    rule.data && evaluation.data && schedule.data
      ? buildSteps(profile, rule.data, evaluation.data, courses, schedule.data)
      : null
  const error = rule.error ?? evaluation.error ?? schedule.error
  const dated = steps?.filter((s) => s.date && dDay(s.date) >= 0) ?? []
  const now = today()

  return (
    <>
      <PageHeader
        crumbs={[{ label: '졸업 일정' }]}
        right={grad ? `${grad} 졸업 · ${MAJOR_LABEL[profile.major].short} 일정` : undefined}
      />
      <div className={ui.page}>
        {error ? <ErrorState error={error} /> : !steps && <Loading label="판정 중…" />}
        {steps && (
          <>
            <PageIntro
              heading={`졸업까지 남은 절차 ${steps.length}개`}
              lead={`오늘은 ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일이에요. ${
                dated.length ? `가장 가까운 마감은 ${dated[0].title}예요.` : '날짜가 정해진 마감은 아직 없어요.'
              }${grad ? '' : ' 졸업 예정 학기를 넣으면 일정을 맞춰 드려요.'}`}
              right={
                <button
                  type="button"
                  className={ui.buttonGhost}
                  disabled={!dated.length}
                  onClick={() => downloadCalendar(dated)}
                >
                  캘린더에 추가
                </button>
              }
            />
            <div className={styles.layout}>
              <section className={ui.card}>
                <ol className={styles.timeline}>
                  {steps.map((s) => (
                    <StepRow key={s.key} step={s} />
                  ))}
                </ol>
              </section>
              <aside className={styles.side}>
                <EnglishWarning
                  score={englishScores[OFFICIAL_ENGLISH_KEY]}
                  graduation={profile.expected_graduation_date}
                  result={evaluation.data!.requirements.find((r) => r.id === 'practical-english')}
                />
                <OptionalCard
                  policy={schedule.data!.early_graduation}
                  assessment={evaluation.data!.early_graduation}
                  deferral={schedule.data!.deferral}
                />
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function StepRow({ step }: { step: Step }) {
  const d = step.date ? dDay(step.date) : null
  const label = d == null ? '확인' : d < 0 ? '지남' : d === 0 ? 'D-DAY' : `D-${d}`
  const tone = d == null ? 'check' : d < 0 ? 'past' : d <= 14 ? 'urgent' : 'normal'
  return (
    <li className={styles.step}>
      <span className={styles.dday} data-tone={tone}>
        {label}
      </span>
      <div className={styles.stepBody}>
        <b>{step.title}</b>
        <span className={styles.when} data-tone={tone}>
          {step.when}
        </span>
        <p>{step.body}</p>
        <Sources sources={step.sources} />
      </div>
    </li>
  )
}

function addMonths(ym: string, months: number) {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + months
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

function EnglishWarning({
  score,
  graduation,
  result,
}: {
  score: EnglishScore | undefined
  graduation: string | null | undefined
  result: RequirementResult | undefined
}) {
  if (!result) return null
  if (!score) {
    if (result.status === 'satisfied') return null
    return (
      <section className={styles.warn}>
        <span className={styles.warnTag}>주의</span>
        <h3>영어 성적을 아직 입력하지 않았어요</h3>
        <p>졸업자격인정원은 제출일 기준 2년 이내 · 입학 후 취득한 성적만 인정돼요.</p>
        <b>성적이 있으면 졸업요건 → 실용영어에서 입력해주세요.</b>
      </section>
    )
  }
  if (!score.takenAt) return null
  const expires = addMonths(score.takenAt, 24)
  const [ey, em] = expires.split('-')
  const nowYm = `${today().getFullYear()}-${String(today().getMonth() + 1).padStart(2, '0')}`
  const beforeGrad = graduation ? expires < graduation : false
  const soon = expires <= addMonths(nowYm, 6)
  if (!beforeGrad && !soon) return null
  return (
    <section className={styles.warn}>
      <span className={styles.warnTag}>주의</span>
      <h3>{expires <= nowYm ? '영어 성적이 만료됐어요' : '영어 성적이 곧 만료돼요'}</h3>
      <p>
        {testById(score.test).label} {formatScore(score)} · {score.takenAt.replace('-', '.')} 취득 → {ey}.{em} 만료.
        제출일 기준 2년 이내 성적만 인정돼요.
      </p>
      <b>만료 전에 제출하거나 재응시를 준비하세요.</b>
    </section>
  )
}

const EARLY_STATUS: Record<EarlyGraduationAssessment['status'], string> = {
  criteria_met: '조건 충족 · 종강 전 학과 상담 후 신청',
  criteria_not_met: '대상 아님',
  verification_required: '확인 필요',
  not_applicable: '대상 아님 · 편입생은 조기졸업 불가',
}

function OptionalCard({
  policy,
  assessment,
  deferral,
}: {
  policy: GraduationSchedule['early_graduation']
  /** 백엔드 판정 (평점 · 등록 학기 · 졸업요건 충족 여부) */
  assessment: EarlyGraduationAssessment | null | undefined
  deferral: GraduationDeferral
}) {
  // 조기졸업 — 백엔드 판정 결과를 이유와 함께
  let early = '판정 정보가 없어요'
  let earlyWhy = ''
  if (assessment) {
    early = EARLY_STATUS[assessment.status]
    const why: string[] = []
    if (assessment.registered_semesters == null) why.push('등록 학기 수를 학적 변경에서 넣으면 판정해요')
    else if (assessment.registered_semesters < policy.min_semesters)
      why.push(`등록 ${assessment.registered_semesters}학기 (${policy.min_semesters}학기 이상 필요)`)
    if (assessment.gpa == null) why.push('평점을 계산하려면 성적이 필요해요')
    else if (assessment.gpa < policy.min_gpa)
      why.push(`평점 ${assessment.gpa.toFixed(2)} (${policy.min_gpa} 이상 필요)`)
    if (assessment.status !== 'not_applicable' && !assessment.graduation_requirements_met)
      why.push('졸업요건을 아직 다 채우지 못했어요')
    earlyWhy = why.join(' · ')
  }
  const fees = deferral.tuition_by_credits
    .map(
      (t) =>
        `${t.min_credits}${t.max_credits ? `~${t.max_credits}` : ''}학점 ${t.tuition_fraction === '1' ? '전액' : t.tuition_fraction}`,
    )
    .join(', ')

  return (
    <section className={ui.card}>
      <h3 className={ui.cardTitle}>선택할 수 있는 절차</h3>
      <div className={styles.options}>
        <div>
          <b>조기졸업</b>
          <span>{early}</span>
          {earlyWhy && <p>{earlyWhy}</p>}
          <p>{policy.rule}</p>
          <Sources sources={policy.sources} />
        </div>
        <div>
          <b>학사학위취득 유예</b>
          <span>
            최대 {deferral.max_semesters}학기 · {deferral.min_completed_semesters}학기 이상 이수 후
          </span>
          <p>
            시설사용료 등록금의 {deferral.facility_fee_percent}%. 수강하면 학점별 등록금({fees})에서 시설사용료를 뺀
            차액을 내요. {deferral.note}
          </p>
          <Sources sources={deferral.sources} />
        </div>
      </div>
    </section>
  )
}
