import { Link } from 'react-router-dom'
import type { Source, StudentProfile } from '@/api'
import { ui } from '@/components/ui'
import { currentSemesterIndex, currentStepIndex, guideFor } from '@/content/majorGuides'
import type { Alert } from '@/state/alerts'
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

/** 지금 챙길 것 — 상황에 맞게 부족한 것을 여러 개 (빨강: 입력했는데 부족, 틸: 아직 할 일) */
export function AlertsCard({ alerts, limit = 5 }: { alerts: Alert[]; limit?: number }) {
  if (!alerts.length) return null
  const shown = alerts.slice(0, limit)
  return (
    <aside className={ui.sideCard}>
      <h3>지금 챙길 것 {alerts.length}개</h3>
      <ul className={styles.alerts}>
        {shown.map((a) => (
          <li key={a.id} data-tone={a.tone}>
            <strong>{a.title}</strong>
            <p>{a.body}</p>
            <div className={styles.alertLinks}>
              <Link to={a.to}>{a.cta}</Link>
              {a.href && (
                <a href={a.href} target="_blank" rel="noreferrer">
                  신청하기 ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {alerts.length > shown.length && (
        <Link to="/requirements" className={styles.alertMore}>
          {alerts.length - shown.length}개 더 보기 ›
        </Link>
      )}
    </aside>
  )
}
