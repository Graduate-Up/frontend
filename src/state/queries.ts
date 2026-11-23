import {
  getGraduationSchedule,
  getRequirements,
  previewEvaluation,
  searchCourses,
  type CatalogCourse,
  type Course,
  type GraduationRule,
  type GraduationSchedule,
  type NonacademicRecord,
  type StudentProfile,
} from '@/api'
import { resolveLiberalAreas } from '@/content/liberalAreas'
import { DEPARTMENT_OFFERED_OVERRIDES } from '@/content/ruleOverrides'
import { patchStartupCredits, withCourseRecords, withSubstitutions } from '@/content/substitutions'
import { DEFAULT_TRANSCRIPT_CATEGORIES } from '@/constants/labels'
import { MULTI_MAJOR_CATEGORIES, classifyByTranscript } from './courseCategory'
import { finalizeEvaluation, stripVerificationRequirements } from './evaluationTotals'
import { stripOtherMajorSources, stripOtherMajorSourcesFromEvaluation } from './sources'
import { useAsync } from './useAsync'

/** 프로필에 맞는 졸업요건 */
export function useRequirements(profile: StudentProfile) {
  return useAsync<GraduationRule>(`req:${JSON.stringify(profile)}`, (signal) =>
    getRequirements(profile, { signal }).then((rule) =>
      stripVerificationRequirements(stripOtherMajorSources(rule, profile.major)),
    ),
  )
}

/** 이수 과목으로 판정 — 과목이 없어도 요건 목록을 받기 위해 요청한다 */
export function useEvaluation(profile: StudentProfile, courses: Course[], records: NonacademicRecord[] = []) {
  return useAsync(`eval:${JSON.stringify(profile)}:${JSON.stringify(courses)}:${JSON.stringify(records)}`, (signal) =>
    previewEvaluation(
      {
        student_profile: profile,
        completed_courses: courses,
        nonacademic_records: withSubstitutions(profile.major, withCourseRecords(courses, records)),
      },
      { signal },
    ).then((e) =>
      finalizeEvaluation(
        resolveLiberalAreas(
          patchStartupCredits(classifyByTranscript(stripOtherMajorSourcesFromEvaluation(e, profile.major)), courses),
          courses,
        ),
      ),
    ),
  )
}

/** 졸업요건에 나오는 과목코드 → 과목명 */
export function courseNameMap(rule: GraduationRule | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const req of rule?.course_requirements ?? []) {
    for (const c of req.courses) map.set(c.course_code, c.course_name)
  }
  return map
}

/** 성적표 교과구분 후보 */
export function transcriptCategoryOptions(rule: GraduationRule | undefined): string[] {
  const set = new Set<string>([
    ...(rule?.major_transcript_categories ?? []),
    ...Object.keys(rule?.transcript_categories ?? {}),
  ])
  for (const req of rule?.course_requirements ?? []) {
    if (req.required_transcript_category) set.add(req.required_transcript_category)
  }
  if (!set.size) for (const c of DEFAULT_TRANSCRIPT_CATEGORIES) set.add(c)
  // 다전공 과목도 고를 수 있게
  for (const c of MULTI_MAJOR_CATEGORIES) set.add(c)
  return [...set]
}

export type Catalog = { basis: string; inferred: boolean; items: CatalogCourse[] }

/** 내 학번 · 전공 교육과정 과목 전체 (100개씩 끝까지 받는다) */
export function useCatalog(profile: StudentProfile) {
  return useAsync<Catalog>(`catalog:${profile.admission_year}:${profile.major}`, async (signal) => {
    const items: CatalogCourse[] = []
    let first: Awaited<ReturnType<typeof searchCourses>> | null = null
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await searchCourses(
        { admission_year: profile.admission_year, major: profile.major, limit: 100, offset },
        { signal },
      )
      first ??= page
      items.push(...page.items)
      if (items.length >= page.total || !page.items.length) break
    }
    return { basis: first?.basis ?? '', inferred: first?.inferred ?? false, items }
  })
}

/** 교육과정표 교과구분으로 컴퓨터학부 개설 여부를 정한다 (교양 · 일반선택은 판정에 상관없어 비워둔다) */
export function offeredByDepartment(item: CatalogCourse | undefined, code?: string): boolean | undefined {
  if (DEPARTMENT_OFFERED_OVERRIDES.has(item?.course_code ?? code ?? '')) return true
  if (!item) return undefined
  if (item.curriculum_category.includes('타 전공')) return false
  if (isMajorCurriculum(item.curriculum_category)) return true
  return undefined
}

/** 교육과정표 교과구분이 전공 과목인지 (글솝 '전공', 플솝 '공학전공'. MSC인 '전공기반'은 아님) */
export function isMajorCurriculum(category: string) {
  return !category.includes('타 전공') && /^(공학)?전공(?!기반)/.test(category)
}

/** 교육과정표 교과구분이 교양인지 (플솝은 '기본소양') */
export function isLiberalCurriculum(category: string) {
  return /^(교양|기본소양)/.test(category)
}

/** 졸업 일정 · 조기졸업 기준 (학생과 상관없이 같다) */
export function useGraduationSchedule() {
  return useAsync<GraduationSchedule>('graduation-schedule', (signal) => getGraduationSchedule({ signal }))
}
