import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, login, register, sendEmailCode } from '@/api'
import { Logo } from '@/components/Logo'
import { useStudent } from '@/state/useStudent'
import styles from './LoginPage.module.css'

const POINTS = [
  '5개 세부전공 · 2017~2026학번 요건 지원',
  '모든 판정에 출처 공지 링크',
  '놓친 학점과 졸업 절차 마감까지',
]

type Mode = 'login' | 'register'

const KNU_DOMAIN = '@knu.ac.kr'
const DOMAIN_ERROR = '경북대학교 이메일로만 로그인할 수 있어요.'

/** 백엔드 학교 이메일 규칙 (영문·숫자로 시작, 앞부분 64자까지) */
const EMAIL_RE = /^[a-z0-9][a-z0-9_+.-]{0,63}@knu\.ac\.kr$/

function checkEmail(email: string): { email: string } | { error: string } {
  const value = email.trim().toLowerCase()
  if (!value.endsWith(KNU_DOMAIN)) return { error: DOMAIN_ERROR }
  if (!EMAIL_RE.test(value)) return { error: '이메일 주소 형식을 확인해주세요.' }
  return { email: value }
}

/** 예전(이메일 인증 전) 계정 아이디 = 이메일 앞부분. 백엔드 아이디 규칙에 맞을 때만 연결을 시도한다 */
const LEGACY_RE = /^[a-z0-9][a-z0-9_.-]{2,63}$/

const isLegacyError = (err: unknown) =>
  err instanceof ApiError && err.status === 400 && err.message.includes('기존 사용자')

function errorMessage(err: unknown, mode: Mode): string {
  if (err instanceof ApiError) {
    if (err.status === 401)
      return '이메일 또는 비밀번호가 맞지 않아요. 이메일 인증 전에 가입했다면 회원가입에서 인증하면 기록이 그대로 옮겨져요.'
    if (err.status === 409) return '이미 가입한 이메일이에요. 로그인해주세요.'
    if (err.status === 422) return '이메일 · 비밀번호 · 인증번호 형식을 확인해주세요.'
    return err.message
  }
  return mode === 'login'
    ? '로그인하지 못했어요. 잠시 후 다시 시도해주세요.'
    : '가입하지 못했어요. 잠시 후 다시 시도해주세요.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { loadAccount, startGuest } = useStudent()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [code, setCode] = useState('')
  /** 인증번호를 보낸 이메일 (주소를 바꾸면 다시 받아야 한다) */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isLogin = mode === 'login'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const parsed = checkEmail(email)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이에요.')
      return
    }
    if (!isLogin && !/^\d{6}$/.test(code.trim())) {
      setError(codeSentTo ? '이메일로 받은 인증번호 6자리를 입력해주세요.' : '먼저 인증번호를 받아주세요.')
      return
    }
    setSubmitting(true)
    try {
      const credentials = { email: parsed.email, password }
      if (!isLogin) {
        const registration = { ...credentials, code: code.trim() }
        const legacy = parsed.email.split('@')[0]
        // 예전 아이디 계정이 있으면 기록을 옮기고, 없으면 새로 만든다
        try {
          await register(LEGACY_RE.test(legacy) ? { ...registration, legacy_username: legacy } : registration)
        } catch (err) {
          if (!isLegacyError(err)) throw err
          await register(registration)
        }
      }
      await login(credentials)
      const hasProfile = await loadAccount()
      // 학적 정보를 아직 저장 안 했으면 온보딩부터
      navigate(hasProfile ? '/' : '/onboarding', { replace: true })
    } catch (err) {
      setError(errorMessage(err, mode))
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setMode(isLogin ? 'register' : 'login')
    setError(null)
    setNotice(null)
  }

  async function handleSendCode() {
    setError(null)
    setNotice(null)
    const parsed = checkEmail(email)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setSending(true)
    try {
      await sendEmailCode(parsed.email)
      setCodeSentTo(parsed.email)
      setNotice(`${parsed.email}로 인증번호를 보냈어요. 10분 안에 입력해주세요.`)
    } catch (err) {
      setError(errorMessage(err, 'register'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <Logo onDark size={32} />
        <h1 className={styles.heroTitle}>
          같은 학부여도
          <br />
          졸업요건은 다 달라요
        </h1>
        <p className={styles.heroSub}>학번 · 세부전공 · 트랙에 맞는 내 요건만, 공식 공지 근거와 함께 보여드려요.</p>
        <ol className={styles.points}>
          {POINTS.map((text, i) => (
            <li key={text}>
              <span className={styles.num}>{i + 1}</span>
              {text}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{isLogin ? '로그인' : '회원가입'}</h2>
          <p className={styles.cardSub}>
            경북대학교 이메일(<strong>{KNU_DOMAIN}</strong>)로만 {isLogin ? '로그인' : '가입'}할 수 있어요.
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.field}>
              <span>이메일</span>
              <div className={styles.inline}>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder={`학번 또는 아이디${KNU_DOMAIN}`}
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                />
                {!isLogin && (
                  <button type="button" className={styles.codeButton} disabled={sending} onClick={handleSendCode}>
                    {sending ? '보내는 중…' : codeSentTo ? '다시 받기' : '인증번호 받기'}
                  </button>
                )}
              </div>
            </label>
            {!isLogin && (
              <label className={styles.field}>
                <span>인증번호</span>
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="이메일로 받은 숫자 6자리"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
            )}
            {notice && <p className={styles.notice}>{notice}</p>}
            <label className={styles.field}>
              <span>비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {!isLogin && (
              <p className={styles.hint}>
                비밀번호는 8자 이상으로 정해주세요. 이메일 인증 전에 같은 아이디로 가입했다면 그때 비밀번호를 쓰면
                기록이 그대로 옮겨져요.
              </p>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? '잠시만요…' : isLogin ? '로그인' : '가입하고 시작하기'}
            </button>
          </form>

          <button type="button" className={styles.switch} onClick={switchMode}>
            {isLogin ? '처음이신가요? 회원가입' : '이미 계정이 있어요. 로그인'}
          </button>

          <div className={styles.divider}>또는</div>

          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              startGuest()
              navigate('/')
            }}
          >
            예시 학생으로 둘러보기
          </button>

          <p className={styles.note}>성적표 원본은 저장하지 않아요. 최종 졸업사정은 학부 사무실 확인이 필요합니다.</p>
        </div>
      </section>
    </div>
  )
}
