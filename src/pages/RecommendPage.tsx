import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, Loading, PageIntro, formatCredits, ui } from '@/components/ui'
import { useCatalog, useEvaluation, useRequirements } from '@/state/queries'
import { CAREERS, recommend, type Career, type Recommendation } from '@/state/recommend'
import { useProfile, useStudent } from '@/state/useStudent'
import styles from './RecommendPage.module.css'

const CAREER_KEY = 'graduate-up.career'

function loadCareer(): Career {
  try {
    const v = localStorage.getItem(CAREER_KEY)
    if (v && CAREERS.some((c) => c.id === v)) return v as Career
  } catch {
    // 저장소를 못 쓰면 기본값
  }
  return 'any'
}

export function RecommendPage() {
  const profile = useProfile()
  const { courses, records } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  const catalog = useCatalog(profile)
  const [career, setCareer] = useState<Career>(loadCareer)
  const [showAll, setShowAll] = useState(false)
  const error = rule.error ?? evaluation.error ?? catalog.error
  const ready = rule.data && evaluation.data && catalog.data
  const result = ready ? recommend(profile, rule.data!, evaluation.data!, catalog.data!.items, courses, career) : null

  function pickCareer(c: Career) {
    setCareer(c)
    try {
      localStorage.setItem(CAREER_KEY, c)
    } catch {
      // 무시
    }
  }

  const top = result?.items.slice(0, 3) ?? []
  const rest = result?.items.slice(3) ?? []

  return (
    <>
      <PageHeader crumbs={[{ label: '과목 추천' }]} right={catalog.data?.inferred ? '교육과정 추정 데이터' : undefined} />
      <div className={ui.page}>
        {error ? <ErrorState error={error} /> : !result && <Loading label="후보 과목을 고르는 중…" />}
        {result && (
          <>
            <PageIntro
              heading={result.headline ? `남은 ${result.headline}, 진로에 맞게 채워요` : '남은 요건이 없어요. 관심 분야로 더 들어보세요'}
              lead="졸UP이 남은 요건을 채우는 과목 중 아직 안 들은 것만 고르고, 진로에 맞춰 순서를 정해요."
            />

            <div>
              <p className={styles.label}>진로희망</p>
              <div className={styles.careers} role="radiogroup" aria-label="진로희망">
                {CAREERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={career === c.id}
                    className={styles.career}
                    data-active={career === c.id}
                    onClick={() => pickCareer(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {top.length === 0 ? (
              <p className={ui.sub}>추천할 과목이 없어요. 교육과정 과목을 이미 다 들었거나, 남은 요건이 과목으로 채우는 게 아니에요.</p>
            ) : (
              <div className={styles.cards}>
                {top.map((r, i) => (
                  <RecommendCard key={r.course.course_code} rank={i + 1} rec={r} />
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <section className={ui.card}>
                <div className={ui.cardHead}>
                  <h2 className={ui.cardTitle}>다른 후보 {rest.length}개</h2>
                </div>
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead>
                      <tr>
                        <th>과목코드</th>
                        <th>과목명</th>
                        <th>학점</th>
                        <th>권장 학기</th>
                        <th>채우는 요건</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? rest : rest.slice(0, 10)).map((r) => (
                        <tr key={r.course.course_code}>
                          <td className={ui.code}>{r.course.course_code}</td>
                          <td>
                            <b>{r.course.course_name}</b>
                            {r.careerMatch && <span className={styles.match}>진로 관련</span>}
                          </td>
                          <td>{formatCredits(r.course.credits)}</td>
                          <td>
                            {r.course.recommended_year
                              ? `${r.course.recommended_year}-${r.course.recommended_semester ?? ''}`
                              : '-'}
                          </td>
                          <td>{r.fills.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rest.length > 10 && (
                  <button type="button" className={ui.linkButton} style={{ marginTop: 12 }} onClick={() => setShowAll((v) => !v)}>
                    {showAll ? '접기' : `${rest.length - 10}개 더 보기`}
                  </button>
                )}
              </section>
            )}

            <p className={ui.muted}>
              추천은 내 교육과정 과목 중에서만 해요. 선수과목 · 개설 여부 · 시간표는 수강편람과 수강신청 시스템에서 확인하세요.
              {catalog.data?.basis ? ` (${catalog.data.basis})` : ''}
            </p>
          </>
        )}
      </div>
    </>
  )
}

function RecommendCard({ rank, rec }: { rank: number; rec: Recommendation }) {
  const c = rec.course
  return (
    <article className={styles.card} data-first={rank === 1}>
      <div className={styles.cardTop}>
        <span className={styles.rank}>추천 {rank}</span>
        <span className={ui.muted}>
          {c.curriculum_category.replace(/\(.*\)/, '')} {formatCredits(c.credits)}학점
        </span>
      </div>
      <h3>{c.course_name}</h3>
      <span className={ui.muted}>{c.course_code}</span>
      <div className={styles.tags}>
        {rec.fills.map((f) => (
          <span key={f} className={styles.fill}>
            {f}
          </span>
        ))}
        {rec.required && <span className={styles.required}>필수</span>}
        {rec.careerMatch && <span className={styles.matchTag}>진로 관련</span>}
      </div>
      <p>{rec.reason}</p>
    </article>
  )
}
