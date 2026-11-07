import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Download, RotateCcw } from 'lucide-react'
import { api, apiUrl, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { isWorking, usd, usePolling } from '../lib/studio'
import { useToast } from '../components/toast'
import { Section, StatusTag } from '../components/studio'
import { Banner, Button, Card, ErrorCard, Skeleton, Tag } from '../components/ui'

type Narrative = {
  id: string
  title: string
  genre: string
  period: string
  status: string
  step: string
  error: string | null
  running: boolean
  chaptersPlanned: number
  chaptersApproved: number
  totalUsd: number
  hasVideo: boolean
  targetMinutes: number
  storyBible: {
    title: string
    location: string
    centralGoal: string
    tone: string[]
    characters: { name: string; role: string; age: number; appearance: string }[]
    outline: { number: number; summary: string }[]
  } | null
  chapters: { number: number; wordCount: number; summary: string; status: 'draft' | 'approved' | 'needs_review'; text: string; checks: { attempt: number; issues: { description: string; severity: string }[] }[] }[]
  visualPrompts: { chapter: number; timeRange: string; prompt: string; hasImage: boolean }[]
  narrations: number[]
  metadata: { titles: string[]; description: string; tags: string; closingQuestion: string } | null
  costs: { step: string; model: string; usd: number }[]
}

const chapterTag = { approved: ['success', 'Aprovado'], draft: ['neutral', 'Rascunho'], needs_review: ['warning', 'Precisa de revisão'] } as const

const STEPS = [
  ['planning', 'Planejamento'],
  ['writing', 'Capítulos'],
  ['visual_prompts', 'Cenas'],
  ['images', 'Imagens'],
  ['narration', 'Narração'],
  ['metadata', 'Título'],
  ['assembling', 'Vídeo'],
] as const

export default function StudioNarrativeDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data, error, loading, reload } = useFetch<{ narrative: Narrative }>(`/studio/narratives/${id}`)
  const [busy, setBusy] = useState<'resume' | 'assemble' | null>(null)
  const n = data?.narrative
  usePolling(reload, Boolean(n && isWorking(n.status)), 3000)

  async function act(kind: 'resume' | 'assemble') {
    setBusy(kind)
    try {
      await api.post(`/studio/narratives/${id}/${kind}`)
      toast({ tone: 'success', text: kind === 'resume' ? 'Retomando de onde parou.' : 'Montando o vídeo.' })
      reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(null)
    }
  }

  if (loading && !n) return <div className="flex flex-col gap-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>
  if (error || !n) return <ErrorCard message={error ?? 'Narrativa não encontrada.'} onRetry={reload} />

  const working = isWorking(n.status)
  const stepIndex = STEPS.findIndex(([s]) => s === n.status)
  const canAssemble = !working && n.narrations.length > 0 && n.visualPrompts.length > 0 && n.visualPrompts.every((v) => v.hasImage)

  return (
    <div>
      <Link to="/estudio/narrativas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Narrativas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{n.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            <StatusTag status={n.status} />
            <span>{n.genre} · {n.period} · {n.targetMinutes} min</span>
            <span className="tabular-nums">· custo estimado {usd(n.totalUsd)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(n.status === 'failed' || n.status === 'review') && !n.running && (
            <Button icon={<RotateCcw size={16} aria-hidden />} loading={busy === 'resume'} loadingText="Retomando..." onClick={() => act('resume')}>
              {n.status === 'review' ? 'Tentar os capítulos de novo' : 'Retomar'}
            </Button>
          )}
          {canAssemble && (
            <Button variant="primary" icon={<Clapperboard size={16} aria-hidden />} loading={busy === 'assemble'} loadingText="Montando..." onClick={() => act('assemble')}>
              {n.hasVideo ? 'Montar o vídeo de novo' : 'Montar o vídeo'}
            </Button>
          )}
        </div>
      </div>

      {n.error && <Banner tone="error">{n.error}</Banner>}
      {n.status === 'review' && <Banner tone="warning">Alguns capítulos não passaram na checagem de continuidade. Leia as observações abaixo e tente de novo.</Banner>}

      <Card className="p-5">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" aria-label="Etapas">
          {STEPS.map(([s, label], i) => {
            const state = n.status === 'completed' || n.status === 'ready' ? 'done' : i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo'
            return (
              <li key={s} className="flex flex-col gap-1.5 text-sm" aria-current={state === 'now' ? 'step' : undefined}>
                <span className={`h-1.5 rounded-full ${state === 'done' ? 'bg-brand' : state === 'now' ? 'bg-brand-track' : 'bg-raised'}`} />
                <span className={state === 'todo' ? 'text-faint' : ''}>{label}</span>
              </li>
            )
          })}
        </ol>
        {working && <p className="mt-4 text-sm text-muted" role="status">{n.step}</p>}
      </Card>

      {n.hasVideo && (
        <Section title="Vídeo final" actions={<a className="inline-flex h-9 items-center gap-1.5 rounded-control border border-control px-3 text-sm hover:bg-raised" href={apiUrl(`/studio/narratives/${n.id}/video`)} download><Download size={16} aria-hidden /> Baixar</a>}>
          <video controls preload="metadata" src={apiUrl(`/studio/narratives/${n.id}/video`)} className="aspect-video w-full max-w-3xl rounded-card bg-raised" aria-label={`Vídeo de ${n.title}`} />
        </Section>
      )}

      {n.metadata && (
        <Section title="Título e descrição">
          <Card className="p-5">
            <p className="text-sm font-medium">Opções de título</p>
            <ul className="mt-1 list-disc pl-5 text-sm">{n.metadata.titles.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="mt-4 text-sm font-medium">Descrição</p>
            <p className="mt-1 text-sm whitespace-pre-line">{n.metadata.description}</p>
            <p className="mt-4 text-sm font-medium">Tags</p>
            <p className="mt-1 text-sm">{n.metadata.tags}</p>
            <p className="mt-4 text-sm font-medium">Pergunta final</p>
            <p className="mt-1 text-sm">{n.metadata.closingQuestion}</p>
          </Card>
        </Section>
      )}

      {n.storyBible && (
        <Section title="A história" description={`${n.storyBible.location} · ${n.storyBible.tone.join(', ')}`}>
          <Card className="p-5">
            <p className="text-sm"><span className="font-medium">Objetivo central:</span> {n.storyBible.centralGoal}</p>
            <h3 className="mt-5 text-sm font-medium">Personagens</h3>
            <ul className="mt-2 grid gap-3 md:grid-cols-2">
              {n.storyBible.characters.map((c) => (
                <li key={c.name} className="rounded-control bg-raised p-3 text-sm">
                  <p className="font-medium">{c.name} <span className="font-normal text-muted">· {c.role}, {c.age} anos</span></p>
                  <p className="mt-1 text-muted">{c.appearance}</p>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      {n.chapters.length > 0 && (
        <Section title="Capítulos" description={`${n.chaptersApproved} de ${n.chaptersPlanned} aprovados`}>
          <div className="flex flex-col gap-2">
            {n.chapters.map((c) => {
              const [tone, label] = chapterTag[c.status]
              const issues = c.checks.at(-1)?.issues ?? []
              return (
                <Card key={c.number}>
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-3 px-5 py-3 marker:content-none">
                      <span className="font-medium">Capítulo {c.number}</span>
                      <Tag tone={tone}>{label}</Tag>
                      <span className="text-sm text-muted tabular-nums">{c.wordCount} palavras</span>
                      {n.narrations.includes(c.number) && <Tag tone="brand">Narrado</Tag>}
                    </summary>
                    <div className="border-t border-border px-5 py-4">
                      {c.summary && <p className="mb-3 text-sm text-muted"><span className="font-medium text-ink">Resumo:</span> {c.summary}</p>}
                      {issues.length > 0 && (
                        <ul className="mb-3 list-disc pl-5 text-sm text-negative">
                          {issues.map((i) => <li key={i.description}>{i.description}</li>)}
                        </ul>
                      )}
                      {n.narrations.includes(c.number) && <audio controls preload="none" src={apiUrl(`/studio/narratives/${n.id}/audio/${c.number}`)} className="mb-3 h-9 w-full max-w-md" aria-label={`Ouvir capítulo ${c.number}`} />}
                      <p className="text-sm whitespace-pre-line">{c.text}</p>
                    </div>
                  </details>
                </Card>
              )
            })}
          </div>
        </Section>
      )}

      {n.visualPrompts.length > 0 && (
        <Section title="Cenas" description={`${n.visualPrompts.filter((v) => v.hasImage).length} de ${n.visualPrompts.length} imagens geradas`}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {n.visualPrompts.map((v, i) => (
              <li key={i}>
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-raised">
                    {v.hasImage && <img src={apiUrl(`/studio/narratives/${n.id}/images/${i}`)} alt={v.prompt} loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <p className="p-3 text-xs text-muted"><span className="tabular-nums">Cap. {v.chapter} · {v.timeRange}</span></p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
