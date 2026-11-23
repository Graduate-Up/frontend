import { Link } from 'react-router-dom'
import type { Source, StudentProfile } from '@/api'
import { ui } from '@/components/ui'
import { formatCredits } from '@/components/ui/helpers'
import { currentSemesterIndex, currentStepIndex, guideFor } from '@/content/majorGuides'
import type { RequirementView } from '@/state/requirementView'
import styles from './GuideCards.module.css'

export function RoadmapCard({ profile }: { profile: StudentProfile }) {
  const { roadmap } = guideFor(profile.major)
  const now = currentStepIndex(roadmap.steps, currentSemesterIndex(profile.admission_year))
  return (
    <aside className={ui.sideCard}>
      <h3>{roadmap.title}</h3>
      <p className={ui.muted} style={{ marginTop: 4 }}>
        {roadmap.sub}
      </p>
      <ol className={styles.timeline}>
        {roadmap.steps.map((s, i) => (
          <li key={s.label} data-state={i < now ? 'past' : i === now ? 'now' : 'next'}>
            <span className={styles.dot} />
            <div>
              <strong>
                {s.label}
                {i === now && <span className={styles.nowTag}>지금</span>}
              </strong>
              <p>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}

/** 지금부터 챙겨야 할 비교과 하나를 강조 */
export function HighlightCard({ profile, views }: { profile: StudentProfile; views: RequirementView[] }) {
  const guide = guideFor(profile.major).highlight
  const fromGuide = guide && views.find((v) => v.id === guide.requirementId && v.result.status !== 'satisfied')
  // 전공 전용 문구가 없으면: 횟수 · 학점처럼 쌓아야 하는 비교과 중 아직 못 채운 첫 항목
  const fallback = views.find(
    (v) => v.group === 'nonacademic' && !!v.unit && v.unit !== '점' && v.result.status === 'unsatisfied',
  )
  const view = fromGuide || fallback
  if (!view) return null

  const r = view.result
  const title = fromGuide ? guide!.title : `${view.name}, 지금부터 챙기세요`
  const body = fromGuide
    ? guide!.body
    : `졸업까지 ${formatCredits(r.required)}${view.unit}이 필요해요. 한 번에 채우기 어려우니 학기마다 나눠서 쌓아두세요.`
  const progress = r.current > 0 ? ` 지금 ${formatCredits(r.current)}${view.unit} 기록했어요.` : ''

  return (
    <aside className={ui.highlight}>
      <h3>{title}</h3>
      <p className={styles.highlightBody}>
        {body}
        {progress}
      </p>
      <Link to={`/requirements/${encodeURIComponent(view.id)}#record`} className={styles.cta}>
        {fromGuide ? guide!.cta : '기록 추가 +'}
      </Link>
    </aside>
  )
}

export function InfoCard({ profile, sources }: { profile: StudentProfile; sources: Source[] }) {
  const info = guideFor(profile.major).info
  if (!info) return null
  const source = sources.find((s) => s.title.includes(info.sourceMatch))
  return (
    <aside className={ui.sideCard}>
      <h3>{info.title}</h3>
      <p className={ui.sub} style={{ marginTop: 10, lineHeight: 1.75 }}>
        {info.body}
      </p>
      {source && (
        <p className={ui.muted} style={{ marginTop: 12 }}>
          근거:{' '}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title} ↗
            </a>
          ) : (
            source.title
          )}
        </p>
      )}
    </aside>
  )
}
