import { useEffect, useState } from 'react'
import { parseTranscript, type CatalogCourse, type Course, type TranscriptCourse, type TranscriptPreview } from '@/api'
import { errorText, formatCredits, ui } from '@/components/ui'
import { normalizeGrade, semesterLabel } from '@/state/courses'
import { takePendingCapture, type PortalCapture } from '@/state/portalTranscript'
import { offeredByDepartment } from '@/state/queries'
import { PortalImportGuide } from './PortalImportGuide'
import { useStudent } from '@/state/useStudent'
import styles from './TranscriptImport.module.css'

/** 성적표 한 행이 그대로 저장할 수 있는지 */
const isReady = (c: TranscriptCourse) => !!c.completed && !!c.semester && !!c.transcript_category && c.credits != null

function toCourse(c: TranscriptCourse, catalog: Map<string, CatalogCourse>, failed: boolean): Course {
  const grade = normalizeGrade(c.grade)
  return {
    course_code: c.course_code.toUpperCase(),
    course_name: c.course_name || catalog.get(c.course_code)?.course_name || null,
    credits: c.credits ?? 0,
    semester: c.semester!,
    transcript_category: c.transcript_category!,
    grade,
    status: failed || grade === 'F' ? 'failed' : 'completed',
    offered_by_computer_science: offeredByDepartment(catalog.get(c.course_code), c.course_code) ?? null,
  }
}

/**
 * 통합정보시스템 '성적 → 학기성적 → 이수성적조회' 표를 복사해 붙여넣으면 서버가 읽어 미리보기를 준다.
 * 원문은 저장하지 않는다. 가져오기를 누르면 이수 내역에 합친다.
 */
export function TranscriptImport({
  enabled,
  catalog,
  onImport,
}: {
  /** 로그인해야 쓸 수 있다 (서버 API가 로그인 전용) */
  enabled: boolean
  catalog: CatalogCourse[]
  onImport: (courses: Course[]) => void
}) {
  // 통합정보시스템 즐겨찾기로 넘어온 성적이 있으면 바로 열어서 읽는다
  const { setLiberalSummary } = useStudent()
  const [portal] = useState<PortalCapture | null>(() => takePendingCapture())
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<TranscriptPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!portal && enabled)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    if (!portal || !enabled) return
    parseTranscript(JSON.stringify({ data: portal.data }))
      .then(setPreview)
      .catch((err: unknown) => setError(errorText(err)))
      .finally(() => setLoading(false))
  }, [portal, enabled])

  const byCode = new Map(catalog.map((c) => [c.course_code, c]))
  const ready = preview ? preview.courses.filter(isReady) : []
  const failed = preview ? (preview.failed_courses ?? []).filter((c) => !!c.semester && c.credits != null) : []
  const review = preview ? preview.courses.filter((c) => !isReady(c)) : []

  async function handleParse() {
    setLoading(true)
    setError(null)
    setDone(null)
    try {
      setPreview(await parseTranscript(text))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  function handleImport() {
    const list = [
      ...ready.map((c) => toCourse(c, byCode, false)),
      // F 과목은 학점에는 안 들어가지만 평점평균에는 들어가서 함께 저장한다
      ...failed.map((c) => toCourse({ ...c, transcript_category: c.transcript_category ?? '미확인' }, byCode, true)),
    ]
    onImport(list)
    // 성적표에 교양 영역 요약표가 있었으면 서버에 같이 저장 (교양 영역 요건을 이 숫자로 판정한다)
    if (portal?.liberal_summary && enabled) setLiberalSummary(portal.liberal_summary)
    setDone(list.length)
    setPreview(null)
    setText('')
  }

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>통합정보시스템에서 성적 한 번에 가져오기</h2>
      </div>

      {portal && (
        <p className={styles.portalNote}>
          통합정보시스템에서 {portal.scanned}건을 읽어왔어요
          {portal.expected != null && portal.expected !== portal.scanned
            ? ` (화면의 전체성적은 ${portal.expected}건 — 빠진 과목이 있으면 직접 넣어주세요)`
            : ''}
          .
        </p>
      )}

      {!portal && <PortalImportGuide enabled={enabled} />}

      {!enabled ? (
        <p className={ui.sub} style={{ marginTop: 14 }}>
          성적 가져오기는 로그인해야 쓸 수 있어요. 둘러보기 중에는 아래 입력칸이나 여러 줄 입력을 써주세요.
        </p>
      ) : (
        <>
          {!portal && <h3 className={styles.subTitle}>또는 표를 복사해서 붙여넣기</h3>}
          {!portal && (
            <ol className={styles.steps}>
              <li>
                통합정보시스템 → <b>성적 → 학기성적 → 이수성적조회</b>를 열어요.
              </li>
              <li>표의 열 머리글(년도 · 학기 · 교과목구분 · 교과목코드 …)부터 마지막 과목까지 드래그해서 복사해요.</li>
              <li>아래에 붙여넣고 읽어오기를 눌러요. 원문은 저장하지 않아요.</li>
            </ol>
          )}
          {!portal && (
            <>
              <textarea
                className={ui.textarea}
                placeholder={
                  '년도\t학기\t교과목구분\t교과목코드\t교과목명\t학점\t성적등급\n2024\t1학기\t전공필수\tCOMP0204\t프로그래밍기초\t3\tA+'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className={styles.actions}>
                <button type="button" className={ui.button} disabled={!text.trim() || loading} onClick={handleParse}>
                  {loading ? '읽는 중…' : '읽어오기'}
                </button>
                {done != null && <span className={styles.done}>{done}개 과목을 이수 내역에 넣었어요.</span>}
              </div>
            </>
          )}
          {portal && loading && <p className={ui.sub}>가져온 성적을 읽는 중…</p>}
          {portal && done != null && <p className={styles.done}>{done}개 과목을 이수 내역에 넣었어요.</p>}
          {error && (
            <div className={`${ui.state} ${ui.stateError}`} style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          {preview && (
            <div className={styles.preview}>
              <div className={styles.summary}>
                <span>
                  가져올 과목 <b>{ready.length}</b>
                </span>
                <span>
                  이수 <b>{formatCredits(preview.completed_credits ?? 0)}</b>
                  학점
                </span>
                {failed.length > 0 && (
                  <span>
                    F <b>{failed.length}</b> (평점에만 반영)
                  </span>
                )}
                {preview.duplicates_removed > 0 && <span>재수강 중복 {preview.duplicates_removed}개 정리</span>}
                {review.length > 0 && (
                  <span className={styles.warn}>
                    직접 확인 <b>{review.length}</b>
                  </span>
                )}
              </div>

              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>학기</th>
                      <th>과목</th>
                      <th>학점</th>
                      <th>교과구분</th>
                      <th>성적</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {preview.courses.map((c) => (
                      <tr key={`${c.course_code}@${c.semester}`}>
                        <td>{c.semester ? semesterLabel(c.semester) : (c.semester_label ?? '-')}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {c.course_name ?? byCode.get(c.course_code)?.course_name ?? c.course_code}
                          </div>
                          <div className={ui.muted}>{c.course_code}</div>
                        </td>
                        <td>{c.credits ?? '-'}</td>
                        <td>{c.transcript_category ?? '-'}</td>
                        <td>{c.grade ?? '-'}</td>
                        <td className={isReady(c) ? styles.ok : styles.warn}>{isReady(c) ? '가져옴' : '직접 입력'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {review.length > 0 && (
                <p className={ui.muted} style={{ marginTop: 10 }}>
                  학기 · 교과구분 · 학점이 확인되지 않거나 이수 확인이 안 된 과목은 가져오지 않아요. 위 입력칸으로 직접
                  넣어주세요.
                </p>
              )}
              <button
                type="button"
                className={ui.button}
                style={{ marginTop: 14 }}
                disabled={!ready.length && !failed.length}
                onClick={handleImport}
              >
                {ready.length + failed.length}개 이수 내역에 넣기
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
