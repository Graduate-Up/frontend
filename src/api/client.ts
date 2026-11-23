import type { ErrorResponse, HTTPValidationError } from './types'

/** 비워두면 같은 origin(`/api/...`)으로 요청 — 개발 중엔 vite proxy가 백엔드로 넘긴다 */
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const TOKEN_KEY = 'graduate-up.access_token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* 저장 못 해도 이번 세션 요청엔 영향 없음 */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* noop */
    }
  },
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(ApiError.messageOf(status, body))
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  /** 422면 필드별 검증 오류 */
  get validationErrors() {
    return this.status === 422 ? ((this.body as HTTPValidationError)?.detail ?? []) : []
  }

  private static messageOf(status: number, body: unknown): string {
    const detail = (body as ErrorResponse | HTTPValidationError | null)?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join(', ')
    return `요청 실패 (${status})`
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Query
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.auth) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    if (res.status === 401 && opts.auth) tokenStore.clear()
    throw new ApiError(res.status, data)
  }
  return data as T
}
