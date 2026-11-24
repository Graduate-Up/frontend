import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '@/api'
import { Logo } from '@/components/Logo'
import { errorText, ui } from '@/components/ui'
import { useStudent } from '@/state/useStudent'
import styles from './TranscriptReceiverPage.module.css'

/** 시연용 데모 계정 — 발표 자료 · QR에 공개된 계정이라 코드에 둬도 된다 (백엔드 JOLUP_DEMO_EMAIL · PASSWORD와 같아야 함) */
const DEMO_CREDENTIALS = { email: 'jolup-demo@knu.ac.kr', password: '12345678' }

/** `/demo` — QR로 들어오면 데모 계정으로 바로 로그인해서 내 졸업 현황으로 보낸다 */
export function DemoPage() {
  const navigate = useNavigate()
  const { loadAccount } = useStudent()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // 개발 모드에서 effect가 두 번 돌아도 로그인은 한 번만
    if (started.current) return
    started.current = true
    login(DEMO_CREDENTIALS)
      .then(() => loadAccount())
      .then((hasProfile) => navigate(hasProfile ? '/' : '/onboarding', { replace: true }))
      .catch((err: unknown) => setError(errorText(err)))
  }, [loadAccount, navigate])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo size={28} />
        {error ? (
          <>
            <h1 className={styles.title}>데모 계정으로 들어가지 못했어요</h1>
            <p className={ui.sub}>
              {error} 서버가 잠들어 있으면 처음 접속에 1분쯤 걸릴 수 있어요. 잠시 뒤 다시 시도하거나 둘러보기로 체험해
              주세요.
            </p>
            <Link to="/login" className={ui.button} style={{ marginTop: 16 }}>
              로그인 화면으로
            </Link>
          </>
        ) : (
          <>
            <h1 className={styles.title}>데모 계정으로 들어가는 중이에요</h1>
            <p className={ui.sub}>
              가상 학생의 이수 내역으로 졸UP을 체험할 수 있어요. 처음 접속은 조금 걸릴 수 있어요.
            </p>
            <div className={styles.spinner} aria-hidden />
          </>
        )}
      </div>
    </div>
  )
}
