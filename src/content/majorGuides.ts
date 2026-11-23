import type { MajorCode } from '@/api/types'

/**
 * 졸업 현황 오른쪽 안내 카드 문구.
 * 백엔드 데이터가 아니라 화면 기획 문구라서 프론트에 둔다.
 */

export type RoadmapStep = {
  label: string
  desc: string
  /** 해당 학기 범위 (1 = 1학년 1학기, 8 = 4학년 2학기) */
  from: number
  to: number
}

export type Roadmap = { title: string; sub: string; steps: RoadmapStep[] }

export type HighlightGuide = {
  /** 백엔드 비교과 요건 id */
  requirementId: string
  title: string
  body: string
  cta: string
}

export type InfoGuide = {
  title: string
  body: string
  /** 근거로 붙일 공지 — 요건 sources 제목에 이 문자열이 들어간 것 */
  sourceMatch: string
}

export type MajorGuide = { roadmap: Roadmap; highlight?: HighlightGuide; info?: InfoGuide }

const DEFAULT_ROADMAP: Roadmap = {
  title: '권장 졸업 로드맵',
  sub: '일반적인 준비 순서 · 상황에 따라 조정 가능',
  steps: [
    { label: '1~2학년', desc: '전공기초 · 교양 필수 이수, 지도교수 상담 시작', from: 1, to: 4 },
    { label: '3학년', desc: '현장실습 · 영어 성적 등 졸업자격 준비', from: 5, to: 6 },
    { label: '4학년 1학기', desc: '졸업자격인정 서류 제출, 종합설계', from: 7, to: 7 },
    { label: '4학년 2학기', desc: '졸업요건 최종 점검 · 졸업 신청', from: 8, to: 8 },
  ],
}

const GUIDES: Partial<Record<MajorCode, MajorGuide>> = {
  chumcom: {
    roadmap: {
      title: '권장 연구 로드맵',
      sub: '학과 권장 수학 플랜 · 진로에 따라 조정 가능',
      steps: [
        { label: '1~2학년', desc: '기초 전공 이론과 프로그래밍 역량', from: 1, to: 4 },
        { label: '2~3학년', desc: '연구실 탐색, 관심 연구 분야 정하기', from: 5, to: 6 },
        { label: '3~4학년', desc: '지도교수 배정 후 연구 3학기 이상', from: 7, to: 7 },
        { label: '4학년', desc: '연구보고서 작성 · 발표, 대학원 준비', from: 8, to: 8 },
      ],
    },
    highlight: {
      requirementId: 'research-events',
      title: '연구행사, 지금부터 모아두세요',
      body: 'BK 세미나, 학부 세미나, 학술대회처럼 지도교수가 인정하는 행사 3회와 증빙이 필요해요. 1학년 참석도 기록해 두면 좋아요.',
      cta: '참석 기록 추가 +',
    },
    info: {
      title: '대학원 진학 연계',
      body: '졸업요건을 채우면 석사 진학 면접이 면제되고, 석·박사통합과정으로 전환할 수 있어요. 학부에서 들은 대학원 교과목은 일부 학점으로 인정될 수 있어요.',
      sourceMatch: '첨단컴퓨팅연구전공 전공소개',
    },
  },
}

export function guideFor(major: MajorCode): MajorGuide {
  return GUIDES[major] ?? { roadmap: DEFAULT_ROADMAP }
}

/** 지금이 몇 번째 학기인지 (1학년 1학기 = 1). 3~8월은 1학기, 9~2월은 2학기 */
export function currentSemesterIndex(admissionYear: number, now = new Date()) {
  const month = now.getMonth() + 1
  const academicYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const term = month >= 3 && month <= 8 ? 1 : 2
  return Math.max(1, (academicYear - admissionYear) * 2 + term)
}

/** 로드맵에서 지금 단계 (범위를 넘으면 마지막 단계) */
export function currentStepIndex(steps: RoadmapStep[], semester: number) {
  const i = steps.findIndex((s) => semester >= s.from && semester <= s.to)
  return i === -1 ? steps.length - 1 : i
}
