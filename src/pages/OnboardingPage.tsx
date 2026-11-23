import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMajors, getTracks, type MajorCode, type MultiMajor, type StudentStatus } from '@/api'
import { Logo } from '@/components/Logo'
import { ErrorState, Loading, errorText, ui } from '@/components/ui'
import { MULTI_MAJOR_OPTIONS, STUDENT_STATUS_OPTIONS } from '@/constants/labels'
import { useStudent } from '@/state/useStudent'
import { CONVERGENCE_PROGRAMS, PROGRAM_MULTI_MAJORS } from '@/content/programs'
import { ABEEK_LAST_GRADUATION } from '@/state/profile'
import { useConvergencePrograms } from '@/state/queries'
import { useAsync } from '@/state/useAsync'
import { MAJOR_LABEL } from '@/types/student'
import styles from './OnboardingPage.module.css'

/** 백엔드 트랙 이름에 덧붙여 보여줄 설명 */
const TRACK_LABEL_SUFFIX: Record<string, string> = {
  multi_major: ' (교직과정 포함)',
}

/** 다중전공 트랙은 다전공(또는 교직과정)을 반드시 해야 한다 */
const MULTI_MAJOR_TRACK = 'multi_major'

/** 지원 학번: 2019 ~ 2026 */
const ADMISSION_YEARS = Array.from({ length: 8 }, (_, i) => 2026 - i)

/** 계정 정보를 다 불러온 뒤에 폼을 그린다 (새로고침 직후 저장된 학적이 빈칸으로 시작하지 않게) */
export function OnboardingPage() {
  const { kind } = useStudent()
  if (kind === 'loading') return null
  return <OnboardingForm />
}

function OnboardingForm() {
  const navigate = useNavigate()
  const { kind, profile, studentNumber, saveProfile, convergenceProgram } = useStudent()

  // 지원하지 않는 학번(2018 이하)으로 저장돼 있었으면 다시 고르게 한다
  const [year, setYear] = useState<number | null>(
    profile && ADMISSION_YEARS.includes(profile.admission_year) ? profile.admission_year : null,
  )
  const [major, setMajor] = useState<MajorCode | null>(profile?.major ?? null)
  const [track, setTrack] = useState<string | null>(profile?.track ?? null)
  const [variant, setVariant] = useState<string | null>(profile?.track_variant ?? null)
  const [abeek, setAbeek] = useState<boolean | null>(profile?.abeek ?? null)
  const [multiMajor, setMultiMajor] = useState<MultiMajor>(profile?.multi_major ?? 'none')
  // 어떤 융합전공인지 — '' 는 복수 · 연계전공이라 해당 없음
  const [program, setProgram] = useState<string>(convergenceProgram ?? '')
  // 백엔드 융합전공 목록 (못 불러오면 예비 목록 · 이 브라우저에만 저장)
  const programList = useConvergencePrograms()
  const programOptions = programList.data?.filter((p) => p.kind === 'convergence') ?? CONVERGENCE_PROGRAMS
  const showProgram = PROGRAM_MULTI_MAJORS.includes(multiMajor)
  const [status, setStatus] = useState<StudentStatus>(profile?.student_status ?? 'new')
  const [gradDate, setGradDate] = useState<string>(profile?.expected_graduation_date ?? '')
  const [semesters, setSemesters] = useState<string>(
    profile?.registered_semesters != null ? String(profile.registered_semesters) : '',
  )
  const [number, setNumber] = useState(studentNumber ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const majors = useAsync(`majors:${year}`, year ? (signal) => getMajors(year, { signal }) : null)
  const tracks = useAsync(
    `tracks:${year}:${major}`,
    year && major ? (signal) => getTracks(year, major, { signal }) : null,
  )

  if (kind === 'loading') return null
  if (kind === 'anonymous') return <Navigate to="/login" replace />

  const isAccount = kind === 'account'
  const trackInfo = tracks.status === 'success' ? tracks.data : undefined
  const hasTracks = !!trackInfo?.tracks.length
  const variants = track ? trackInfo?.track_variants?.[track] : undefined
  const needsAbeek = !!trackInfo?.requires_abeek

  const majorOk = !!majors.data?.majors.some((m) => m.code === major)
  const trackOk = !hasTracks || (track ? trackInfo!.tracks.includes(track) : trackInfo!.allows_no_track)
  const variantOk = !variants || (variant !== null && variant in variants)
  // ABEEK 이수는 2029년 2월 졸업까지만 (백엔드 규칙 program_end). 그 뒤 졸업이면 미이수로 고정
  const abeekLocked = needsAbeek && !!gradDate && gradDate > ABEEK_LAST_GRADUATION
  const abeekValue = abeekLocked ? false : abeek
  const abeekOk = !needsAbeek || abeekValue !== null
  const numberOk = !isAccount || /^[0-9]{1,32}$/.test(number)
  const multiTrack = hasTracks && track === MULTI_MAJOR_TRACK
  const multiOptions = multiTrack ? MULTI_MAJOR_OPTIONS.filter((o) => o.value !== 'none') : MULTI_MAJOR_OPTIONS
  const multiOk = !multiTrack || multiMajor !== 'none'
  const canSubmit =
    !!year && majorOk && !!trackInfo && trackOk && variantOk && abeekOk && multiOk && numberOk && !saving

  function pickYear(y: number) {
    setYear(y)
    setMajor(null)
    resetDetails()
  }

  function pickMajor(m: MajorCode) {
    setMajor(m)
    resetDetails()
  }

  function resetDetails() {
    setTrack(null)
    setVariant(null)
    setAbeek(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !year || !major) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveProfile(
        {
          admission_year: year,
          major,
          track: hasTracks ? track : null,
          track_variant: variants ? variant : null,
          abeek: needsAbeek ? abeekValue : null,
          multi_major: multiMajor,
          student_status: status,
          expected_graduation_date: gradDate || null,
          registered_semesters: semesters ? Number(semesters) : null,
        },
        isAccount ? number : undefined,
        { id: showProgram && program ? program : null, server: !!programList.data },
      )
      navigate('/', { replace: true })
    } catch (err) {
      setSaveError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const gradYears = year ? Array.from({ length: 9 }, (_, i) => year + 2 + i) : []

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Logo size={24} />
        {profile && (
          <button type="button" className={ui.linkButton} onClick={() => navigate(-1)}>
            취소
          </button>
        )}
      </header>

      <form className={styles.body} onSubmit={handleSubmit}>
        <div>
          <h1 className={ui.heading}>세 번만 고르면 내 졸업요건이 나와요</h1>
          <p className={ui.lead}>학번 · 세부전공 · 트랙에 따라 요건이 달라요. 나중에 언제든 바꿀 수 있어요.</p>
        </div>

        {/* 1. 학번 */}
        <section className={ui.card}>
          <Step n={1} title="입학년도" done={!!year} />
          <div className={styles.grid}>
            {ADMISSION_YEARS.map((y) => (
              <Choice key={y} selected={year === y} onClick={() => pickYear(y)}>
                {String(y).slice(2)}학번
              </Choice>
            ))}
          </div>
        </section>

        {/* 2. 세부전공 */}
        {year && (
          <section className={ui.card}>
            <Step n={2} title="세부전공" done={majorOk} />
            {majors.status === 'loading' && <Loading />}
            {majors.status === 'error' && <ErrorState error={majors.error} />}
            {majors.status === 'success' &&
              (majors.data.majors.length ? (
                <div className={styles.list}>
                  {majors.data.majors.map((m) => (
                    <Choice key={m.code} selected={major === m.code} onClick={() => pickMajor(m.code)}>
                      <strong>{m.name}</strong>
                      <span className={ui.muted}>{MAJOR_LABEL[m.code]?.short}</span>
                    </Choice>
                  ))}
                </div>
              ) : (
                <p className={ui.sub}>{year}학번은 아직 지원하지 않아요.</p>
              ))}
          </section>
        )}

        {/* 3. 세부 조건 */}
        {year && majorOk && (
          <section className={ui.card}>
            <Step n={3} title="세부 조건" done={canSubmit} />
            {tracks.status === 'loading' && <Loading />}
            {tracks.status === 'error' && <ErrorState error={tracks.error} />}
            {trackInfo && (
              <div className={styles.fields}>
                {hasTracks && (
                  <Field label="트랙">
                    <div className={styles.list}>
                      {trackInfo.tracks.map((t) => (
                        <Choice
                          key={t}
                          selected={track === t}
                          onClick={() => {
                            setTrack(t)
                            setVariant(null)
                            // 다중전공 트랙을 고르면 '안 함'은 고를 수 없으니 첫 선택지로 바꿔둔다
                            if (t === MULTI_MAJOR_TRACK && multiMajor === 'none')
                              setMultiMajor('double_or_linked_or_convergence')
                          }}
                        >
                          {trackInfo.track_labels?.[t] ?? t}
                          {TRACK_LABEL_SUFFIX[t] ?? ''}
                        </Choice>
                      ))}
                      {trackInfo.allows_no_track && (
                        <Choice
                          selected={track === null}
                          onClick={() => {
                            setTrack(null)
                            setVariant(null)
                          }}
                        >
                          선택 안 함
                        </Choice>
                      )}
                    </div>
                  </Field>
                )}

                {variants && (
                  <Field label="세부 유형">
                    <select
                      className={ui.select}
                      value={variant ?? ''}
                      onChange={(e) => setVariant(e.target.value || null)}
                      required
                    >
                      <option value="">선택하세요</option>
                      {Object.entries(variants).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="다전공">
                  <select
                    className={ui.select}
                    value={multiOk ? multiMajor : ''}
                    onChange={(e) => setMultiMajor(e.target.value as MultiMajor)}
                  >
                    {!multiOk && <option value="">선택하세요</option>}
                    {multiOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {multiTrack && (
                    <span className={ui.muted}>
                      다중전공 트랙은 복수 · 부 · 연계 · 융합전공이나 교직과정 중 하나를 골라주세요.
                    </span>
                  )}
                </Field>

                {showProgram && (
                  <Field label="융합전공 (해당되면)">
                    <select className={ui.select} value={program} onChange={(e) => setProgram(e.target.value)}>
                      <option value="">복수 · 연계전공이에요 / 아직 안 정했어요</option>
                      {programOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <p className={styles.abeekNote}>
                      학적에 함께 저장돼요. 과목 추천에서 이 융합전공 과목을 먼저 보여줘요. 졸업요건 판정에는 아직
                      반영되지 않아요.
                    </p>
                  </Field>
                )}

                <Field label="입학 구분">
                  <select
                    className={ui.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StudentStatus)}
                  >
                    {STUDENT_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="졸업 예정">
                  <select className={ui.select} value={gradDate} onChange={(e) => setGradDate(e.target.value)}>
                    <option value="">아직 몰라요</option>
                    {gradYears.flatMap((y) => [
                      <option key={`${y}-02`} value={`${y}-02`}>
                        {y}년 2월
                      </option>,
                      <option key={`${y}-08`} value={`${y}-08`}>
                        {y}년 8월
                      </option>,
                    ])}
                  </select>
                </Field>

                <Field label="지금까지 등록한 정규학기 (선택)">
                  <select className={ui.select} value={semesters} onChange={(e) => setSemesters(e.target.value)}>
                    <option value="">입력 안 함</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}학기
                      </option>
                    ))}
                  </select>
                  <p className={styles.abeekNote}>
                    휴학 · 계절학기는 빼고 세어 주세요. 조기졸업 대상인지 판정할 때 써요.
                  </p>
                </Field>

                {needsAbeek && (
                  <Field label="공학교육인증(ABEEK)">
                    <div className={styles.row}>
                      <Choice selected={abeekValue === true} disabled={abeekLocked} onClick={() => setAbeek(true)}>
                        {abeekLocked ? '🔒 이수' : '이수'}
                      </Choice>
                      <Choice
                        selected={abeekValue === false}
                        onClick={() => {
                          // 이수 → 미이수로 바꿀 때만 한 번 더 묻는다 (실수 방지)
                          if (
                            abeekValue === true &&
                            !confirm(
                              'ABEEK 미이수 기준으로 바꿀까요?\n\n학교에서 ABEEK 포기(미이수 전환)를 신청한 경우에만 바꿔주세요. 학교에서 미이수로 바꾸면 되돌릴 수 없어요.\n졸UP 설정은 나중에 학적 변경에서 언제든 바꿀 수 있어요.',
                            )
                          )
                            return
                          setAbeek(false)
                        }}
                      >
                        미이수
                      </Choice>
                    </div>
                    <p className={abeekLocked ? styles.abeekLocked : styles.abeekNote}>
                      {abeekLocked
                        ? '2029년 2월 이후 졸업이면 ABEEK 인증이 끝나 미이수로 고정돼요.'
                        : 'ABEEK 이수는 2029년 2월 졸업까지만 가능해요. 학교에서 미이수로 바꾸면 되돌릴 수 없으니, 지금 학적대로 골라주세요. 졸UP 설정은 언제든 바꿀 수 있어요.'}
                    </p>
                  </Field>
                )}

                {isAccount && (
                  <Field label="학번">
                    <input
                      className={ui.input}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={32}
                      placeholder="예: 2023012345"
                      value={number}
                      onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </Field>
                )}
              </div>
            )}
          </section>
        )}

        {saveError && <ErrorState error={new Error(saveError)} />}

        <button type="submit" className={`${ui.button} ${styles.submit}`} disabled={!canSubmit}>
          {saving ? '저장 중…' : '내 졸업요건 보기'}
        </button>
        {!isAccount && <p className={ui.muted}>둘러보기 중에는 이 브라우저에만 저장돼요.</p>}
      </form>
    </div>
  )
}

function Step({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepNum} data-done={done}>
        {done ? '✓' : n}
      </span>
      <h2 className={ui.cardTitle}>{title}</h2>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  )
}

function Choice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={styles.choice} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
