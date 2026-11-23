import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { ui } from '@/components/ui'
import { PORTAL_ORIGINS, isPortalCapture, savePendingCapture } from '@/state/portalTranscript'
import styles from './TranscriptReceiverPage.module.css'

/**
 * 북마클릿이 여는 창 (`/account?transcript=1`).
 * 통합정보시스템 창에 준비됐다고 알리고, 성적을 받으면 이수 내역 화면으로 넘긴다.
 */
export function TranscriptReceiverPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const fromPortal = params.get('transcript') === '1' && !!window.opener
  const [state, setState] = useState<'waiting' | 'timeout'>('waiting')

  useEffect(() => {
    if (!fromPortal) return
    const opener = window.opener as Window

    function onMessage(event: MessageEvent) {
      if (event.source !== opener || !PORTAL_ORIGINS.includes(event.origin) || !isPortalCapture(event.data)) return
      savePendingCapture(event.data)
      window.opener = null
      navigate('/courses?import=portal', { replace: true })
    }
    window.addEventListener('message', onMessage)
    // 통합정보시스템 창(북마클릿)이 이 신호를 기다린다
    for (const origin of PORTAL_ORIGINS) {
      try {
        opener.postMessage('jolup-transcript-ready', origin)
      } catch {
        /* 다른 주소면 무시 */
      }
    }
    const timer = setTimeout(() => setState('timeout'), 30000)
    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
    }
  }, [fromPortal, navigate])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo size={28} />
        {fromPortal && state === 'waiting' ? (
          <>
            <h1 className={styles.title}>통합정보시스템에서 성적을 받는 중이에요</h1>
            <p className={ui.sub}>이 창을 닫지 마세요. 표를 끝까지 읽는 데 몇 초 걸릴 수 있어요.</p>
            <div className={styles.spinner} aria-hidden />
          </>
        ) : (
          <>
            <h1 className={styles.title}>성적을 받지 못했어요</h1>
            <p className={ui.sub}>
              통합정보시스템의 성적 → 학기성적 → 이수성적조회 화면에서 '졸UP 성적 가져오기' 즐겨찾기를 눌러야 해요. 창이 차단됐다면 팝업을 허용하고
              다시 눌러주세요.
            </p>
            <Link to="/courses" className={ui.button} style={{ marginTop: 16 }}>
              이수 내역으로 가기
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
