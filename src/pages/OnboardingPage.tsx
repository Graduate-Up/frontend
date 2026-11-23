import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMajors, getTracks, type MajorCode, type MultiMajor, type StudentStatus } from '@/api'
import { Logo } from '@/components/Logo'
import { ErrorState, Loading, errorText, ui } from '@/components/ui'
import { MULTI_MAJOR_OPTIONS, STUDENT_STATUS_OPTIONS } from '@/constants/labels'
import { useStudent } from '@/state/useStudent'
import { useAsync } from '@/state/useAsync'
import { MAJOR_LABEL } from '@/types/student'
import styles from './OnboardingPage.module.css'

/** 백엔드 트랙 이름에 덧붙여 보여줄 설명 */
const TRACK_LABEL_SUFFIX: Record<string, string> = {
  multi_major: ' (교직과정 포함)',
}

/** 다중전공 트랙은 다전공(또는 교직과정)을 반드시 해야 한다 */
const MULTI_MAJOR_TRACK = 'multi_major'

const ADMISSION_YEARS = Array.from({ length: 10 }, (_, i) => 2026 - i) // 2026 ~ 2017

export function OnboardingPage() {
  const navigate = useNavigate()
  const { kind, profile, studentNumber, saveProfile } = useStudent()

  const [year, setYear] = useState<number | null>(profile?.admission_year ?? null)
  const [major, setMajor] = useState<MajorCode | null>(profile?.major ?? null)
  const [track, setTrack] = useState<string | null>(profile?.track ?? null)
  const [variant, setVariant] = useState<string | null>(profile?.track_variant ?? null)
  const [abeek, setAbeek] = useState<boolean | null>(profile?.abeek ?? null)
  const [multiMajor, setMultiMajor] = useState<MultiMajor>(profile?.multi_major ?? 'none')
  const [status, setStatus] = useState<StudentStatus>(profile?.student_status ?? 'new')
  const [gradDate, setGradDate] = useState<string>(profile?.expected_graduation_date ?? '')
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
  const abeekOk = !needsAbeek || abeek !== null
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
          abeek: needsAbeek ? abeek : null,
          multi_major: multiMajor,
          student_status: status,
          expected_graduation_date: gradDate || null,
        },
        isAccount ? number : undefined,
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
                            if (t === MULTI_MAJOR_TRACK && multiMajor === 'none') setMultiMajor('double_or_linked_or_convergence')
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

                {needsAbeek && (
                  <Field label="공학교육인증(ABEEK)">
                    <div className={styles.row}>
                      <Choice selected={abeek === true} onClick={() => setAbeek(true)}>
                        이수
                      </Choice>
                      <Choice selected={abeek === false} onClick={() => setAbeek(false)}>
                        미이수
                      </Choice>
                    </div>
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
                    <span className={ui.muted}>다중전공 트랙은 복수 · 부 · 연계 · 융합전공이나 교직과정 중 하나를 골라주세요.</span>
                  )}
                </Field>

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
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={styles.choice} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}
