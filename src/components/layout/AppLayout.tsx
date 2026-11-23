import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { formatGraduation } from '@/constants/labels'
import { NAV_ITEMS } from '@/routes/nav'
import { hiddenCreditChecks } from '@/state/hiddenCredits'
import { useEvaluation, useRequirements } from '@/state/queries'
import { useProfile, useStudent } from '@/state/useStudent'
import { MAJOR_LABEL } from '@/types/student'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { kind, displayName, profile, signOut, courses } = useStudent()

  if (kind === 'loading') return null
  if (kind === 'anonymous') return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/onboarding" replace />

  const grad = formatGraduation(profile.expected_graduation_date)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Logo onDark size={24} />
          <p className={styles.dept}>경북대학교 컴퓨터학부</p>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const open = !!item.children && location.pathname.startsWith(item.path)
            return (
              <div key={item.path} className={styles.navGroup} data-divider={item.divider || undefined}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  {item.path === '/courses'
                    ? courses.length
                      ? '이수 내역 확인/수정'
                      : '이수 내역 입력하기'
                    : item.label}
                  {item.count === 'hidden-credits' && <HiddenCreditCount className={styles.badge} />}
                </NavLink>
                {open && (
                  <div className={styles.subNav}>
                    {item.children!.map((c) => (
                      <Link
                        key={c.hash}
                        to={`${item.path}#${c.hash}`}
                        className={`${styles.subLink} ${location.hash === `#${c.hash}` ? styles.subActive : ''}`}
                        // 이미 같은 위치면 주소가 안 바뀌어서 직접 스크롤한다
                        onClick={() =>
                          setTimeout(() => document.getElementById(c.hash)?.scrollIntoView({ behavior: 'smooth' }), 0)
                        }
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className={styles.profile}>
          <p className={styles.profileName}>
            {displayName} · {MAJOR_LABEL[profile.major].short} {String(profile.admission_year).slice(2)}학번
          </p>
          <p>
            {profile.major === 'plsop' && <>ABEEK {profile.abeek ? '이수' : '미이수'} · </>}
            {grad ? `${grad} 졸업 예정` : '졸업 예정일 미입력'}
          </p>
          {kind === 'guest' && <p>둘러보기 중</p>}
          <div className={styles.profileActions}>
            <NavLink to="/onboarding" className={styles.profileLink}>
              학적 변경 →
            </NavLink>
            <button
              type="button"
              className={styles.signOut}
              onClick={async () => {
                await signOut()
                navigate('/login', { replace: true })
              }}
            >
              {kind === 'guest' ? '나가기' : '로그아웃'}
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

/** 숨은 학점 메뉴 옆 발견 개수 */
function HiddenCreditCount({ className }: { className: string }) {
  const profile = useProfile()
  const { courses, records } = useStudent()
  const rule = useRequirements(profile)
  const evaluation = useEvaluation(profile, courses, records)
  if (!rule.data || !evaluation.data) return null
  const found = hiddenCreditChecks(rule.data, evaluation.data, courses).filter((c) => c.found).length
  return found ? <span className={className}>{found}</span> : null
}
