import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useStudent } from '@/state/useStudent'
import styles from './PageHeader.module.css'

export type Crumb = { label: string; to?: string }

type PageHeaderProps = {
  /** 마지막 항목이 현재 화면 */
  crumbs: Crumb[]
  right?: ReactNode
}

/** 메인 영역 상단 흰 바 (경로 표시) */
export function PageHeader({ crumbs, right }: PageHeaderProps) {
  const { kind, syncStatus } = useStudent()
  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="현재 위치">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <span className={styles.sep}>›</span>}
              {c.to && !last ? (
                <Link to={c.to} className={styles.crumb}>
                  {c.label}
                </Link>
              ) : (
                <span className={last ? styles.current : styles.crumb} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>
      <div className={styles.right}>
        {right}
        {kind === 'account' && syncStatus !== 'idle' && (
          <span className={styles.sync} data-status={syncStatus}>
            {syncStatus === 'saving' ? '저장 중…' : syncStatus === 'saved' ? '저장됨' : '저장 실패 — 다음 변경 때 다시 저장해요'}
          </span>
        )}
        {kind === 'guest' && <span className={styles.demo}>데모 · 예시 데이터</span>}
      </div>
    </header>
  )
}
