/**
 * 요건별로 직접 신청하는 외부 사이트.
 * 요건 id → 신청 방법. 졸업요건 상세의 '채우는 방법'과 비교과 입력 줄에 링크로 보여준다.
 */
export type FillGuide = {
  title: string
  sub: string
  url: string
  linkLabel: string
}

export const FILL_GUIDES: Record<string, FillGuide> = {
  counseling: {
    title: 'KNUcube에서 지도교수 상담 신청',
    sub: '상담을 마치면 횟수를 졸UP의 이수 내역 → 비교과에 입력',
    url: 'https://knucube.knu.ac.kr/knucube_index.jsp',
    linkLabel: 'KNUcube에서 상담 신청',
  },
}
