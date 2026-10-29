import axios, { AxiosError } from 'axios'

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || `${import.meta.env.BASE_URL}api`).replace(/\/$/, '')
export const apiUrl = (path: string) => `${apiBaseUrl}/${path.replace(/^\//, '')}`

export const api = axios.create({ baseURL: apiBaseUrl, withCredentials: true })

export type ApiErrorBody = { error: string; message: string; fields?: Record<string, string> }

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    if (err.response?.status === 401 && !err.config?.url?.startsWith('/auth/me')) onUnauthorized?.()
    return Promise.reject(err)
  },
)

export function errorInfo(err: unknown): { status: number; message: string; fields: Record<string, string> } {
  const e = err as AxiosError<ApiErrorBody>
  if (!e?.response) return { status: 0, message: 'Sem conexão. Tente de novo.', fields: {} }
  return {
    status: e.response.status,
    message: e.response.data?.message ?? 'Algo deu errado. Tente de novo.',
    fields: e.response.data?.fields ?? {},
  }
}
