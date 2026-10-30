import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { weekdayShort, zonedParts } from '../lib/format'
import type { Account, Post, YoutubeVideo } from '../lib/types'
import { PostStatusTag } from './ui'
import { PlatformMark, YtStatusTag } from './youtube'

export const videoDate = (v: YoutubeVideo) => v.publishAt ?? v.uploadedAt ?? v.createdAt

type Entry = { key: string; at: string; node: React.ReactNode }

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
}: {
  weekStart: string
  onChange: (weekStart: string) => void
  posts: Post[]
  videos?: YoutubeVideo[]
  accounts: Account[]
  timeZone: string
  extra?: React.ReactNode
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = zonedParts(new Date(), timeZone).date
  const entries: Entry[] = [
    ...posts.map((p) => ({
      key: `p${p.id}`,
      at: p.scheduledAt,
      node: (
        <Link to={`/publicacoes/${p.id}`} className="block rounded-control bg-raised px-2 py-1.5 text-xs hover:outline hover:outline-1 hover:outline-control">
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
      node: (
        <Link to={`/videos/${v.id}`} className="block rounded-control bg-raised px-2 py-1.5 text-xs hover:outline hover:outline-1 hover:outline-control">
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
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
        {days.map((d, i) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.at.localeCompare(b.at))
          return (
            <div key={d} className="min-h-24 p-2 md:min-h-56">
              <div className={`mb-2 flex items-baseline gap-1.5 px-1 text-xs ${d === today ? 'font-semibold text-brand' : 'text-muted'}`}>
                <span>{weekdayShort[(i + 1) % 7]}</span>
                <span className="tabular-nums">{d.slice(8)}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {list.map((e) => (
                  <li key={e.key}>{e.node}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
