import { useRef, useState } from 'react'
import { api, errorInfo } from '../lib/api'
import { useToast } from './toast'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { weekdayShort, zonedParts, zonedToUtc } from '../lib/format'
import type { Account, Post, YoutubeVideo } from '../lib/types'
import { Button, Field, FormError, Input, Modal, PostStatusTag } from './ui'
import { PlatformMark, YtStatusTag } from './youtube'

export const videoDate = (v: YoutubeVideo) => v.publishAt ?? v.uploadedAt ?? v.createdAt

type Move = { key: string; at: string; url: string; field: 'scheduledAt' | 'publishAt' }
type Entry = { key: string; at: string; move?: Move; node: React.ReactNode }

export function startOfWeek(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const typeLabel = { post: 'Post', reel: 'Reel', carousel: 'Carrossel' }

export function WeekCalendar({
  weekStart,
  onChange,
  posts,
  videos = [],
  accounts,
  timeZone,
  extra,
  onRescheduled,
}: {
  weekStart: string
  onChange: (weekStart: string) => void
  posts: Post[]
  videos?: YoutubeVideo[]
  accounts: Account[]
  timeZone: string
  extra?: React.ReactNode
  onRescheduled: () => void | Promise<void>
}) {
  const toast = useToast()
  const dragging = useRef<Move | null>(null)
  const suppressClick = useRef(false)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [move, setMove] = useState<Move | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function choose(item: Move, day?: string) {
    const parts = zonedParts(item.at, timeZone)
    setDate(day ?? parts.date)
    setTime(parts.time)
    setError('')
    setMove(item)
  }
  async function save() {
    if (!move || saving) return
    setSaving(true)
    setError('')
    try {
      await api.patch(move.url, { [move.field]: zonedToUtc(date, time, timeZone) })
      setMove(null)
      toast({ tone: 'success', text: 'Data e horário atualizados.' })
      await onRescheduled()
    } catch (err) {
      setError(errorInfo(err).message)
    } finally {
      setSaving(false)
    }
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = zonedParts(new Date(), timeZone).date
  const entries: Entry[] = [
    ...posts.map((p) => ({
      key: `p${p.id}`,
      at: p.scheduledAt,
      move: ['draft', 'scheduled', 'failed'].includes(p.status) && !p.publishedAt && !p.igMediaId && !p.fbPostId
        ? { key: `p${p.id}`, at: p.scheduledAt, url: `/posts/${p.id}`, field: 'scheduledAt' as const } : undefined,
      node: (
        <Link draggable={false} to={`/publicacoes/${p.id}`} className="block rounded-control bg-raised px-2 py-1.5 text-xs hover:outline hover:outline-1 hover:outline-control">
          <div className="flex items-center justify-between gap-1">
            <span className="font-medium tabular-nums">{zonedParts(p.scheduledAt, timeZone).time}</span>
            <span className="text-faint">{typeLabel[p.type]}</span>
          </div>
          <div className="truncate text-muted">@{accounts.find((a) => a.id === p.accountId)?.username ?? '—'}</div>
          <div className="mt-1">
            <PostStatusTag status={p.status} />
          </div>
        </Link>
      ),
    })),
    ...videos.map((v) => ({
      key: `v${v.id}`,
      at: videoDate(v),
      move: v.privacyStatus === 'private' && !v.uploadUncertain && ['draft', 'queued', 'failed', 'uploaded', 'scheduled'].includes(v.status) && (v.source !== 'quiz' || !!v.youtubeVideoId)
        ? { key: `v${v.id}`, at: videoDate(v), url: `/youtube/videos/${v.id}/schedule`, field: 'publishAt' as const } : undefined,
      node: (
        <Link draggable={false} to={`/videos/${v.id}`} className="block rounded-control bg-raised px-2 py-1.5 text-xs hover:outline hover:outline-1 hover:outline-control">
          <div className="flex items-center justify-between gap-1">
            <span className="font-medium tabular-nums">{zonedParts(videoDate(v), timeZone).time}</span>
            <PlatformMark p="youtube" text={false} />
          </div>
          <div className="line-clamp-2 text-muted">{v.title}</div>
          <div className="mt-1 max-w-full overflow-hidden">
            <YtStatusTag s={v.status} />
          </div>
        </Link>
      ),
    })),
  ]
  const byDay = new Map<string, Entry[]>()
  for (const e of entries) {
    const { date } = zonedParts(e.at, timeZone)
    byDay.set(date, [...(byDay.get(date) ?? []), e])
  }
  const label = `${days[0].split('-').reverse().slice(0, 2).join('/')} a ${days[6].split('-').reverse().slice(0, 2).join('/')}`
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-medium tabular-nums">Semana de {label}</span>
        {extra}
        <div className="flex gap-1">
          <button aria-label="Semana anterior" onClick={() => onChange(addDays(weekStart, -7))} className="flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => onChange(startOfWeek(today))} className="h-9 max-md:h-11 rounded-control px-3 text-sm hover:bg-raised">
            Hoje
          </button>
          <button aria-label="Próxima semana" onClick={() => onChange(addDays(weekStart, 7))} className="flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <p className="px-5 py-2 text-xs text-muted">Arraste uma publicação pendente ou um vídeo privado para outro dia e ajuste o horário ao soltar. Use Reagendar para escolher qualquer data.</p>
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
        {days.map((d, i) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.at.localeCompare(b.at))
          return (
            <div key={d} data-calendar-day={d}
              onDragOver={(event) => {
                if (!dragging.current) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOver(d)
              }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null) }}
              onDrop={(event) => {
                if (!dragging.current) return
                event.preventDefault()
                choose(dragging.current, d)
                dragging.current = null
                setDraggingKey(null)
                setOver(null)
              }}
              className={`min-h-24 p-2 md:min-h-56 ${over === d ? 'bg-raised outline outline-1 outline-brand' : ''}`}>

              <div className={`mb-2 flex items-baseline gap-1.5 px-1 text-xs ${d === today ? 'font-semibold text-brand' : 'text-muted'}`}>
                <span>{weekdayShort[(i + 1) % 7]}</span>
                <span className="tabular-nums">{d.slice(8)}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {list.map((e) => (
                  <li key={e.key} draggable={!!e.move && !saving}
                    className={draggingKey === e.key ? 'opacity-50' : e.move ? 'cursor-grab' : ''}
                    onDragStart={(event) => {
                      if (!e.move || saving) { event.preventDefault(); return }
                      dragging.current = e.move
                      suppressClick.current = true
                      setDraggingKey(e.key)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', e.key)
                    }}
                    onDragEnd={() => {
                      dragging.current = null
                      setDraggingKey(null)
                      setOver(null)
                      window.setTimeout(() => { suppressClick.current = false }, 0)
                    }}
                    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation() } }}>
                    {e.node}
                    {e.move && <button type="button" className="min-h-8 px-2 text-xs text-muted underline hover:text-ink" aria-label={`Reagendar ${e.key.startsWith('v') ? 'vídeo' : 'publicação'} das ${zonedParts(e.at, timeZone).time}`} onClick={() => choose(e.move!)}>Reagendar</button>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <Modal open={!!move} title="Reagendar publicação" onClose={() => { if (!saving) setMove(null) }}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <p className="mb-4 text-sm text-muted">Escolha a data e o horário em {timeZone}. Vídeos privados serão agendados para publicação no YouTube.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">{(id) => <Input id={id} type="date" required value={date} disabled={saving} onChange={(event) => setDate(event.target.value)} />}</Field>
            <Field label="Horário">{(id) => <Input id={id} type="time" required value={time} disabled={saving} onChange={(event) => setTime(event.target.value)} />}</Field>
          </div>
          {error && <FormError message={error} />}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" disabled={saving} onClick={() => setMove(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>Salvar horário</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
