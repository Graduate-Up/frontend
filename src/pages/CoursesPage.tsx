import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COURSE_SECTIONS } from '@/routes/nav'
import { useHashScroll } from '@/state/useHashScroll'
import type { Course, CourseStatus, CreditEntry, Grade, GraduationRule } from '@/api'
import { NonacademicForm } from '@/components/NonacademicForm'
import { AddCourseForm } from '@/components/courses/AddCourseForm'
import { TranscriptImport } from '@/components/courses/TranscriptImport'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, CategoryBadge, EmptyState, ErrorState, PageIntro, formatCredits, ui } from '@/components/ui'
import { COURSE_STATUS_OPTIONS } from '@/constants/labels'
import { KIND_LABEL, KIND_ORDER, classifyCategory, isStartupCourse, multiMajorTarget } from '@/state/courseCategory'
import { GRADES, SEMESTER_PATTERN, normalizeGrade, normalizeSemester, semesterLabel } from '@/state/courses'
import {
  courseNameMap,
  transcriptCategoryOptions,
  useCatalog,
  useEvaluation,
  useMyProgram,
  useMyProgramName,
  useRequirements,
} from '@/state/queries'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './CoursesPage.module.css'

/** 교과구분 변경 신청 후 바뀌는 교과구분 */
const PROGRAM_CATEGORY = '융합전공'

/** 융합전공으로 바꾸기 전 교과구분 — 되돌리기용 (이 브라우저에만 저장) */
const ORIGINALS_KEY = 'graduate-up.program-originals'
const courseKey = (c: Pick<Course, 'course_code' | 'semester'>) => `${c.course_code}@${c.semester}`

function readOriginals(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ORIGINALS_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveOriginals(value: Record<string, string>) {
  try {
    localStorage.setItem(ORIGINALS_KEY, JSON.stringify(value))
  } catch {
    // 저장 못 해도 되돌리기는 일반선택으로 된다
  }
}

/** '일반선택으로' · '전공필수로' — 받침에 맞춰 조사를 붙인다 */
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const batchim = code >= 0 && code <= 11171 ? code % 28 : 0
  return word + (batchim && batchim !== 8 ? '으로' : '로')
}

const STATUS_VALUES = new Set(COURSE_STATUS_OPTIONS.map((o) => o.value))

const sameCourse = (a: Pick<Course, 'course_code' | 'semester'>, b: Pick<Course, 'course_code' | 'semester'>) =>
  a.course_code === b.course_code && a.semester === b.semester

export function CoursesPage() {
  const profile = useProfile()
  const { kind, courses, setCourses, records, setRecord } = useStudent()
  const [params, setParams] = useSearchParams()
  const isNonacademic = params.get('tab') === 'nonacademic'
  const rule = useRequirements(profile)
  const catalog = useCatalog(profile)
  // 학적에서 고른 융합전공 — 성적표에 일반선택으로 찍혀도 그 전공 과목이면 표시한다
  const myProgram = useMyProgram()
  const programLabel = useMyProgramName()
  const evaluation = useEvaluation(profile, courses, records)

  // 사이드바 소메뉴(#course-list 등)로 들어오면 그 구역으로 스크롤
  useHashScroll()

  const catalogItems = useMemo(() => catalog.data?.items ?? [], [catalog.data])
  const names = useMemo(() => {
    const map = courseNameMap(rule.data)
    for (const c of catalogItems) map.set(c.course_code, c.course_name)
    return map
  }, [rule.data, catalogItems])
  const categories = useMemo(() => transcriptCategoryOptions(rule.data), [rule.data])

  const isTransfer = profile.student_status === 'general_transfer' || profile.student_status === 'bachelor_transfer'
  const entries = evaluation.data?.credit_entries ?? []
  const majorCategories = rule.data?.major_transcript_categories ?? ['전공필수', '전공선택', '전공']

  function addCourses(list: Course[]) {
    setCourses((prev) => {
      const next = prev.filter((p) => !list.some((c) => sameCourse(c, p)))
      return [...next, ...list]
    })
  }

  function updateCourse(target: Course, patch: Partial<Course>) {
    setCourses((prev) => prev.map((c) => (sameCourse(c, target) ? { ...c, ...patch } : c)))
  }

  function removeCourse(target: Course) {
    setCourses((prev) => prev.filter((c) => !sameCourse(c, target)))
  }

  const completed = courses.filter((c) => c.status === 'completed')
  const totalCredits = completed.reduce((sum, c) => sum + c.credits, 0)
  // 이수한 과목 중 내 융합전공 과목 학점 (성적표 교과구분과 상관없이)
  // 다전공 목표 학점 (복수 · 연계 · 융합 36, 부전공 18) — 다전공 교과구분 학점과 함께 분홍으로 표시
  const multiTarget = multiMajorTarget(profile.multi_major, programLabel)
  // 성적표 교과구분 기준 학점 합계
  const byKind = KIND_ORDER.map((kind) => ({
    kind,
    credits: completed
      .filter((c) => classifyCategory(c.transcript_category, c.course_code) === kind)
      .reduce((n, c) => n + c.credits, 0),
  })).filter((k) => k.credits > 0)
  const gpaReady = courses.filter((c) => c.grade).length
  // 내 융합전공 과목인데 성적표에 일반선택으로 잡힌 과목 — 교과구분 변경 신청을 해야 융합전공 학점이 된다
  // 내 융합전공 과목이면 교과구분(일반선택 · 전공 등)과 상관없이 융합전공으로 바꿀 수 있다
  const canChangeToProgram = (c: Course) =>
    myProgram.codes.has(c.course_code) && c.transcript_category !== PROGRAM_CATEGORY
  const [originals, setOriginals] = useState(readOriginals)

  function changeToProgram(c: Course) {
    const next = { ...originals, [courseKey(c)]: c.transcript_category }
    setOriginals(next)
    saveOriginals(next)
    updateCourse(c, { transcript_category: PROGRAM_CATEGORY })
  }

  function revertProgram(c: Course) {
    const { [courseKey(c)]: original, ...rest } = originals
    setOriginals(rest)
    saveOriginals(rest)
    updateCourse(c, { transcript_category: original ?? '일반선택' })
  }

  const courseList = (
    <>
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h2 className={ui.cardTitle}>입력한 과목 {courses.length}개</h2>
          <span className={ui.muted}>
            이수 {formatCredits(totalCredits)}학점 · 성적 입력 {gpaReady}/{courses.length}
          </span>
        </div>
        <div className={styles.kindSummary}>
          {byKind.map((k) => (
            <span key={k.kind} className={styles.kindItem} data-kind={k.kind}>
              <i />
              {k.kind === 'multi' && multiTarget ? (
                <>
                  {multiTarget.label} <b>{formatCredits(k.credits)}</b> / {multiTarget.credits}학점
                </>
              ) : (
                <>
                  {KIND_LABEL[k.kind]} <b>{formatCredits(k.credits)}</b>학점
                </>
              )}
            </span>
          ))}
          {multiTarget && !byKind.some((k) => k.kind === 'multi') && (
            <span className={styles.kindItem} data-kind="multi">
              <i />
              {multiTarget.label} <b>0</b> / {multiTarget.credits}학점
            </span>
          )}
        </div>
        {evaluation.status === 'error' && (
          <div style={{ marginTop: 12 }}>
            <ErrorState error={evaluation.error} />
          </div>
        )}
        {courses.length === 0 ? (
          <p className={ui.sub} style={{ marginTop: 12 }}>
            아직 입력한 과목이 없어요.
          </p>
        ) : (
          <div className={ui.tableWrap} style={{ marginTop: 8 }}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>학기</th>
                  <th>과목</th>
                  <th>학점</th>
                  <th>교과구분</th>
                  <th>성적</th>
                  <th>상태</th>
                  <th>비고</th>
                  <th aria-label="삭제" />
                </tr>
              </thead>
              <tbody>
                {[...courses]
                  .sort((a, b) => a.semester.localeCompare(b.semester) || a.course_code.localeCompare(b.course_code))
                  .map((c) => {
                    const name = c.course_name || names.get(c.course_code)
                    const unknownOffer =
                      c.offered_by_computer_science == null && majorCategories.includes(c.transcript_category)
                    return (
                      <tr key={`${c.course_code}@${c.semester}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>{semesterLabel(c.semester)}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {name ?? c.course_code}
                            {myProgram.codes.has(c.course_code) && (
                              <span className={styles.programDot} title={myProgram.program?.name}>
                                <i />내 융합전공
                              </span>
                            )}
                          </div>
                          <div className={ui.muted}>
                            {[
                              name ? c.course_code : null,
                              c.offered_by_computer_science === false ? '타학과' : null,
                              c.prior_institution ? '편입 전 이수' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {canChangeToProgram(c) && (
                            <div className={styles.programHint}>
                              <p>
                                융합전공 과목에 해당해요. 교과구분 변경 신청을 하셨다면 교과구분을 변경해 주세요.
                                {classifyCategory(c.transcript_category, c.course_code) === 'major' &&
                                  ' 바꾸면 이 과목은 컴퓨터학부 전공 학점에서 빠져요.'}
                              </p>
                              <button type="button" onClick={() => changeToProgram(c)}>
                                변경하기
                              </button>
                            </div>
                          )}
                          {myProgram.codes.has(c.course_code) && c.transcript_category === PROGRAM_CATEGORY && (
                            <div className={styles.programHint}>
                              <button type="button" data-undo onClick={() => revertProgram(c)}>
                                {withRo(originals[courseKey(c)] ?? '일반선택')} 되돌리기
                              </button>
                            </div>
                          )}
                          <CourseAreas
                            areas={entries.find((e) => sameCourse(e, c))?.course_areas}
                            category={c.transcript_category}
                            code={c.course_code}
                          />
                          {unknownOffer && (
                            <button
                              type="button"
                              className={styles.offerFix}
                              onClick={() => updateCourse(c, { offered_by_computer_science: true })}
                            >
                              개설 학부 미확인 · 컴퓨터학부 개설로 표시
                            </button>
                          )}
                        </td>
                        <td>{formatCredits(c.credits)}</td>
                        <td>
                          <CategoryBadge category={c.transcript_category} code={c.course_code} />
                        </td>
                        <td>
                          <select
                            className={`${ui.select} ${styles.gradeSelect}`}
                            value={c.grade ?? ''}
                            aria-label="성적"
                            onChange={(e) => {
                              const grade = (e.target.value || null) as Grade | null
                              updateCourse(c, {
                                grade,
                                status:
                                  grade === 'F' || grade === 'NP'
                                    ? 'failed'
                                    : c.status === 'failed'
                                      ? 'completed'
                                      : c.status,
                              })
                            }}
                          >
                            <option value="">-</option>
                            {GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className={ui.select}
                            value={c.status}
                            aria-label="상태"
                            onChange={(e) => updateCourse(c, { status: e.target.value as CourseStatus })}
                          >
                            {COURSE_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Recognition
                            entry={entries.find((e) => sameCourse(e, c))}
                            loading={evaluation.status === 'loading'}
                          />
                        </td>
                        <td>
                          <button type="button" className={ui.linkButton} onClick={() => removeCourse(c)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
  const manualInput = (
    <>
      <AddCourseForm
        catalog={catalogItems}
        categories={categories}
        defaultCategory={categories[0] ?? ''}
        admissionYear={profile.admission_year}
        isTransfer={isTransfer}
        onAdd={(c) => addCourses([c])}
      />
      {catalog.data?.inferred && <p className={ui.muted}>과목 검색: {catalog.data.basis}</p>}

      <BulkImport onImport={addCourses} />

      {kind === 'guest' && courses.length === 0 && rule.data && (
        <EmptyState
          action={
            <button
              type="button"
              className={ui.buttonGhost}
              onClick={() => addCourses(sampleCourses(rule.data!, categories))}
            >
              예시 과목 채우기
            </button>
          }
        >
          둘러보기 중이에요. 졸업요건의 필수 과목 일부로 예시 이수 내역을 채워볼 수 있어요.
        </EmptyState>
      )}
    </>
  )
  const portalImport = (
    <>
      <TranscriptImport enabled={kind === 'account'} catalog={catalogItems} onImport={addCourses} />
    </>
  )

  return (
    <>
      <PageHeader crumbs={[{ label: '이수 내역' }, { label: isNonacademic ? '비교과' : '교과' }]} />
      <div className={ui.page}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isNonacademic}
            className={styles.tab}
            onClick={() => setParams({}, { replace: true })}
          >
            교과 <b>{courses.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isNonacademic}
            className={styles.tab}
            onClick={() => setParams({ tab: 'nonacademic' }, { replace: true })}
          >
            비교과 <b>{records.length}</b>
          </button>
        </div>

        <PageIntro
          heading={isNonacademic ? '비교과 기록을 채워주세요' : '들은 과목을 채워주세요'}
          lead={
            isNonacademic
              ? '영어 성적, 지도교수 상담 횟수처럼 성적표에 안 나오는 졸업요건이에요. 입력하면 판정에 바로 반영돼요.'
              : '판정은 과목명이 아니라 과목코드로 해요. 성적표의 교과구분과 성적도 함께 넣어주세요.'
          }
          right={
            !isNonacademic &&
            courses.length > 0 && (
              <button
                type="button"
                className={ui.buttonGhost}
                onClick={() => {
                  if (confirm('입력한 과목을 모두 지울까요?')) setCourses([])
                }}
              >
                전체 삭제
              </button>
            )
          }
        />

        {isNonacademic && rule.status === 'error' && <ErrorState error={rule.error} />}
        {isNonacademic && rule.data && (
          <NonacademicForm
            rule={rule.data}
            evaluation={evaluation.data}
            records={records}
            onRecord={setRecord}
            profile={profile}
          />
        )}

        {!isNonacademic && (
          <>
            {/* 과목이 있으면 목록 → 직접 입력 → 성적 가져오기, 비어 있으면 가져오기부터 */}
            {courses.length > 0 ? (
              <>
                <div id={COURSE_SECTIONS.list} className={styles.block}>
                  {courseList}
                </div>
                <div id={COURSE_SECTIONS.manual} className={styles.block}>
                  <h2 className={`${ui.heading} ${styles.sectionHeading}`}>추가할래요</h2>
                  {manualInput}
                </div>
                <div id={COURSE_SECTIONS.import} className={styles.block}>
                  <h2 className={`${ui.heading} ${styles.sectionHeading}`}>새로 입력할래요</h2>
                  {portalImport}
                </div>
              </>
            ) : (
              <>
                <div id={COURSE_SECTIONS.import} className={styles.block}>
                  {portalImport}
                </div>
                <div id={COURSE_SECTIONS.manual} className={styles.block}>
                  {manualInput}
                </div>
                <div id={COURSE_SECTIONS.list} className={styles.block}>
                  {courseList}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

/** 학점에 안 들어가는 경우만 알려준다 (분류는 성적표 교과구분을 따른다) */
/** 백엔드가 알려준 과목 구분 (교양 영역 · 필수 · 설계 · SDG 등). 교과구분 뱃지와 겹치는 건 뺀다 */
function CourseAreas({ areas, category, code }: { areas?: string[]; category: string; code: string }) {
  const shown = (areas ?? []).filter(
    (a) =>
      a !== category && !['전공', '교양', '일반선택'].includes(a) && !(a === '창업교과목' && isStartupCourse(code)),
  )
  if (!shown.length) return null
  return (
    <div className={styles.areas}>
      {shown.map((a) => (
        <span key={a}>{a}</span>
      ))}
    </div>
  )
}

function Recognition({ entry, loading }: { entry?: CreditEntry; loading: boolean }) {
  if (!entry) return <span className={ui.muted}>{loading ? '…' : ''}</span>
  const notes: string[] = []
  if (!entry.counts_toward_total && !entry.recognized_credits) notes.push('학점 미반영')
  if (entry.reason === 'failed' || entry.reason === 'incomplete') notes.push('미취득')
  if (entry.reason === 'in_progress') notes.push('수강 중')
  if (entry.reason === 'duplicate_course') notes.push('중복 이수 — 한 번만 인정')
  if (entry.reason === 'credit_cap') notes.push('인정 상한 초과')
  if (entry.excluded_credits) notes.push(`${formatCredits(entry.excluded_credits)}학점 제외`)
  return (
    <div className={styles.recognition}>
      {notes.length === 0 ? <Badge tone="good">학점 반영</Badge> : <Badge tone="bad">{notes[0]}</Badge>}
      {notes.slice(1).map((n) => (
        <span key={n} className={ui.muted}>
          {n}
        </span>
      ))}
      {entry.major_approval_required && <span className={ui.muted}>교과구분 변경 시 전공 인정 가능</span>}
    </div>
  )
}

/** 한 줄에 한 과목: 과목코드, 학점, 학기, 교과구분[, 성적 또는 상태] */
function BulkImport({ onImport }: { onImport: (courses: Course[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleImport() {
    const parsed: Course[] = []
    const errs: string[] = []
    text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, i) => {
        const [code, credits, rawSemester, category, extra = ''] = line.split(/\s*[,\t]\s*/)
        const n = Number(credits)
        const semester = normalizeSemester(rawSemester ?? '')
        if (!code || Number.isNaN(n) || !SEMESTER_PATTERN.test(semester) || !category) {
          errs.push(`${i + 1}번째 줄: ${line}`)
          return
        }
        const grade = normalizeGrade(extra)
        const status: CourseStatus = STATUS_VALUES.has(extra as CourseStatus)
          ? (extra as CourseStatus)
          : grade === 'F' || grade === 'NP'
            ? 'failed'
            : 'completed'
        parsed.push({
          course_code: code.toUpperCase(),
          credits: n,
          semester,
          transcript_category: category,
          grade,
          offered_by_computer_science: true,
          status,
        })
      })
    setErrors(errs)
    if (parsed.length) onImport(parsed)
    if (!errs.length) {
      setText('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className={ui.linkButton} style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        여러 줄로 직접 입력하기 →
      </button>
    )
  }

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>여러 줄로 직접 입력</h2>
        <button type="button" className={ui.linkButton} onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      <p className={ui.sub} style={{ margin: '6px 0 12px' }}>
        한 줄에 한 과목씩 <code>과목코드, 학점, 학기, 교과구분, 성적</code> 순서로 입력하세요. 학기는 2024-1,
        2024-여름처럼 쓰고, 성적은 빼도 돼요. 모두 컴퓨터학부 개설 과목으로 들어가요.
      </p>
      <textarea
        className={ui.textarea}
        placeholder={'COMP0204, 3, 2024-1, 전공필수, A+\nCLTR0001, 2, 2024-여름, 교양필수, P'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {errors.length > 0 && (
        <div className={`${ui.state} ${ui.stateError}`} style={{ marginTop: 12 }}>
          형식이 맞지 않는 줄은 건너뛰었어요.
          {errors.map((e) => (
            <span key={e} className={ui.code}>
              {e}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="button" className={ui.button} disabled={!text.trim()} onClick={handleImport}>
          가져오기
        </button>
      </div>
    </section>
  )
}

/** 둘러보기용: 필수 과목 요건에서 일부를 이수한 것으로 채운다 */
function sampleCourses(rule: GraduationRule, categories: string[]): Course[] {
  const year = rule.admission_from
  const picked: Course[] = []
  const grades: Grade[] = ['A+', 'A0', 'B+', 'A-', 'B0']
  rule.course_requirements.forEach((req, i) => {
    const take = Math.max(1, Math.floor(req.choose / 2))
    req.courses.slice(0, take).forEach((c, j) => {
      picked.push({
        course_code: c.course_code,
        course_name: c.course_name,
        credits: 3,
        semester: `${year + Math.min(3, Math.floor((i + j) / 3))}-${((i + j) % 2) + 1}`,
        transcript_category: req.required_transcript_category ?? categories[0] ?? '전공필수',
        grade: grades[(i + j) % grades.length],
        offered_by_computer_science: true,
        status: 'completed',
      })
    })
  })
  return picked.filter((c, i, arr) => arr.findIndex((x) => x.course_code === c.course_code) === i).slice(0, 12)
}
