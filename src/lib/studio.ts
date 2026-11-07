import { useEffect, useRef } from 'react'
import { apiUrl } from './api'

export type StudioOverview = {
  music: string[]
  imageEngines: string[]
  narrative: boolean
  effects: boolean
  presets: { id: string; label: string }[]
  aspectRatios: string[]
}

export type StudioImage = {
  id: string
  prompt: string
  preset: string | null
  engine: 'gemini' | 'openrouter' | 'upload'
  model: string | null
  aspectRatio: string | null
  status: 'generating' | 'done' | 'failed'
  originalName: string | null
  error: string | null
  createdAt: string
}

export type StudioTrack = {
  id: string
  title: string
  prompt: string
  provider: 'suno' | 'replicate' | 'upload'
  instrumental: boolean
  status: 'queued' | 'processing' | 'done' | 'failed'
  duration: number | null
  modelName: string | null
  hasFile: boolean
  error: string | null
  createdAt: string
}

export type StudioVideo = {
  id: string
  title: string
  mode: 'individual' | 'playlist' | 'loop'
  effects: boolean
  status: 'queued' | 'rendering' | 'done' | 'failed'
  step: string | null
  items: { index: number; name: string; duration: number | null; ready: boolean; error: string | null }[]
  chapters: string | null
  totalDuration: number | null
  error: string | null
  createdAt: string
}

export const imageFileUrl = (id: string) => apiUrl(`/studio/images/${id}/file`)
export const trackFileUrl = (id: string) => apiUrl(`/studio/tracks/${id}/file`)
export const videoFileUrl = (id: string, item = 0) => apiUrl(`/studio/videos/${id}/file?item=${item}`)
export const videoSubtitlesUrl = (id: string) => apiUrl(`/studio/videos/${id}/subtitles`)

export function clock(seconds: number | null | undefined) {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

// Recarrega de tempos em tempos enquanto houver algo em andamento.
export function usePolling(reload: () => void, active: boolean, ms = 4000) {
  const fn = useRef(reload)
  useEffect(() => {
    fn.current = reload
  })
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => fn.current(), ms)
    return () => clearInterval(t)
  }, [active, ms])
}

const working = ['generating', 'queued', 'processing', 'rendering', 'planning', 'writing', 'visual_prompts', 'images', 'narration', 'metadata', 'assembling']
export const isWorking = (status: string) => working.includes(status)

export const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type NarrativeSummary = {
  id: string
  title: string
  genre: string
  period: string
  status: string
  step: string
  error: string | null
  chaptersPlanned: number
  chaptersApproved: number
  totalUsd: number
  hasVideo: boolean
  createdAt: string
}
