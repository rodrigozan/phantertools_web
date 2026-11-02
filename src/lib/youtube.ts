import type { YoutubeStatus } from './types'

export const youtubeCategories: { id: string; label: string }[] = [
  { id: '1', label: 'Filmes e animação' },
  { id: '2', label: 'Automóveis' },
  { id: '10', label: 'Música' },
  { id: '15', label: 'Animais' },
  { id: '17', label: 'Esportes' },
  { id: '19', label: 'Viagens' },
  { id: '20', label: 'Jogos' },
  { id: '22', label: 'Pessoas e blogs' },
  { id: '23', label: 'Comédia' },
  { id: '24', label: 'Entretenimento' },
  { id: '25', label: 'Notícias e política' },
  { id: '26', label: 'Como fazer e estilo' },
  { id: '27', label: 'Educação' },
  { id: '28', label: 'Ciência e tecnologia' },
  { id: '29', label: 'Ativismo e ONGs' },
]

export const youtubeLanguages: { id: string; label: string }[] = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'Inglês' },
  { id: 'es', label: 'Espanhol' },
  { id: 'fr', label: 'Francês' },
  { id: 'de', label: 'Alemão' },
  { id: 'it', label: 'Italiano' },
  { id: 'ja', label: 'Japonês' },
]

export const categoryLabel = (id?: string) => youtubeCategories.find((c) => c.id === id)?.label ?? 'Pessoas e blogs'
export const languageLabel = (id?: string) => youtubeLanguages.find((l) => l.id === id)?.label ?? id ?? '—'

export const TITLE_MAX = 100
export const DESCRIPTION_MAX_BYTES = 5000
export const TAGS_MAX_CHARS = 500
export const THUMB_MAX_BYTES = 2 * 1024 * 1024

export const byteLength = (s: string) => new TextEncoder().encode(s).length
export const tagsLength = (tags: string[]) => tags.join(',').length

export const OPEN_STATUSES: YoutubeStatus[] = ['queued', 'uploading', 'processing']

export function formatDuration(sec?: number) {
  if (!sec) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

export function studioUrl(channelId: string) {
  return `https://studio.youtube.com/channel/${channelId}/videos`
}

export function formatReset(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' })
}

// Texto do estado do envio para a lista (equivale ao "when" dos mockups).
export function stageLabel(stage?: string) {
  switch (stage) {
    case 'uploading': return 'Enviando para o YouTube'
    case 'thumbnail': return 'Aplicando a thumbnail'
    case 'verifying': return 'Conferindo no YouTube'
    default: return 'Na fila'
  }
}

export const tzLabel = (tz: string) => (tz === 'America/Sao_Paulo' ? 'Horário de Brasília' : tz)

export type YtChannelTotals = {
  views: number
  minutesWatched: number
  avgViewDurationSec: number
  avgViewPercentage: number
  subscribersGained: number
  subscribersLost: number
  likes: number
  comments: number
  shares: number
}
export type YtChannelStats = { subscribers: number | null; views: number; videos: number; checkedAt?: string }
export type YtAnalyticsOverview = {
  enabled: boolean
  intervalHours: number
  needsReconnect: string[]
  channels: {
    id: string
    channelId: string
    title: string
    handle: string | null
    thumbnailUrl: string | null
    status: string
    analyticsScope: boolean
    analyticsStatus: 'ok' | 'missing_scope' | 'unavailable' | null
    stats: YtChannelStats | null
    windowDays: number
    totals: YtChannelTotals | null
    videosTracked: number
    videoViews: number
    checkedAt: string | null
  }[]
}
export type YtChannelAnalytics = {
  channel: { id: string; title: string; handle: string | null; analyticsScope: boolean }
  stats: YtChannelStats | null
  windowDays: number
  totals: YtChannelTotals | null
  analyticsStatus: string | null
  daily: { day: string; views: number; minutes: number; subs: number }[]
  checkedAt: string | null
  videos: {
    id: string
    title: string
    format: 'long' | 'short' | null
    source: string
    publishedAt: string
    views: number
    likes: number
    comments: number
    missing: boolean
    viewsDelta: number | null
    avgViewPercentage: number | null
    avgViewDurationSec: number | null
    hasRetention: boolean
  }[]
}
