import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined }
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: T; error: unknown }

/** 같은 key의 마지막 성공 결과 (화면을 옮겨도 다시 요청하지 않게). key에 입력이 모두 들어 있어서 그대로 써도 된다 */
const cache = new Map<string, unknown>()
const CACHE_LIMIT = 30

function remember(key: string, data: unknown) {
  cache.delete(key)
  cache.set(key, data)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
}

/**
 * key가 바뀔 때마다 fn을 다시 실행한다. fn이 null이면 아무것도 안 함.
 * 이전 요청은 abort 되고, 새 결과가 올 때까지 이전 data는 유지한다.
 */
export function useAsync<T>(key: string, fn: ((signal: AbortSignal) => Promise<T>) | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(() =>
    fn && cache.has(key) ? { status: 'success', data: cache.get(key) as T } : { status: fn ? 'loading' : 'idle' },
  )

  useEffect(() => {
    if (!fn) {
      setState({ status: 'idle' })
      return
    }
    if (cache.has(key)) {
      setState({ status: 'success', data: cache.get(key) as T })
      return
    }
    const ac = new AbortController()
    setState((prev) => ({ status: 'loading', data: prev.data }))
    fn(ac.signal).then(
      (data) => {
        remember(key, data)
        if (!ac.signal.aborted) setState({ status: 'success', data })
      },
      (error: unknown) => {
        if (!ac.signal.aborted) setState((prev) => ({ status: 'error', data: prev.data, error }))
      },
    )
    return () => ac.abort()
    // fn은 매 렌더 새로 만들어지므로 key로만 다시 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
