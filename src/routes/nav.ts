export type NavItem = {
  path: string
  label: string
  /** 숨은 학점처럼 판정 결과로 개수를 보여주는 메뉴 */
  count?: 'hidden-credits'
}

/** 사이드바 메뉴 (시안 순서) */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '내 졸업 현황' },
  { path: '/requirements', label: '전체 졸업요건' },
  { path: '/courses', label: '이수 내역' },
  { path: '/hidden-credits', label: '숨은 학점', count: 'hidden-credits' },
  { path: '/schedule', label: '졸업 일정' },
  { path: '/recommend', label: '과목 추천' },
  { path: '/notices', label: '근거 공지 모음' },
]
