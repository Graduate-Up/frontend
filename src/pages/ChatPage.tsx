import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, askGraduationChat, getMyRecommendations, type Course, type Source } from '@/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { errorText } from '@/components/ui'
import { gainText, isServerCareer, loadCareer, shownGains, upcomingSemesters } from '@/state/recommend'
import { useStudent } from '@/state/useStudent'
import styles from './ChatPage.module.css'

/** 과목 추천 API 결과 한 줄 (이수한 과목 · 선수과목 미충족 과목은 서버가 이미 뺀 목록) */
type RecItem = { code: string; name: string; credits: number; gains: string }

type Message =
  | { role: 'user'; text: string }
  | { role: 'bot'; text: string; sources: Source[]; recs?: RecItem[] }
  | { role: 'error'; text: string; needsProfile?: boolean; recs?: RecItem[] }

/** '과목 추천해줘', '다음 학기에 뭐 들을까' 같은 질문 */
const RECOMMEND_QUESTION = /추천|뭐\s*(를\s*)?들|무슨\s*과목|어떤\s*과목|들을\s*(만한|과목)|수강\s*(할|하면|계획)/

/** 챗봇과 별개로 규칙 엔진 추천을 받아 붙인다 (AI 답변은 내 이수 과목을 다 모르고 답할 수 있어서) */
async function fetchRecs(): Promise<RecItem[] | undefined> {
  try {
    const career = loadCareer()
    const res = await getMyRecommendations({
      career: isServerCareer(career) ? career : null,
      use_ai: false,
      target_semester: upcomingSemesters()[0],
    })
    return [...res.recommended, ...res.alternatives].slice(0, 5).map((r) => ({
      code: r.course_code,
      name: r.course_name,
      credits: r.credits,
      gains: shownGains(r).map(gainText).join(' · '),
    }))
  } catch {
    return undefined
  }
}

/** 과목명이 다른 과목명의 일부(자료구조 ⊂ 자료구조응용)로만 나오면 세지 않는다 */
const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function mentionsCourse(text: string, c: Course) {
  if (text.toUpperCase().includes(c.course_code.toUpperCase())) return true
  const name = c.course_name?.trim()
  if (!name || name.length < 2) return false
  return new RegExp(`(^|[^가-힣A-Za-z0-9])${escapeRe(name)}($|[^가-힣A-Za-z0-9])`).test(text)
}

const SUGGESTIONS = [
  '전공학점이 얼마나 부족해요?',
  '이번 학기에 졸업할 수 있어요?',
  '교과구분 변경 신청은 어떻게 해요?',
  '졸업 전에 꼭 챙겨야 할 게 뭐예요?',
]

/** 이 탭에서만 대화를 기억한다 (새로고침해도 유지, 다른 기기 · 서버에는 안 남음) */
const STORAGE_KEY = 'graduate-up.chat'

function readMessages(): Message[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as Message[]
  } catch {
    return []
  }
}

function errorMessage(err: unknown): Message {
  if (err instanceof ApiError && err.status === 409)
    return { role: 'error', text: '학적 정보를 먼저 저장해야 답할 수 있어요.', needsProfile: true }
  if (err instanceof ApiError && err.status === 503)
    return { role: 'error', text: '지금은 AI 답변을 받을 수 없어요. 잠시 뒤에 다시 물어봐 주세요.' }
  return { role: 'error', text: errorText(err) }
}

/** **굵게** 정도만 살리고 나머지는 그대로 (줄바꿈은 CSS로) */
function richText(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))
}

export function ChatPage() {
  const { kind, syncStatus, courses } = useStudent()
  const completed = courses.filter((c) => c.status === 'completed')
  const [messages, setMessages] = useState<Message[]>(readMessages)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const isAccount = kind === 'account'

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      // 저장 못 해도 대화는 계속된다
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || pending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setPending(true)
    const recsPromise = RECOMMEND_QUESTION.test(q) ? fetchRecs() : Promise.resolve(undefined)
    try {
      const res = await askGraduationChat(q)
      const recs = await recsPromise
      setMessages((prev) => [...prev, { role: 'bot', text: res.answer, sources: res.sources, recs }])
    } catch (err) {
      const recs = await recsPromise
      setMessages((prev) => [...prev, { ...errorMessage(err), recs } as Message])
    } finally {
      setPending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(input)
  }

  const last = messages[messages.length - 1]

  return (
    <>
      <PageHeader
        crumbs={[{ label: '챗봇에게 질문하기' }]}
        right={
          messages.length > 0 && (
            <button type="button" className={styles.reset} onClick={() => setMessages([])}>
              대화 지우기
            </button>
          )
        }
      />
      <div className={styles.page}>
        <div className={styles.thread}>
          {messages.length === 0 && (
            <div className={styles.intro}>
              <span className={styles.avatar} aria-hidden>
                <i />
              </span>
              <div>
                <h1>졸업요건, 물어보세요</h1>
                <p>
                  저장된 내 학적과 이수 내역으로 판정한 결과를 근거로 답해요. 과목코드나 과목명을 넣으면 그 과목이
                  어디에 인정됐는지도 같이 봐요.
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className={styles.user}>
                {m.text}
              </div>
            ) : (
              <div key={i} className={styles.botRow}>
                <span className={styles.avatar} aria-hidden>
                  <i />
                </span>
                <div className={styles.bot} data-error={m.role === 'error' || undefined}>
                  {m.role === 'bot' && <span className={styles.badge}>내 판정 결과 기준 · AI 답변</span>}
                  <p className={styles.answer}>{richText(m.text)}</p>
                  {m.role === 'bot' && <TakenNote text={m.text} completed={completed} />}
                  {m.recs && m.recs.length > 0 && <RecsCard recs={m.recs} />}
                  {m.role === 'error' && m.needsProfile && (
                    <Link to="/onboarding" className={styles.errorLink}>
                      학적 정보 입력하기 →
                    </Link>
                  )}
                  {m.role === 'bot' && m.sources.length > 0 && (
                    <div className={styles.sources}>
                      <span>근거</span>
                      {m.sources.map((s, j) =>
                        s.url ? (
                          <a key={j} href={s.url} target="_blank" rel="noreferrer">
                            {s.title}
                            {s.reference ? ` · ${s.reference}` : ''} ↗
                          </a>
                        ) : (
                          <span key={j}>
                            {s.title}
                            {s.reference ? ` · ${s.reference}` : ''}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className={styles.botRow}>
              <span className={styles.avatar} aria-hidden>
                <i />
              </span>
              <div className={styles.bot}>
                <span className={styles.typing} aria-label="답변 준비 중">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}

          {isAccount && !pending && (messages.length === 0 || last?.role === 'bot') && (
            <div className={styles.chips}>
              {SUGGESTIONS.filter((s) => !messages.some((m) => m.role === 'user' && m.text === s)).map((s) => (
                <button key={s} type="button" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className={styles.composer}>
          {isAccount ? (
            <form className={styles.inputRow} onSubmit={onSubmit}>
              <input
                value={input}
                maxLength={2000}
                placeholder="졸업요건에 대해 물어보세요"
                aria-label="질문"
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" disabled={!input.trim() || pending} aria-label="보내기">
                ↑
              </button>
            </form>
          ) : (
            <p className={styles.guest}>
              챗봇은 저장된 학적 · 이수 기록으로 답해서 로그인해야 쓸 수 있어요. <Link to="/login">로그인하기 →</Link>
            </p>
          )}
          <p className={styles.note}>
            {syncStatus === 'saving'
              ? '이수 내역을 저장하는 중이에요. 저장이 끝난 뒤 물어보면 바뀐 내용으로 답해요.'
              : '판정은 규칙 엔진이 하고, AI는 결과를 설명만 해요. 계정 정보와 성적표 전체는 AI에 보내지 않아요.'}
          </p>
        </div>
      </div>
    </>
  )
}

/** 답변에 이미 이수한 과목이 나오면 알려준다 (AI가 내 이수 과목을 다 모르고 답할 수 있어서) */
function TakenNote({ text, completed }: { text: string; completed: Course[] }) {
  const taken = completed.filter((c) => mentionsCourse(text, c))
  if (!taken.length) return null
  const names = [...new Set(taken.map((c) => c.course_name || c.course_code))]
  return (
    <p className={styles.takenNote}>
      <b>이미 이수한 과목이 답변에 있어요:</b> {names.join(' · ')}. 재수강할 게 아니면 다시 들을 필요 없어요.
    </p>
  )
}

/** 규칙 엔진 추천 — 이수한 과목과 선수과목을 안 들은 과목은 빠진 목록 */
function RecsCard({ recs }: { recs: RecItem[] }) {
  return (
    <div className={styles.recs}>
      <div className={styles.recsHead}>
        <b>졸UP 추천 과목</b>
        <span>이수한 과목 · 선수과목 미충족 과목 제외</span>
      </div>
      <ul>
        {recs.map((r) => (
          <li key={r.code}>
            <b>{r.name}</b>
            <span>
              {r.code} · {r.credits}학점
            </span>
            {r.gains && <em>{r.gains}</em>}
          </li>
        ))}
      </ul>
      <Link to="/recommend" className={styles.recsLink}>
        과목 추천에서 진로별로 더 보기 →
      </Link>
    </div>
  )
}
