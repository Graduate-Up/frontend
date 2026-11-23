import type { ReactNode } from 'react'
import type { Source, StudentProfile } from '@/api'
import { ui } from '@/components/ui'
import { MAJOR_LABEL } from '@/types/student'

/** 학부 문의처 (시안 기준) */
const DEPT_EMAIL = 'scse@knu.ac.kr'

export function SourceCard({ sources, title = '근거 공지' }: { sources: Source[]; title?: string }) {
  if (!sources.length) return null
  const [main, ...rest] = sources
  return (
    <aside className={ui.sideCard}>
      <p className={ui.eyebrow}>{title}</p>
      <h3 style={{ marginTop: 8 }}>{main.title}</h3>
      {main.reference && (
        <p className={ui.muted} style={{ marginTop: 6 }}>
          {main.reference}
        </p>
      )}
      {main.url && (
        <a href={main.url} target="_blank" rel="noreferrer" className={ui.textLink} style={{ marginTop: 14 }}>
          원문 열기 ↗
        </a>
      )}
      {rest.length > 0 && (
        <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rest.slice(0, 4).map((s, i) => (
            <li key={i} className={ui.sub} style={{ fontSize: 12 }}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
          {rest.length > 4 && <li className={ui.muted}>외 {rest.length - 4}개 — 근거 공지 모음에서 볼 수 있어요</li>}
        </ul>
      )}
    </aside>
  )
}

export function InquiryCard({
  profile,
  studentNumber,
  topic,
  detail,
}: {
  profile: StudentProfile
  studentNumber: string | null
  topic?: string
  detail?: string
}) {
  const subject = `[졸업요건 문의] ${MAJOR_LABEL[profile.major].name} ${profile.admission_year}학번${topic ? ` - ${topic}` : ''}`
  const body = [
    '안녕하세요. 졸업요건 관련해 문의드립니다.',
    '',
    `소속: 컴퓨터학부 ${MAJOR_LABEL[profile.major].name}`,
    `학번: ${studentNumber ?? ''}`,
    '이름: ',
    '',
    topic ? `문의 항목: ${topic}` : '문의 항목: ',
    detail ? `현재 확인한 내용: ${detail}` : '',
    '',
    '문의 내용:',
    '',
    '감사합니다.',
  ].join('\n')
  const href = `mailto:${DEPT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <aside className={ui.sideCard}>
      <h3>판정이 이상한가요?</h3>
      <p className={ui.sub} style={{ marginTop: 8 }}>
        학과 문의 메일 초안을 만들어 드려요. 소속 · 학번 · 이름 형식을 지켜요.
      </p>
      <a href={href} className={ui.buttonBlock} style={{ marginTop: 16 }}>
        문의 메일 초안 만들기
      </a>
    </aside>
  )
}

export function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className={ui.sideCard}>
      <h3>{title}</h3>
      <div style={{ marginTop: 14 }}>{children}</div>
    </aside>
  )
}
