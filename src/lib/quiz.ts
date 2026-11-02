import { useEffect } from 'react'
import { api, apiUrl, errorInfo } from './api'
import { useFetch } from './useFetch'
export type QuizAutomation = {
  _id: string
  revision: number
  enabled: boolean
  channelId: string
  templateId: string
  mode: 'automatic' | 'manual_review'
  delivery: 'dry_run' | 'publish'
  madeForKids?: boolean
  timezone: string
  localTime: string
  categories: string[]
  language: string
  questionType: string
  questionCount: number
  difficulty: string
  instructions: string
  privacyStatus: string
  nextRunAt: string
  lastError?: { code: string }
  pendingSlot?: unknown
}
export type QuizConfig = {
  automation: QuizAutomation | null
  generationEnabled: boolean
  renderEnabled: boolean
  publishingEnabled: boolean
  autoPublish: boolean
}
export type QuizTemplate = {
  _id: string
  name: string
  version: number
  timings: { questionSeconds: number; revealSeconds: number }
  theme: { background: string; foreground: string }
  voice?: { id: string }
  audio?: { musicId?: string | null; effectId?: string | null }
}
export type QuizQuestion = {
  id: string
  type: string
  prompt: string
  options: string[]
  correctIndex?: number
  explanation: string
  evidence: { factId: string; sourceUrl: string }[]
}
export type QuizProduction = {
  _id: string
  status: string
  slotKey: string
  localDate: string
  timezone: string
  plannedAt: string
  topic?: string
  dryRun: boolean
  templateVersion: number
  renderRequested: boolean
  attempts: number
  renderAttempts: number
  resumeStage: string
  youtubeVideoId?: string
  youtubeRemoteId?: string
  youtubeStatus?: string
  youtubePrivacyStatus?: string
  publicationError?: string
  publishedAt?: string
  approvalHash?: string
  createdAt: string
  mediaRemovedAt?: string
  mediaExpiresAt?: string
  configSnapshot?: QuizAutomation
  validation?: { valid: boolean; code?: string; payloadHash: string }
  renderValidation?: { valid: boolean; code?: string; duration?: number; width?: number; height?: number }
  quizPayload?: { topic: string; language: string; titleSuggestions: string[]; description: string; questions: QuizQuestion[] }
  assetManifest?: { id: string; kind: string; rights: { author: string; license: string; originUrl: string; attribution: string } }[]
  events?: { at: string; code: string }[]
}
export const quizStates: Record<string, string> = {
  scheduled: 'Na fila',
  simulating: 'Simulando',
  simulated: 'Simulação concluída',
  generating: 'Gerando roteiro',
  validating_content: 'Validando roteiro',
  content_ready: 'Roteiro pronto',
  acquiring_assets: 'Selecionando mídia',
  generating_audio: 'Gerando narração',
  rendering: 'Renderizando',
  validating_video: 'Validando vídeo',
  video_ready: 'Vídeo pronto',
  awaiting_approval: 'Aguardando revisão',
  ready_to_publish: 'Autorizado para envio',
  submitting: 'Preparando envio',
  submitted: 'Recebido pelo YouTube',
  published: 'Disponível no YouTube',
  failed_retryable: 'Falha recuperável',
  blocked: 'Bloqueado',
  cancelled: 'Cancelado',
}
export const quizDate = (v?: string, zone?: string) =>
  v ? new Date(v).toLocaleString('pt-BR', zone ? { timeZone: zone } : undefined) : '—'
export const quizMedia = (id: string, kind: 'video' | 'thumbnail' | 'captions') => apiUrl(`/quiz/productions/${id}/media/${kind}`)
export const safeQuizLink = (v: string) => {
  try {
    const u = new URL(v)
    return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined
  } catch {
    return undefined
  }
}
export function useQuizFetch<T>(url: string, polling = false) {
  const state = useFetch<T>(url)
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => void state.reload(), 15000)
    return () => clearInterval(id)
  }, [polling, state.reload])
  return state
}
export async function quizAction(url: string, body: unknown = {}) {
  try {
    return (await api.post(url, body)).data
  } catch (err) {
    throw new Error(errorInfo(err).message)
  }
}
export type QuizMetricVideo = {
  productionId: string
  topic: string | null
  localDate: string
  publishedAt: string | null
  youtubeStatus: string | null
  remoteVideoId: string
  views: number
  likes: number
  comments: number
  checkedAt: string | null
  missing: boolean
  history: { at: string; views: number; likes: number; comments: number }[]
  analytics: {
    status: 'ok' | 'missing_scope' | 'unavailable'
    checkedAt: string | null
    minutesWatched: number | null
    avgViewDurationSec: number | null
    avgViewPercentage: number | null
    subscribersGained: number | null
    shares: number | null
    hasRetention: boolean
  } | null
}
export type QuizRetention = { checkedAt: string | null; points: { ratio: number; watch: number }[] }
export type QuizMetrics = {
  enabled: boolean
  intervalHours: number
  totals: { videos: number; views: number; likes: number; comments: number; avgViews: number; likeRate: number | null }
  analyticsScope: boolean
  analyticsTotals: { videos: number; avgViewPercentage: number | null; avgViewDurationSec: number | null }
  lastCheckedAt: string | null
  videos: QuizMetricVideo[]
}
