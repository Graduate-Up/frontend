import type { GraduationRule, Source } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, Loading, PageIntro, ui } from '@/components/ui'
import { useRequirements } from '@/state/queries'
import { useProfile } from '@/state/useStudent'
import { MAJOR_LABEL } from '@/types/student'
import styles from './NoticesPage.module.css'

type Notice = { source: Source; usedBy: string[] }

const keyOf = (s: Source) => `${s.title}|${s.url ?? ''}`

/** 요건별 근거 공지를 모아 어떤 요건에 쓰였는지 붙인다 */
function collectNotices(rule: GraduationRule): Notice[] {
  const map = new Map<string, Notice>()
  const add = (sources: Source[] | undefined, usedBy: string) => {
    for (const s of sources ?? []) {
      const notice = map.get(keyOf(s)) ?? { source: s, usedBy: [] }
      if (!notice.usedBy.includes(usedBy)) notice.usedBy.push(usedBy)
      map.set(keyOf(s), notice)
    }
  }
  for (const r of rule.credit_requirements) add(r.sources, r.name)
  for (const r of rule.course_requirements) add(r.sources, r.name)
  for (const r of rule.nonacademic_requirements) add(r.sources, r.name)
  for (const r of rule.verification_requirements ?? []) add(r.sources, r.name)
  // 요건 쪽에 안 붙은 공지만 '졸업요건 전체'로 (백엔드가 규칙 전체 출처에 요건 출처를 합쳐서 보낸다)
  for (const s of rule.sources) if (!map.has(keyOf(s))) map.set(keyOf(s), { source: s, usedBy: ['졸업요건 전체'] })
  return [...map.values()].sort((a, b) => b.usedBy.length - a.usedBy.length)
}

export function NoticesPage() {
  const profile = useProfile()
  const rule = useRequirements(profile)
  const notices = rule.data ? collectNotices(rule.data) : []

  return (
    <>
      <PageHeader crumbs={[{ label: '근거 공지 모음' }]} />
      <div className={ui.page}>
        <PageIntro
          heading="근거 공지 모음"
          lead={`${MAJOR_LABEL[profile.major].name} ${profile.admission_year}학번 졸업요건을 정한 공지와 규정이에요. 판정이 이상하면 원문을 확인해보세요.`}
        />
        {rule.status === 'loading' && !rule.data && <Loading />}
        {rule.status === 'error' && <ErrorState error={rule.error} />}
        {rule.data && notices.length === 0 && <EmptyState>연결된 공지가 없어요.</EmptyState>}

        {notices.length > 0 && <NoticeList notices={notices} />}
      </div>
    </>
  )
}

function NoticeList({ notices }: { notices: Notice[] }) {
  return (
    <ul className={styles.list}>
      {notices.map(({ source, usedBy }) => (
        <li key={keyOf(source)} className={ui.card}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>{source.title}</h2>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer" className={ui.buttonGhost}>
                원문 보기 ↗
              </a>
            )}
          </div>
          {source.reference && (
            <p className={ui.sub} style={{ marginTop: 4 }}>
              {source.reference}
            </p>
          )}
          <div className={ui.chips} style={{ marginTop: 12 }}>
            {usedBy.map((name) => (
              <span key={name} className={ui.chip}>
                {name}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
