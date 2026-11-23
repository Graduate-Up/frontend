export type NavItem = {
  path: string
  label: string
  /** 숨은 학점처럼 판정 결과로 개수를 보여주는 메뉴 */
  count?: 'hidden-credits'
  /** 이 메뉴 화면 안의 위치로 가는 소메뉴 (#id) */
  children?: { hash: string; label: string }[]
}

/** 전체 졸업요건 화면의 그룹 구역 id */
export const REQUIREMENT_SECTIONS = {
  credit: 'req-credit',
  course: 'req-course',
  nonacademic: 'req-nonacademic',
} as const

/** 이수 내역 화면의 구역 id */
export const COURSE_SECTIONS = { list: 'course-list', manual: 'course-manual', import: 'course-import' } as const

/** 사이드바 메뉴 (시안 순서) */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '내 졸업 현황' },
  {
    path: '/requirements',
    label: '전체 졸업요건',
    children: [
      { hash: REQUIREMENT_SECTIONS.credit, label: '학점' },
      { hash: REQUIREMENT_SECTIONS.course, label: '필수 과목' },
      { hash: REQUIREMENT_SECTIONS.nonacademic, label: '졸업자격 · 비교과' },
    ],
  },
  {
    path: '/courses',
    label: '이수 내역',
    children: [
      { hash: COURSE_SECTIONS.list, label: '이수 과목 확인' },
      { hash: COURSE_SECTIONS.manual, label: '수기로 추가' },
      { hash: COURSE_SECTIONS.import, label: '성적 불러오기' },
    ],
  },
  { path: '/hidden-credits', label: '숨은 학점', count: 'hidden-credits' },
  { path: '/schedule', label: '졸업 일정' },
  { path: '/recommend', label: '과목 추천' },
  { path: '/notices', label: '근거 공지 모음' },
]
