import { useState } from 'react'
import { getMyRecommendations, type CareerTag, type CourseRecommendation, type ProgramRecommendation } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, Loading, PageIntro, formatCredits, ui } from '@/components/ui'
import { useCatalog, useEvaluation, useRequirements } from '@/state/queries'
import { CAREERS, recommend, type Career, type Recommendation } from '@/state/recommend'
import { useAsync } from '@/state/useAsync'
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

const CAREER_LABEL = Object.fromEntries(CAREERS.map((c) => [c.id, c.label])) as Record<Career, string>

/** 화면에 그릴 추천 결과 (로그인: 백엔드 추천, 둘러보기: 프론트 계산) */
type View = {
  headline: string | null
  recommended: CourseRecommendation[]
  alternatives: CourseRecommendation[]
  programs: ProgramRecommendation[]
  programNames: Record<string, string>
  ai: boolean
  basis: string
  inferred: boolean
}

/** 프론트 계산 결과를 백엔드 추천 모양으로 맞춘다 (둘러보기) */
function toCourseRecommendation(r: Recommendation): CourseRecommendation {
  return {
    course_code: r.course.course_code,
    course_name: r.course.course_name,
    credits: r.course.credits,
    curriculum_category: r.course.curriculum_category,
    recommended_year: r.course.recommended_year,
    recommended_semester: r.course.recommended_semester,
    gains: r.fills.map((name) => ({ requirement_id: '', name, amount: 0 })),
    career_tags: r.course.career_tags ?? [],
    reason: r.reason,
    program_ids: [],
  }
}

export function RecommendPage() {
  const profile = useProfile()
  const { kind, courses, records, syncStatus } = useStudent()
  const [career, setCareer] = useState<Career>(loadCareer)
  const [showAll, setShowAll] = useState(false)
  const isAccount = kind === 'account'

  // 둘러보기: 프론트 계산
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  const catalog = useCatalog(profile)

  // 로그인: 서버에 저장된 이수 기록으로 백엔드 추천 (저장 중이면 끝난 뒤에)
  const careerTag: CareerTag | null = career === 'any' ? null : career
  const server = useAsync(
    `recs:${careerTag}:${JSON.stringify(courses)}:${JSON.stringify(records)}`,
    isAccount && syncStatus !== 'saving'
      ? // 항상 AI 정렬을 요청한다 (백엔드는 진로를 골랐을 때만 AI로 순서를 정한다)
        (signal) => getMyRecommendations({ career: careerTag, use_ai: true }, { signal })
      : null,
  )

  let view: View | null = null
  if (isAccount && server.data) {
    const d = server.data
    const missing = d.missing_course_requirements.filter((m) => m.requirement_id !== 'total')
    view = {
      headline: missing.length
        ? missing
            .slice(0, 3)
            .map((m) => `${m.name.replace(/\s*\d+(학점|과목)$/, '')} ${formatCredits(m.amount)}`)
            .join(' · ')
        : null,
      recommended: d.recommended,
      alternatives: d.alternatives,
      programs: d.programs,
      programNames: Object.fromEntries(d.programs.map((p) => [p.id, p.name])),
      ai: d.ranking === 'openai',
      basis: d.curriculum_source.title,
      inferred: d.inferred,
    }
  } else if (!isAccount && rule.data && evaluation.data && catalog.data) {
    const local = recommend(profile, rule.data, evaluation.data, catalog.data.items, courses, career)
    const items = local.items.map(toCourseRecommendation)
    view = {
      headline: local.headline,
      recommended: items.slice(0, 3),
      alternatives: items.slice(3),
      programs: [],
      programNames: {},
      ai: false,
      basis: catalog.data.basis,
      inferred: catalog.data.inferred,
    }
  }
  const error = isAccount ? server.error : (rule.error ?? evaluation.error ?? catalog.error)

  function pickCareer(c: Career) {
    setCareer(c)
    try {
      localStorage.setItem(CAREER_KEY, c)
    } catch {
      // 무시
    }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: '과목 추천' }]} right={view?.inferred ? '교육과정 추정 데이터' : undefined} />
      <div className={ui.page}>
        {error ? <ErrorState error={error} /> : !view && <Loading label="후보 과목을 고르는 중…" />}
        {view && (
          <>
            <PageIntro
              heading={
                view.headline
                  ? `남은 ${view.headline}, 진로에 맞게 채워요`
                  : '남은 요건이 없어요. 관심 분야로 더 들어보세요'
              }
              lead={
                isAccount
                  ? '졸UP이 들으면 부족한 요건이 줄어드는 과목만 고르고, 선수과목을 안 들은 과목은 빼요. 진로를 고르면 그 분야 과목을 앞으로 올려요.'
                  : '둘러보기에서는 이 브라우저의 이수 내역으로 계산해요. 로그인하면 선수과목 · 융합전공까지 반영한 추천을 받아요.'
              }
            />

            <div className={styles.controls}>
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
              {isAccount && career === 'any' && (
                <p className={styles.aiHint}>진로를 고르면 AI가 그 진로에 맞춰 순서를 정해요.</p>
              )}
            </div>

            {server.status === 'loading' && server.data && <p className={ui.muted}>다시 고르는 중…</p>}

            {view.recommended.length === 0 ? (
              <p className={ui.sub}>
                추천할 과목이 없어요. 교육과정 과목을 이미 다 들었거나, 남은 요건이 과목으로 채우는 게 아니에요.
              </p>
            ) : (
              <>
                {view.ai && (
                  <span className={styles.aiBadge}>AI가 {CAREER_LABEL[career]} 진로에 맞춰 순서를 정했어요</span>
                )}
                <div className={styles.cards}>
                  {view.recommended.map((r, i) => (
                    <RecommendCard
                      key={r.course_code}
                      rank={i + 1}
                      rec={r}
                      career={career}
                      programNames={view!.programNames}
                    />
                  ))}
                </div>
              </>
            )}

            {view.alternatives.length > 0 && (
              <section className={ui.card}>
                <div className={ui.cardHead}>
                  <h2 className={ui.cardTitle}>다른 후보 {view.alternatives.length}개</h2>
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
                      {(showAll ? view.alternatives : view.alternatives.slice(0, 10)).map((r) => (
                        <tr key={r.course_code}>
                          <td className={ui.code}>{r.course_code}</td>
                          <td>
                            <b>{r.course_name}</b>
                            {career !== 'any' && r.career_tags.includes(career) && (
                              <span className={styles.match}>진로 관련</span>
                            )}
                          </td>
                          <td>{formatCredits(r.credits)}</td>
                          <td>{r.recommended_year ? `${r.recommended_year}-${r.recommended_semester ?? ''}` : '-'}</td>
                          <td>
                            {shownGains(r)
                              .map((g) => gainText(g))
                              .join(' · ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {view.alternatives.length > 10 && (
                  <button
                    type="button"
                    className={ui.linkButton}
                    style={{ marginTop: 12 }}
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? '접기' : `${view.alternatives.length - 10}개 더 보기`}
                  </button>
                )}
              </section>
            )}

            {view.programs.length > 0 && <ProgramsCard programs={view.programs} />}

            <p className={ui.muted}>
              추천은 내 교육과정 과목 중에서만 해요. 개설 여부 · 시간표는 수강신청 시스템에서 확인하세요. ({view.basis})
            </p>
          </>
        )}
      </div>
    </>
  )
}

/** 총 졸업학점은 거의 모든 과목에 붙어서, 다른 요건이 있으면 뺀다 */
const shownGains = (r: CourseRecommendation) => {
  const specific = r.gains.filter((g) => g.requirement_id !== 'total')
  return specific.length ? specific : r.gains
}

/** 예: 전공학점 −3 (백엔드는 줄어드는 양, 프론트 계산은 이름만) */
function gainText(g: { name: string; amount: number }) {
  return g.amount > 0 ? `${g.name} −${formatCredits(g.amount)}` : g.name
}

function RecommendCard({
  rank,
  rec,
  career,
  programNames,
}: {
  rank: number
  rec: CourseRecommendation
  career: Career
  programNames: Record<string, string>
}) {
  const programs = rec.program_ids.map((id) => programNames[id]).filter(Boolean)
  return (
    <article className={styles.card} data-first={rank === 1}>
      <div className={styles.cardTop}>
        <span className={styles.rank}>추천 {rank}</span>
        <span className={ui.muted}>
          {rec.curriculum_category.replace(/\(.*\)/, '')} {formatCredits(rec.credits)}학점
        </span>
      </div>
      <h3>{rec.course_name}</h3>
      <span className={ui.muted}>
        {rec.course_code}
        {rec.recommended_year ? ` · 권장 ${rec.recommended_year}학년 ${rec.recommended_semester ?? ''}학기` : ''}
      </span>
      <div className={styles.tags}>
        {shownGains(rec).map((g) => (
          <span key={g.name} className={styles.fill}>
            {gainText(g)}
          </span>
        ))}
        {rec.career_tags.map((t) => (
          <span key={t} className={t === career ? styles.matchTag : styles.tagMuted}>
            {CAREER_LABEL[t]}
          </span>
        ))}
      </div>
      <p>{rec.reason}</p>
      {programs.length > 0 && <p className={styles.programNote}>융합전공 과목이기도 해요: {programs.join(', ')}</p>}
    </article>
  )
}

/** 융합전공 · 복수전공 — 이미 들은 과목이 겹치거나 진로와 이어지는 전공 */
function ProgramsCard({ programs }: { programs: ProgramRecommendation[] }) {
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>이어서 해볼 만한 융합전공 · 복수전공</h2>
        <span className={ui.muted}>이미 들은 과목이 겹치는 순</span>
      </div>
      <ul className={styles.programs}>
        {programs.map((p) => (
          <li key={p.id}>
            <div className={styles.programHead}>
              <b>{p.name}</b>
              <span className={styles.kind}>{p.kind === 'convergence' ? '융합전공' : '복수전공'}</span>
            </div>
            <p>
              {p.overlapping_course_codes.length > 0 &&
                `이미 들은 과목 ${p.overlapping_course_codes.length}개가 겹쳐요`}
              {p.overlapping_course_codes.length > 0 && p.related_course_codes.length > 0 && ' · '}
              {p.related_course_codes.length > 0 && `진로 · 관심 분야 과목 ${p.related_course_codes.length}개`}
            </p>
            <small className={ui.muted}>
              근거: {p.source.title}
              {p.source.reference ? ` · ${p.source.reference}` : ''}
            </small>
          </li>
        ))}
      </ul>
    </section>
  )
}
