import type { EvaluationResponse } from '@/api'
import { formatCredits, ui } from '@/components/ui'
import { LIBERAL_AREA_GROUPS, NON_AREA, areaCategory, areaOf, unknownAreaCodes } from '@/content/liberalAreas'
import { useStudent } from '@/state/useStudent'
import styles from './LiberalAreaPicker.module.css'

/**
 * 영역 매핑표에 없는 교양 과목의 영역을 학생이 고른다.
 * 고른 영역은 교과구분에 '교양(인문·사회)'처럼 덧붙여 저장 → 백엔드가 그 영역으로 인정한다.
 */
export function LiberalAreaPicker({ evaluation }: { evaluation: EvaluationResponse | undefined }) {
  const { courses, setCourses } = useStudent()
  const unknown = new Set(evaluation?.requirements.flatMap((r) => unknownAreaCodes(r.details)) ?? [])
  // 아직 모르는 과목 + 이미 학생이 영역을 고른 교양 과목 (다시 바꿀 수 있게)
  const targets = courses.filter(
    (c) => c.status !== 'failed' && (unknown.has(c.course_code) || (c.transcript_category.startsWith('교양') && areaOf(c.transcript_category))),
  )
  if (!targets.length) return null
  const pending = targets.filter((c) => unknown.has(c.course_code) && !areaOf(c.transcript_category))

  function setArea(code: string, area: string) {
    setCourses((prev) =>
      prev.map((c) =>
        c.course_code === code ? { ...c, transcript_category: area ? areaCategory(area) : '교양' } : c,
      ),
    )
  }

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>교양 영역 지정</h2>
        {pending.length > 0 && <span className={styles.count}>영역을 모르는 과목 {pending.length}개</span>}
      </div>
      <p className={ui.sub} style={{ marginTop: 6 }}>
        졸UP 영역표에 없는 교양이에요. 수강편람이나 성적표에서 영역(첨성인기초 · 핵심 · 소양)을 확인해 골라주세요. 기초 · 핵심이
        아니면 '소양'을 고르면 돼요.
      </p>
      <div className={styles.rows}>
        {targets.map((c) => {
          const area = areaOf(c.transcript_category) ?? ''
          return (
            <div key={`${c.course_code}@${c.semester}`} className={styles.row} data-pending={!area}>
              <div className={styles.name}>
                <b>{c.course_name ?? c.course_code}</b>
                <span className={ui.muted}>
                  {c.course_code} · {formatCredits(c.credits)}학점
                </span>
              </div>
              <select
                className={ui.select}
                value={area}
                aria-label={`${c.course_name ?? c.course_code} 영역`}
                onChange={(e) => setArea(c.course_code, e.target.value)}
              >
                <option value="">영역 선택</option>
                {LIBERAL_AREA_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.areas.map((a) => (
                      <option key={a} value={a}>
                        {a === NON_AREA ? '소양 · 기타 (영역 요건 아님)' : a}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </section>
  )
}
