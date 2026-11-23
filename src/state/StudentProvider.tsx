import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getMe,
  getMyRecords,
  logout as apiLogout,
  saveMyRecords,
  saveProfile as apiSaveProfile,
  tokenStore,
  type AccountResponse,
  type Course,
  type LiberalSummary,
  type NonacademicRecord,
  type StudentProfile,
} from '@/api'
import { OFFICIAL_ENGLISH_KEY, fromEnglishTestResult, type EnglishScore } from '@/content/englishTests'
import { sampleStudent } from '@/mocks/sampleStudent'
import { normalizeCourses } from './courses'
import { normalizeProfile } from './profile'
import { storage } from './storage'
import { StudentContext, type SessionKind, type StudentContextValue, type SyncStatus } from './useStudent'

const GUEST_KEY = 'graduate-up.guest_profile'
const coursesKey = (owner: string) => `graduate-up.courses.${owner}`
const recordsKey = (owner: string) => `graduate-up.nonacademic.${owner}`
const englishKey = (owner: string) => `graduate-up.english.${owner}`
const methodsKey = (owner: string) => `graduate-up.methods.${owner}`
const programKey = (owner: string) => `graduate-up.program.${owner}`
type MethodMap = Record<string, string>
type EnglishMap = Record<string, EnglishScore>

/** 마지막 변경 후 서버 저장까지 기다리는 시간 */
const SAVE_DELAY_MS = 600

export function StudentProvider({ children }: { children: ReactNode }) {
  // 토큰이 없으면 둘러보기 상태를 바로 복구
  const [initialGuest] = useState(() => (tokenStore.get() ? null : storage.get<StudentProfile | null>(GUEST_KEY, null)))
  const [kind, setKind] = useState<SessionKind>(() =>
    tokenStore.get() ? 'loading' : initialGuest ? 'guest' : 'anonymous',
  )
  const [account, setAccount] = useState<AccountResponse | null>(null)
  const [profile, setProfile] = useState<StudentProfile | null>(initialGuest)
  const [studentNumber, setStudentNumber] = useState<string | null>(null)
  const [courses, setCoursesState] = useState<Course[]>(() =>
    initialGuest ? normalizeCourses(storage.get<Course[]>(coursesKey('guest'), [])) : [],
  )
  const [records, setRecordsState] = useState<NonacademicRecord[]>(() =>
    initialGuest ? storage.get<NonacademicRecord[]>(recordsKey('guest'), []) : [],
  )
  const [englishScores, setEnglishScores] = useState<EnglishMap>(() =>
    initialGuest ? storage.get<EnglishMap>(englishKey('guest'), {}) : {},
  )
  const [checkMethods, setCheckMethods] = useState<MethodMap>(() =>
    initialGuest ? storage.get<MethodMap>(methodsKey('guest'), {}) : {},
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  /** 학생이 바꾼 횟수 — 바뀔 때마다 서버 저장을 예약한다 (불러오기만 한 경우는 저장 안 함) */
  const [changes, setChanges] = useState(0)

  const isAccount = kind === 'account' && !!account
  // 브라우저 저장 키는 이메일 앞부분 (예전 아이디 계정과 같은 키를 쓴다)
  const owner = isAccount ? localPart(account.username) : 'guest'

  /** 다음 저장 때 함께 보낼 교양 영역 요약 (성적표에서 새로 읽어 왔을 때만) */
  const pendingSummary = useRef<LiberalSummary | null>(null)
  const [convergenceProgram, setConvergenceProgram] = useState<string | null>(() =>
    initialGuest ? storage.get<string | null>(programKey('guest'), null) : null,
  )
  const [liberalSummary, setLiberalSummaryState] = useState<LiberalSummary | null>(null)

  // 저장 타이머가 최신 값을 보도록
  const latest = useRef({ courses, records })
  useEffect(() => {
    latest.current = { courses, records }
  }, [courses, records])

  const loadAccount = useCallback(async () => {
    const [me, saved] = await Promise.all([getMe(), getMyRecords().catch(() => null)])
    const user = localPart(me.account.username)
    setAccount(me.account)
    if (me.profile) {
      // 융합전공은 판정 요청에 넣으면 안 돼서 따로 둔다 (백엔드가 지원 안 하면 이 브라우저 값)
      const { student_number, convergence_program, ...rest } = me.profile
      setConvergenceProgram(
        'convergence_program' in me.profile
          ? (convergence_program ?? null)
          : storage.get<string | null>(programKey(user), null),
      )
      setProfile(rest)
      setStudentNumber(student_number)
    } else {
      setProfile(null)
      setStudentNumber(null)
    }

    // 서버 기록이 기준. 서버가 비어 있고 이 브라우저에 예전 기록이 있으면 그걸 올린다.
    const serverCourses = saved?.completed_courses ?? []
    const serverRecords = saved?.nonacademic_records ?? []
    const localCourses = normalizeCourses(storage.get<Course[]>(coursesKey(user), []))
    const localRecords = storage.get<NonacademicRecord[]>(recordsKey(user), [])
    const serverEmpty = !serverCourses.length && !serverRecords.length
    const migrate = !!saved && serverEmpty && (localCourses.length > 0 || localRecords.length > 0)
    setCoursesState(migrate || !saved ? localCourses : serverCourses)
    setRecordsState(migrate || !saved ? localRecords : serverRecords)
    // 영어 시험 원본은 서버에도 저장돼요 — 이 브라우저에 없으면 서버 값으로 채운다
    const localEnglish = storage.get<EnglishMap>(englishKey(user), {})
    const serverEnglish = fromEnglishTestResult(serverRecords.find((r) => r.english_test)?.english_test)
    setEnglishScores(
      !localEnglish[OFFICIAL_ENGLISH_KEY] && serverEnglish
        ? { ...localEnglish, [OFFICIAL_ENGLISH_KEY]: serverEnglish }
        : localEnglish,
    )
    setLiberalSummaryState(saved?.liberal_summary ?? null)
    setCheckMethods(storage.get<MethodMap>(methodsKey(user), {}))
    setSyncStatus(saved ? 'saved' : 'error')
    if (migrate) setChanges((n) => n + 1)
    setKind('account')
    return me.profile !== null
  }, [])

  // 새로고침 시 저장된 토큰으로 로그인 상태 복구
  useEffect(() => {
    if (!tokenStore.get()) return
    // 상태는 네트워크 응답 이후에 바뀐다 (동기 setState 아님)
    // oxlint-disable-next-line react/set-state-in-effect
    loadAccount().catch(() => {
      tokenStore.clear()
      setKind('anonymous')
    })
  }, [loadAccount])

  // 로그인 상태면 바뀐 기록을 모아서 서버에 저장
  useEffect(() => {
    if (!isAccount || changes === 0) return
    const timer = setTimeout(() => {
      setSyncStatus('saving')
      const summary = pendingSummary.current
      saveMyRecords({
        completed_courses: latest.current.courses,
        nonacademic_records: latest.current.records,
        // 없으면 필드를 빼서 서버에 있던 요약을 그대로 둔다
        ...(summary ? { liberal_summary: summary } : {}),
      })
        .then(() => {
          if (pendingSummary.current === summary) pendingSummary.current = null
          setSyncStatus('saved')
        })
        .catch(() => setSyncStatus('error'))
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [changes, isAccount])

  const setCourses = useCallback<StudentContextValue['setCourses']>(
    (updater) => {
      setCoursesState((prev) => {
        const next = normalizeCourses(typeof updater === 'function' ? updater(prev) : updater)
        storage.set(coursesKey(owner), next)
        return next
      })
      setChanges((n) => n + 1)
    },
    [owner],
  )

  /** 성적표에서 읽은 교양 영역 요약을 서버에 저장한다 (로그인했을 때만) */
  const setLiberalSummary = useCallback<StudentContextValue['setLiberalSummary']>((summary) => {
    pendingSummary.current = summary
    setLiberalSummaryState(summary)
    setChanges((n) => n + 1)
  }, [])

  /** 요건 하나의 기록을 저장 (amount가 null이면 삭제) */
  const setRecord = useCallback<StudentContextValue['setRecord']>(
    (requirementId, amount, englishTest) => {
      setRecordsState((prev) => {
        const rest = prev.filter((r) => r.requirement_id !== requirementId)
        const record: NonacademicRecord = { requirement_id: requirementId, amount: amount ?? 0, status: 'satisfied' }
        if (englishTest) record.english_test = englishTest
        const next = amount == null ? rest : [...rest, record]
        storage.set(recordsKey(owner), next)
        return next
      })
      setChanges((n) => n + 1)
    },
    [owner],
  )

  /** 화면 입력값 (시험 종류 · 점수 · 응시일). 서버에는 영어 기록의 english_test로 함께 저장된다 */
  const setEnglishScore = useCallback<StudentContextValue['setEnglishScore']>(
    (requirementId, score) => {
      setEnglishScores((prev) => {
        const next = { ...prev }
        if (score) next[requirementId] = score
        else delete next[requirementId]
        storage.set(englishKey(owner), next)
        return next
      })
    },
    [owner],
  )

  const setCheckMethod = useCallback<StudentContextValue['setCheckMethod']>(
    (requirementId, method) => {
      setCheckMethods((prev) => {
        const next = { ...prev }
        if (method) next[requirementId] = method
        else delete next[requirementId]
        storage.set(methodsKey(owner), next)
        return next
      })
    },
    [owner],
  )

  const startGuest = useCallback(() => {
    const saved = storage.get<StudentProfile | null>(GUEST_KEY, null)
    const p = saved ?? normalizeProfile(sampleStudent.profile)
    storage.set(GUEST_KEY, p)
    setAccount(null)
    setStudentNumber(null)
    setProfile(p)
    setCoursesState(normalizeCourses(storage.get<Course[]>(coursesKey('guest'), [])))
    setRecordsState(storage.get<NonacademicRecord[]>(recordsKey('guest'), []))
    setEnglishScores(storage.get<EnglishMap>(englishKey('guest'), {}))
    setCheckMethods(storage.get<MethodMap>(methodsKey('guest'), {}))
    setConvergenceProgram(storage.get<string | null>(programKey('guest'), null))
    setSyncStatus('idle')
    setKind('guest')
  }, [])

  const saveProfile = useCallback<StudentContextValue['saveProfile']>(
    async (next, number, program) => {
      const p = normalizeProfile(next)
      if (kind === 'account') {
        if (!number) throw new Error('학번을 입력해주세요.')
        const me = await apiSaveProfile({
          ...p,
          student_number: number,
          ...(program?.server ? { convergence_program: program.id } : {}),
        })
        const { student_number, convergence_program, ...rest } = me.profile ?? { ...p, student_number: number }
        setProfile(rest)
        setStudentNumber(student_number)
        if (program?.server) setConvergenceProgram(convergence_program ?? null)
      } else {
        storage.set(GUEST_KEY, p)
        setProfile(p)
        setKind('guest')
      }
      // 백엔드가 융합전공을 아직 못 받으면(또는 둘러보기) 이 브라우저에 둔다
      if (program && !(kind === 'account' && program.server)) {
        storage.set(programKey(kind === 'account' && account ? account.username.split('@')[0] : 'guest'), program.id)
        setConvergenceProgram(program.id)
      }
    },
    [kind, account],
  )

  const signOut = useCallback(async () => {
    if (kind === 'account') await apiLogout().catch(() => undefined)
    else storage.remove(GUEST_KEY)
    setAccount(null)
    setProfile(null)
    setStudentNumber(null)
    setCoursesState([])
    setRecordsState([])
    setLiberalSummaryState(null)
    setConvergenceProgram(null)
    setEnglishScores({})
    setCheckMethods({})
    setSyncStatus('idle')
    setChanges(0)
    setKind('anonymous')
  }, [kind])

  const displayName =
    kind === 'account' && account ? localPart(account.username) : kind === 'guest' ? sampleStudent.displayName : ''

  const value = useMemo<StudentContextValue>(
    () => ({
      kind,
      account,
      profile,
      studentNumber,
      displayName,
      courses,
      setCourses,
      records,
      setRecord,
      setLiberalSummary,
      liberalSummary,
      convergenceProgram,
      englishScores,
      setEnglishScore,
      syncStatus,
      checkMethods,
      setCheckMethod,
      loadAccount,
      startGuest,
      saveProfile,
      signOut,
    }),
    [
      kind,
      account,
      profile,
      studentNumber,
      displayName,
      courses,
      setCourses,
      records,
      setRecord,
      setLiberalSummary,
      liberalSummary,
      convergenceProgram,
      englishScores,
      setEnglishScore,
      syncStatus,
      checkMethods,
      setCheckMethod,
      loadAccount,
      startGuest,
      saveProfile,
      signOut,
    ],
  )

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>
}

/** 학교 이메일의 앞부분 (예: student@knu.ac.kr → student) */
function localPart(username: string) {
  return username.split('@')[0]
}
