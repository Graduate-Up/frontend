/**
 * 요건별 채우는 방법 안내 (학부 공지 기준).
 * - options: 졸업요건 상세 오른쪽 '채우는 방법' 카드
 * - link: 이수 내역 → 비교과 입력 줄에 보여줄 신청 사이트
 * - guide: 졸업요건 상세 '내 기록' 아래 자세한 안내
 */
export type FillOption = {
  title: string
  sub: string
  /** 외부 신청 사이트 */
  url?: string
}

export type GuideSection = {
  title: string
  /** 인정 기준 */
  body: string[]
  /** 제출할 증빙 */
  evidence?: string
  /** ※ 주의 */
  notes?: string[]
}

export type FillGuide = {
  options: FillOption[]
  link?: { label: string; url: string }
  guide?: {
    title: string
    /** 제출 서류 */
    submit?: string
    sections: GuideSection[]
    /** 꼭 알아야 할 추가 안내 */
    warning?: { title: string; body: string[] }
  }
}

const KNUCUBE_URL = 'https://knucube.knu.ac.kr/knucube_index.jsp'

export const FILL_GUIDES: Record<string, FillGuide> = {
  counseling: {
    options: [
      {
        title: 'KNUcube에서 지도교수 상담 신청',
        sub: '상담을 마치면 횟수를 이수 내역 → 비교과에 입력',
        url: KNUCUBE_URL,
      },
    ],
    link: { label: 'KNUcube에서 상담 신청', url: KNUCUBE_URL },
  },

  // 글솝 해외대학 인정학점 (학부 공지)
  'track-overseas_credits': {
    options: [
      { title: '해외교육프로그램 학점', sub: '교환학생 · 어학연수 · 해외인턴 · 해외봉사로 성적표에 등재된 학점' },
      { title: '영어개설 전공과목', sub: '취득 3학점당 1학점 인정 · 최대 6학점' },
      { title: '해외 온라인강좌(MOOC) 수료', sub: '영어 · 15시간 이상 강좌 수료증 1건당 1학점' },
    ],
    guide: {
      title: '해외대학 인정학점 안내',
      submit: '해외대학학점인정확인서 + 각 증빙자료',
      sections: [
        {
          title: '해외교육프로그램 학점',
          body: [
            '본교 국제교류처에서 주관하거나 인정하는 해외교육프로그램(교환학생, 어학연수, 해외인턴, 해외봉사활동 등)으로 취득해 본교 성적증명서에 등재된 학점',
          ],
          evidence: '성적증명서',
          notes: [
            'AEP 프로그램은 성적이 등재되면 취득학점으로 인정해요. 학점 없이 수료증만 받았다면 해외온라인강좌(MOOC)와 같은 항목으로 인정해요.',
            '(예외: 23학년도 9월) 아일랜드 더블린 공과대학 온라인 수업(Python for Data Management) 참여는 최종 수료증으로 3점 인정 (본교 졸업학점으로는 인정되지 않고 성적표에 기재되지 않음)',
          ],
        },
        {
          title: '영어개설 과목',
          body: [
            '취득학점 3학점당 해외대학인정학점 1학점 (최대 6학점)',
            '한국어 + 영어 강좌는 제외, 계절학기는 포함',
            '글솝 교육과정과 컴퓨터학부 전공교육과정에 포함된 컴퓨터학부(심컴 · 인컴 · 글솝 · 플솝 · 첨컴) 개설 교과목만 인정',
            '강의계획서에 강의언어가 "영어"로 적혀 있어야 해요',
          ],
          evidence: '성적증명서 + 강의언어가 확인되는 강의계획서',
          notes: ['강의계획서는 수강할 때 미리 PDF로 저장해 두세요. 나중에 확인할 수 없는 자료는 소급 인정되지 않아요.'],
        },
        {
          title: '해외온라인강좌(MOOC)',
          body: [
            '영어로 진행되고 이수시간이 15시간 이상인 강좌의 수료증(Certificate) 1건당 1학점',
            '지정 사이트는 없어요. 추천: Coursera, edX, Udemy, FutureLearn 등 · K-MOOC는 인정되지 않아요',
            '전공역량에 도움이 되는 주제의 강좌를 들어주세요',
          ],
          evidence: '강좌 수료증 + 강좌소개자료(강좌명 · 적용언어 "영어" · 이수 필요시간 "15시간 이상"이 보이는 페이지)',
          notes: [
            'MOOC 인정 학점은 총 이수학점(130학점)에 들어가지 않아요.',
            '15시간 이상 기준은 2021년 9월 1일 이후 이수를 마친 강좌부터 적용돼요.',
            '수료증과 이수확인 화면(강좌명, 학습시간, 이수일자 포함)이 필요해요.',
            '강좌소개자료는 수강할 때 미리 PDF로 저장해 두세요. 나중에 확인할 수 없는 자료는 소급 인정되지 않아요.',
          ],
        },
      ],
      warning: {
        title: 'Saylor Academy 같은 자율 진도(self-paced) 강좌는 소명자료를 더 내야 해요',
        body: [
          '강좌 페이지에 언어가 표기되지 않거나 성실 이수 여부를 확인해야 해서, 수료증과 함께 아래 소명자료 3가지를 하나의 PDF로 묶어 내야 최종 인정돼요.',
          '1) 강좌소개화면: 강좌명과 이수 필요시간(15시간 이상)이 보이는 화면',
          '2) 강좌 적용 언어 증빙: 영어로 진행됨을 보여주는 자료 (플랫폼 공식 FAQ 또는 영문 Syllabus 화면)',
          '3) 실제 학습 내역 증빙: 플랫폼 안의 전체 단원 이수 체크 화면, 또는 강좌 안의 세부 성적 · 학습활동 내역 화면 캡처본',
        ],
      },
    },
  },
}
