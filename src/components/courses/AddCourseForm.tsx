import { useMemo, useState, type FormEvent } from 'react'
import type { CatalogCourse, Course, CourseStatus, Grade } from '@/api'
import { formatCredits, ui } from '@/components/ui'
import { COURSE_STATUS_OPTIONS } from '@/constants/labels'
import { GRADES } from '@/state/courses'
import { offeredByDepartment } from '@/state/queries'
import styles from './AddCourseForm.module.css'

type Offered = 'yes' | 'no' | 'unknown'

type Draft = {
  code: string
  name: string
  credits: string
  year: string
  term: string
  category: string
  grade: Grade | ''
  status: CourseStatus
  offered: Offered
  prior: boolean
}

const TERMS = [
  { value: '1', label: '1학기' },
  { value: 'summer', label: '여름학기' },
  { value: '2', label: '2학기' },
  { value: 'winter', label: '겨울학기' },
]

const toOffered = (v: boolean | undefined): Offered => (v === true ? 'yes' : v === false ? 'no' : 'unknown')
const fromOffered = (v: Offered) => (v === 'yes' ? true : v === 'no' ? false : null)

export function AddCourseForm({
  catalog,
  categories,
  defaultCategory,
  admissionYear,
  isTransfer,
  onAdd,
}: {
  catalog: CatalogCourse[]
  categories: string[]
  defaultCategory: string
  admissionYear: number
  isTransfer: boolean
  onAdd: (course: Course) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    code: '',
    name: '',
    credits: '3',
    year: String(admissionYear),
    term: '1',
    category: '',
    grade: '',
    status: 'completed',
    offered: 'yes',
    prior: false,
  }))
  const [focused, setFocused] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const byCode = useMemo(() => new Map(catalog.map((c) => [c.course_code, c])), [catalog])
  const query = draft.code.trim()
  const suggestions = useMemo(() => {
    if (!query) return []
    const q = query.toUpperCase()
    return catalog
      .filter((c) => c.course_code.includes(q) || c.course_name.includes(query))
      .slice(0, 8)
  }, [catalog, query])

  const years = Array.from({ length: 9 }, (_, i) => admissionYear + i)
  const code = query.toUpperCase()
  const credits = Number(draft.credits)
  const category = draft.category.trim() || defaultCategory
  const valid = !!code && credits >= 0 && !!category

  /** 교육과정 과목을 고르면 이름 · 학점 · 개설 학부를 채운다 */
  function pick(item: CatalogCourse) {
    setDraft((d) => ({
      ...d,
      code: item.course_code,
      name: item.course_name,
      credits: String(item.credits),
      offered: toOffered(offeredByDepartment(item)),
    }))
    setFocused(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const known = byCode.get(code)
    onAdd({
      course_code: code,
      course_name: draft.name || known?.course_name || null,
      credits,
      semester: `${draft.year}-${draft.term}`,
      transcript_category: category,
      grade: draft.grade || null,
      status: draft.status,
      offered_by_computer_science: fromOffered(draft.offered),
      ...(isTransfer ? { prior_institution: draft.prior } : {}),
    })
    // 같은 학기 연속 입력이 많으니 학기 · 교과구분은 유지
    setDraft((d) => ({ ...d, code: '', name: '', credits: '3', grade: '', status: 'completed', offered: 'yes' }))
  }

  return (
    <form className={`${ui.card} ${styles.form}`} onSubmit={handleSubmit}>
      <div className={`${styles.field} ${styles.codeField}`}>
        <span>과목 (코드 또는 이름으로 검색)</span>
        <input
          className={ui.input}
          placeholder="예: COMP0204 또는 자료구조"
          value={draft.code}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // 목록 클릭이 먼저 처리되도록 잠시 뒤 닫는다
            setTimeout(() => setFocused(false), 150)
            const exact = byCode.get(draft.code.trim().toUpperCase())
            if (exact && !draft.name) pick(exact)
          }}
          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value, name: '' }))}
          required
        />
        <small className={ui.muted}>{draft.name || ' '}</small>
        {focused && suggestions.length > 0 && (
          <ul className={styles.suggest} role="listbox">
            {suggestions.map((c) => (
              <li key={c.course_code}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
                  <b>{c.course_name}</b>
                  <span>
                    {c.course_code} · {formatCredits(c.credits)}학점 · {c.curriculum_category}
                    {c.recommended_year ? ` · ${c.recommended_year}학년` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className={styles.field}>
        <span>학점</span>
        <input
          className={ui.input}
          type="number"
          min={0}
          max={30}
          step={0.5}
          value={draft.credits}
          onChange={(e) => set('credits', e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span>연도</span>
        <select className={ui.select} value={draft.year} onChange={(e) => set('year', e.target.value)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>학기</span>
        <select className={ui.select} value={draft.term} onChange={(e) => set('term', e.target.value)}>
          {TERMS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>교과구분 (성적표)</span>
        <input
          className={ui.input}
          list="transcript-categories"
          placeholder={defaultCategory}
          value={draft.category}
          onChange={(e) => set('category', e.target.value)}
        />
        <datalist id="transcript-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <label className={styles.field}>
        <span>성적</span>
        <select
          className={ui.select}
          value={draft.grade}
          onChange={(e) => {
            const grade = e.target.value as Grade | ''
            // F는 미취득으로 저장해야 평점에는 들어가고 학점에는 안 들어간다
            setDraft((d) => ({
              ...d,
              grade,
              status: grade === 'F' || grade === 'NP' ? 'failed' : d.status === 'failed' ? 'completed' : d.status,
            }))
          }}
        >
          <option value="">미입력</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>상태</span>
        <select className={ui.select} value={draft.status} onChange={(e) => set('status', e.target.value as CourseStatus)}>
          {COURSE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className={`${ui.button} ${styles.add}`} disabled={!valid}>
        추가
      </button>

      <div className={styles.extra}>
        <label className={styles.inline}>
          개설 학부
          <select className={ui.select} value={draft.offered} onChange={(e) => set('offered', e.target.value as Offered)}>
            <option value="yes">컴퓨터학부</option>
            <option value="no">다른 학과</option>
            <option value="unknown">모름</option>
          </select>
        </label>
        <span className={ui.muted}>전공 인정 여부가 달라져요. 교육과정에서 고르면 자동으로 채워져요.</span>
        {isTransfer && (
          <label className={styles.inline}>
            <input type="checkbox" checked={draft.prior} onChange={(e) => set('prior', e.target.checked)} />
            편입 전 학교에서 이수
          </label>
        )}
      </div>
    </form>
  )
}
