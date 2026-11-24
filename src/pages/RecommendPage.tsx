import { useState } from 'react'
import { getMyRecommendations, type CareerTag, type CourseRecommendation, type ProgramRecommendation } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, Loading, PageIntro, formatCredits, ui } from '@/components/ui'
import { useCatalog, useEvaluation, useRequirements } from '@/state/queries'
import {
  CAREERS,
  CAREER_KEY,
  careerMatches,
  gainText,
  isServerCareer,
  loadCareer,
  recommend,
  shownGains,
  upcomingSemesters,
  type Career,
  type Recommendation,
} from '@/state/recommend'
import { useAsync } from '@/state/useAsync'
import { useProfile, useStudent } from '@/state/useStudent'
import { programName } from '@/content/programs'
import styles from './RecommendPage.module.css'

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
  /** 교육과정 출처 링크 */
  basisUrl?: string | null
  inferred: boolean
}

/** 프론트 계산 결과를 백엔드 추천 모양으로 맞춘다 (둘러보기) */
/**
 * 서버 추천 순서를 정리한다.
 * - 프론트엔드 · PM: 서버엔 진로를 안 보냈으니 과목명 키워드가 맞는 과목을 앞으로 (상위 3개도 다시 고른다)
 * - 내 융합전공 과목은 다른 후보 맨 앞으로
 */
function localCareerOrder(
  recommended: CourseRecommendation[],
  alternatives: CourseRecommendation[],
  career: Career,
  myProgram: string | null,
) {
  let top = recommended
  let rest = alternatives
  if (!isServerCareer(career) && career !== 'any') {
    const all = [...recommended, ...alternatives]
    const ordered = [
      ...all.filter((r) => careerMatches(career, r.course_name)),
      ...all.filter((r) => !careerMatches(career, r.course_name)),
    ]
    top = ordered.slice(0, recommended.length)
    rest = ordered.slice(recommended.length)
  }
  if (myProgram)
    rest = [...rest].sort(
      (a, b) => Number(b.program_ids.includes(myProgram)) - Number(a.program_ids.includes(myProgram)),
    )
  return { recommended: top, alternatives: rest }
}

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
  const { kind, courses, records, syncStatus, convergenceProgram } = useStudent()
  // 학적 변경에서 고른 융합전공
  const myProgram = convergenceProgram
  const [career, setCareer] = useState<Career>(loadCareer)
  const [showAll, setShowAll] = useState(false)
  // 들을 학기 — 보내면 백엔드가 그 학기 교양 영역까지 반영해 효과를 계산한다
  const semesterOptions = upcomingSemesters()
  const [targetSemester, setTargetSemester] = useState<string>(semesterOptions[0])
  const isAccount = kind === 'account'

  // 둘러보기: 프론트 계산
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  const catalog = useCatalog(profile)

  // 로그인: 서버에 저장된 이수 기록으로 백엔드 추천 (저장 중이면 끝난 뒤에)
  // 프론트엔드 · PM은 백엔드 진로 태그가 없어 진로 없이 요청하고, 순서는 과목명 키워드로 다시 정한다
  const careerTag: CareerTag | null = isServerCareer(career) ? career : null
  const server = useAsync(
    `recs:${careerTag}:${targetSemester}:${JSON.stringify(courses)}:${JSON.stringify(records)}`,
    isAccount && syncStatus !== 'saving'
      ? // 항상 AI 정렬을 요청한다 (백엔드는 진로를 골랐을 때만 AI로 순서를 정한다)
        (signal) =>
          getMyRecommendations({ career: careerTag, use_ai: true, target_semester: targetSemester || null }, { signal })
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
      ...localCareerOrder(d.recommended, d.alternatives, career, myProgram),
      programs: myProgram
        ? [...d.programs].sort((a, b) => Number(b.id === myProgram) - Number(a.id === myProgram))
        : d.programs,
      programNames: Object.fromEntries(d.programs.map((p) => [p.id, p.name])),
      ai: d.ranking === 'openai',
      basisUrl: d.curriculum_source.url ?? null,
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
              {isAccount && (
                <div className={styles.semester}>
                  <label>
                    <span className={styles.label}>들을 학기</span>
                    <select
                      className={ui.select}
                      value={targetSemester}
                      onChange={(e) => setTargetSemester(e.target.value)}
                    >
                      {semesterOptions.map((t) => (
                        <option key={t} value={t}>
                          {t.replace('-', '년 ')}학기
                        </option>
                      ))}
                      <option value="">정하지 않음</option>
                    </select>
                  </label>
                  {career === 'any' && (
                    <p className={styles.aiHint}>진로를 고르면 AI가 그 진로에 맞춰 순서를 정해요.</p>
                  )}
                </div>
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
                      myProgram={myProgram}
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
                            {careerMatches(career, r.course_name, r.career_tags) && (
                              <span className={styles.match}>진로 관련</span>
                            )}
                            {myProgram && r.program_ids.includes(myProgram) && (
                              <span className={styles.match}>내 융합전공</span>
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

            {(view.programs.length > 0 || myProgram) && <ProgramsCard programs={view.programs} myProgram={myProgram} />}

            <p className={ui.muted}>
              추천은 내 교육과정 과목 중에서만 해요. 각 과목의 효과는 그 과목 하나만 들었을 때 기준이라 여러 과목을
              더하면 안 맞을 수 있어요. 개설 여부 · 시간표는 수강신청 시스템에서 확인하세요. (교육과정:{' '}
              {view.basisUrl ? (
                <a href={view.basisUrl} target="_blank" rel="noreferrer">
                  {view.basis} ↗
                </a>
              ) : (
                view.basis
              )}
              {view.inferred ? ' · 내 학번 교육과정이 아니라 추정' : ''})
            </p>
          </>
        )}
      </div>
    </>
  )
}

/** 총 졸업학점은 거의 모든 과목에 붙어서, 다른 요건이 있으면 뺀다 */
function RecommendCard({
  rank,
  rec,
  career,
  programNames,
  myProgram,
}: {
  rank: number
  rec: CourseRecommendation
  career: Career
  programNames: Record<string, string>
  myProgram: string | null
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
        {myProgram && rec.program_ids.includes(myProgram) && <span className={styles.matchTag}>내 융합전공</span>}
        {!isServerCareer(career) && careerMatches(career, rec.course_name) && (
          <span className={styles.matchTag}>{CAREER_LABEL[career]}</span>
        )}
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
function ProgramsCard({ programs, myProgram }: { programs: ProgramRecommendation[]; myProgram: string | null }) {
  const myMissing = myProgram && !programs.some((p) => p.id === myProgram)
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>이어서 해볼 만한 융합전공 · 복수전공</h2>
        <span className={ui.muted}>이미 들은 과목이 겹치는 순</span>
      </div>
      <p className={ui.sub} style={{ marginTop: 6 }}>
        들은 과목과 관심 분야를 보고 골라 본 탐색 후보예요. 선발 여부와 학점 중복 인정은 해당 전공 공지에서 확인하세요.
      </p>
      <ul className={styles.programs}>
        {myMissing && (
          <li data-mine>
            <div className={styles.programHead}>
              <b>{programName(myProgram)}</b>
              <span className={styles.kind}>내 융합전공</span>
            </div>
            <p>아직 들은 과목 중 겹치는 과목이 없어요. 추천 과목에서 이 전공 과목을 확인해보세요.</p>
          </li>
        )}
        {programs.map((p) => (
          <li key={p.id} data-mine={p.id === myProgram || undefined}>
            <div className={styles.programHead}>
              <b>{p.name}</b>
              <span className={styles.kind}>{p.kind === 'convergence' ? '융합전공' : '복수전공'}</span>
            </div>
            {p.id === myProgram && <span className={styles.mine}>내 융합전공</span>}
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
