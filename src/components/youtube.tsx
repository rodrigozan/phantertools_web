import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Ban, CalendarClock, Camera, Check, CheckCircle2, Circle, Clapperboard, FileText, Film, Hourglass, Loader2, Music2, Users, X } from 'lucide-react'
import type { YoutubeFormat, YoutubeStatus } from '../lib/types'
import { Tag } from './ui'

export const platforms = {
  youtube: { label: 'YouTube', Icon: Clapperboard },
  instagram: { label: 'Instagram', Icon: Camera },
  facebook: { label: 'Facebook', Icon: Users },
  tiktok: { label: 'TikTok', Icon: Music2 },
} as const

export type Platform = keyof typeof platforms

export function PlatformMark({ p, text = true }: { p: Platform; text?: boolean }) {
  const { label, Icon } = platforms[p]
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={label}>
      <Icon size={13} aria-hidden />
      {text ? label : <span className="sr-only">{label}</span>}
    </span>
  )
}

export function Thumb({ src, dur, short, className = '' }: { src?: string; dur?: string; short?: boolean; className?: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-raised ${short ? 'aspect-[9/16]' : 'aspect-video'} ${className}`} aria-hidden>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <Film size={18} className="text-faint" />}
      {dur && <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 text-[10px] font-medium text-white">{dur}</span>}
    </span>
  )
}

const statusMeta: Record<YoutubeStatus, { tone: 'neutral' | 'brand' | 'warning' | 'success' | 'error'; label: string; Icon: typeof Hourglass; spin?: boolean }> = {
  draft: { tone: 'neutral', label: 'Rascunho', Icon: FileText },
  queued: { tone: 'warning', label: 'Na fila', Icon: Hourglass },
  uploading: { tone: 'warning', label: 'Enviando', Icon: Loader2, spin: true },
  processing: { tone: 'warning', label: 'Processando no YouTube', Icon: Loader2, spin: true },
  scheduled: { tone: 'brand', label: 'Agendado', Icon: CalendarClock },
  published: { tone: 'success', label: 'Publicado', Icon: CheckCircle2 },
  failed: { tone: 'error', label: 'Falhou', Icon: AlertCircle },
  cancelled: { tone: 'neutral', label: 'Cancelado', Icon: Ban },
}

export const youtubeStatusLabels = Object.fromEntries(Object.entries(statusMeta).map(([k, v]) => [k, v.label])) as Record<YoutubeStatus, string>

export function YtStatusTag({ s }: { s: YoutubeStatus }) {
  const x = statusMeta[s] ?? statusMeta.draft
  return (
    <Tag tone={x.tone} icon={<x.Icon size={12} aria-hidden className={x.spin ? 'animate-spin' : ''} />}>
      {x.label}
    </Tag>
  )
}

export function FormatTag({ f }: { f?: YoutubeFormat }) {
  return <Tag tone="neutral">{f === 'short' ? 'Short' : 'Longo'}</Tag>
}

export function Progress({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-brand-track">
      <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${v}%` }} />
    </div>
  )
}

export type TabItem = { id: string; label: string; Icon: typeof Camera; soon?: boolean }

// Abas com teclado: setas, Home e End movem o foco e a seleção.
export function Tabs({ items, active, onChange, label = 'Redes' }: { items: TabItem[]; active: string; onChange: (id: string) => void; label?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === active)
    let n = i
    if (e.key === 'ArrowRight') n = (i + 1) % items.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = items.length - 1
    else return
    e.preventDefault()
    onChange(items[n].id)
    refs.current[items[n].id]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {items.map(({ id, label: text, Icon, soon }) => {
        const on = id === active
        return (
          <button
            type="button"
            key={id}
            id={`aba-${id}`}
            ref={(el) => {
              refs.current[id] = el
            }}
            role="tab"
            aria-selected={on}
            aria-controls="aba-painel"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(id)}
            className={`-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm ${on ? 'border-nav-icon-active font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            <Icon size={16} aria-hidden />
            {text}
            {soon && <Tag tone="neutral">Em breve</Tag>}
          </button>
        )
      })}
    </div>
  )
}

export type Step = { label: string; state: 'done' | 'now' | 'todo' | 'error'; note?: ReactNode }

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((s) => (
        <li key={s.label} className="flex gap-3">
          <span className="mt-0.5">
            {s.state === 'done' ? (
              <Check size={18} className="text-positive" aria-hidden />
            ) : s.state === 'now' ? (
              <Loader2 size={18} className="animate-spin text-brand" aria-hidden />
            ) : s.state === 'error' ? (
              <AlertCircle size={18} className="text-negative" aria-hidden />
            ) : (
              <Circle size={18} className="text-faint" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className={s.state === 'todo' ? 'text-muted' : 'font-medium'}>
              {s.label}
              <span className="sr-only">{{ done: ' (concluído)', now: ' (em andamento)', todo: ' (pendente)', error: ' (com erro)' }[s.state]}</span>
            </p>
            {s.note && <div className="mt-1 text-sm text-muted">{s.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Counter({ n, max, unit = '' }: { n: number; max: number; unit?: string }) {
  return (
    <span className={`text-xs tabular-nums ${n > max ? 'text-negative' : 'text-faint'}`}>
      {n} / {max}
      {unit}
    </span>
  )
}

export function Chip({ children, onRemove }: { children: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-raised pr-1 pl-3 text-sm">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink max-md:h-11 max-md:w-11" aria-label={`Remover ${children}`}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}

export function RadioCard({ on, title, hint, Icon, onSelect, disabled, name }: { on: boolean; title: string; hint?: string; Icon?: typeof Camera; onSelect: () => void; disabled?: boolean; name: string }) {
  return (
    <label className={`flex min-h-11 flex-1 basis-40 cursor-pointer items-start gap-2.5 rounded-control border px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-nav-icon-active ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${on ? 'border-nav-icon-active bg-nav-active-bg' : 'border-control'}`}>
      <input type="radio" name={name} checked={on} disabled={disabled} onChange={onSelect} className="peer sr-only" />
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? 'border-nav-icon-active' : 'border-control'}`}>{on && <span className="h-2 w-2 rounded-full bg-toggle-on" />}</span>
      <span className="min-w-0">
        <span className={`flex items-center gap-1.5 text-sm font-medium ${on ? 'text-nav-active-text' : ''}`}>
          {Icon && <Icon size={14} aria-hidden />}
          {title}
        </span>
        {hint && <span className={`block text-xs ${on ? 'text-nav-active-text' : 'text-muted'}`}>{hint}</span>}
      </span>
    </label>
  )
}

export function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="rounded-card border border-card-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function Notice({ tone, children, action }: { tone: 'success' | 'warning' | 'error'; children: ReactNode; action?: ReactNode }) {
  const cls = { success: 'bg-tag-success-bg text-tag-success-text', warning: 'bg-tag-warning-bg text-tag-warning-text', error: 'bg-tag-error-bg text-tag-error-text' }[tone]
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : AlertCircle
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control px-4 py-2.5 text-sm ${cls}`}>
      <span className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{children}</span>
      </span>
      {action}
    </div>
  )
}
