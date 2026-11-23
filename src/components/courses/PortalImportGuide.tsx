import { useEffect, useRef, useState } from 'react'
import { getBookmarkletSource } from '@/api'
import { ui } from '@/components/ui'
import { PORTAL_URL } from '@/state/portalTranscript'
import styles from './PortalImportGuide.module.css'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * 통합정보시스템 성적 자동 가져오기 안내.
 * 브라우저는 보안상 웹페이지가 즐겨찾기를 직접 추가하지 못해서, 버튼을 즐겨찾기 바로 끌어다 놓게 한다.
 */
export function PortalImportGuide({ enabled }: { enabled: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  /** 끄는 중이면 버튼 가운데 x · 위쪽 y — 화면 맨 위까지 화살표를 잇는다 */
  const [drag, setDrag] = useState<{ x: number; top: number } | null>(null)

  useEffect(() => {
    let alive = true
    getBookmarkletSource()
      .then((source) => {
        if (!alive) return
        // 북마클릿이 성적을 넘겨줄 졸UP 주소 = 지금 이 프론트 주소
        const href = 'javascript:' + encodeURIComponent(`void ${source}(${JSON.stringify(location.origin)})`)
        setCode(href)
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      alive = false
    }
  }, [])

  // React는 javascript: 주소를 href로 못 넣게 막아서 직접 넣는다
  useEffect(() => {
    if (code && linkRef.current) linkRef.current.setAttribute('href', code)
  }, [code])

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setTip('복사했어요. 새 즐겨찾기를 만들고 주소(URL) 칸에 붙여넣으세요.')
    } catch {
      setTip('복사하지 못했어요. 버튼을 즐겨찾기 바로 끌어다 놓아주세요.')
    }
  }

  return (
    <div className={styles.guide}>
      <div className={styles.head}>
        <span className={styles.badge}>추천</span>
        <h3>통합정보시스템에서 자동으로 가져오기</h3>
      </div>
      {!enabled && (
        <p className={styles.notice}>로그인해야 쓸 수 있어요. 가져온 과목을 내 계정에 저장해요.</p>
      )}

      {drag && <DragGuide x={drag.x} top={drag.top} />}

      <ol className={styles.steps}>
        <li>
          <b>즐겨찾기 버튼 추가</b> <span className={ui.muted}>(처음 한 번만)</span>
          <p>
            아래 버튼을 브라우저 <b>즐겨찾기 바로 끌어다 놓으세요.</b> 즐겨찾기 바가 안 보이면{' '}
            <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>를 누르면 나와요.
          </p>
          <div className={styles.bookmarkRow}>
            <BrowserDemo />
            <div className={styles.dragSource}>
              <span className={styles.liftHint} aria-hidden>
                ↑ 위로 끌어 올리기
              </span>
              <a
                ref={linkRef}
                className={styles.bookmark}
                draggable
                aria-disabled={!code}
                onClick={(e) => {
                  e.preventDefault()
                  setTip('여기서 누르는 게 아니라, 즐겨찾기 바로 끌어다 놓아야 해요.')
                }}
                onDragStart={(e) => {
                  // 안내 문구('위로 끌어 올리기') 위에서 선이 끝나게 묶음 기준으로 잰다
                  const r = (e.currentTarget.parentElement ?? e.currentTarget).getBoundingClientRect()
                  setDrag({ x: r.left + r.width / 2, top: r.top })
                  // 선은 '위로 끌어 올리기' 문구 위에서 끝난다
                  setTip(null)
                }}
                onDragEnd={() => setDrag(null)}
              >
                <span className={styles.grip} aria-hidden>
                  ⠿
                </span>
                🎓 졸UP 성적 가져오기
              </a>
              <button type="button" className={ui.linkButton} disabled={!code} onClick={copyCode}>
                끌어다 놓기가 안 되면: 코드 복사
              </button>
            </div>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {tip && <p className={styles.tip}>{tip}</p>}
        </li>
        <li>
          <b>통합정보시스템에서 이수성적조회 열기</b>
          <p>
            로그인한 뒤 <b>성적 → 학기성적 → 이수성적조회</b>로 들어가요. 전체 성적 표가 화면에 보이는 상태여야 해요.
          </p>
          <a href={PORTAL_URL} target="_blank" rel="noreferrer" className={ui.buttonGhost}>
            통합정보시스템 열기 ↗
          </a>
        </li>
        <li>
          <b>그 화면에서 즐겨찾기 누르기</b>
          <p>
            즐겨찾기 바의 <b>졸UP 성적 가져오기</b>를 누르면 졸UP 창이 열리고 과목이 들어와요. 팝업이 막히면 주소창 오른쪽에서
            팝업을 허용하고 다시 눌러주세요.
          </p>
        </li>
      </ol>
      <p className={ui.muted}>
        PC의 크롬 · 엣지 · 웨일에서 쓸 수 있어요. 성적 원문은 저장하지 않고, 과목코드 · 학점 · 학기 · 교과구분 · 성적등급만
        가져와요.
      </p>
    </div>
  )
}

/** 브라우저 즐겨찾기 바로 버튼이 올라가는 모습 (반복 애니메이션) */
function BrowserDemo() {
  return (
    <div className={styles.demo} aria-hidden>
      <div className={styles.demoTop}>
        <span className={styles.dots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.address}>knuin.knu.ac.kr</span>
      </div>
      <div className={styles.demoBar}>
        <span className={styles.demoLabel}>즐겨찾기 바</span>
        <span className={styles.slot}>여기에 놓기</span>
      </div>
      <div className={styles.demoPage}>
        <span className={styles.demoArrow}>↑</span>
        <span className={styles.ghost}>🎓 졸UP 성적 가져오기</span>
      </div>
    </div>
  )
}

/** 끄는 동안: 버튼에서 화면 맨 위(즐겨찾기 바)까지 이어지는 화살표 */
function DragGuide({ x, top }: { x: number; top: number }) {
  return (
    <div className={styles.dragOverlay} aria-hidden>
      <div className={styles.dropBanner}>
        <span>↑</span>
        <p>
          이 위, 브라우저 <b>즐겨찾기 바</b>에 놓으세요
        </p>
        <span>↑</span>
      </div>
      <div className={styles.dragLine} style={{ left: x, height: Math.max(0, top - 52) }} />
    </div>
  )
}
