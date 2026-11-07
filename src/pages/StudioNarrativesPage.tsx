import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { isWorking, usd, usePolling, type NarrativeSummary, type StudioOverview } from '../lib/studio'
import { useToast } from '../components/toast'
import { MissingKeys, StatusTag } from '../components/studio'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, Field, Input, PageHeader, SkeletonList, Textarea } from '../components/ui'

export default function StudioNarrativesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const overview = useFetch<StudioOverview>('/studio/overview')
  const list = useFetch<{ items: NarrativeSummary[] }>('/studio/narratives')
  const [form, setForm] = useState({ genre: '', period: '', tone: '', premise: '', targetMinutes: 30 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [removing, setRemoving] = useState<NarrativeSummary | null>(null)

  const items = list.data?.items ?? []
  usePolling(list.reload, items.some((n) => isWorking(n.status)))
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  async function create() {
    setSending(true)
    setErrors({})
    try {
      const r = await api.post<{ narrative: { id: string } }>('/studio/narratives', {
        genre: form.genre,
        period: form.period,
        targetMinutes: form.targetMinutes,
        ...(form.tone.trim() ? { tone: form.tone } : {}),
        ...(form.premise.trim() ? { premise: form.premise } : {}),
      })
      navigate(`/estudio/narrativas/${r.data.narrative.id}`)
    } catch (err) {
      const info = errorInfo(err)
      setErrors(info.fields)
      if (!Object.keys(info.fields).length) toast({ tone: 'error', text: info.message })
    } finally {
      setSending(false)
    }
  }

  async function remove() {
    if (!removing) return
    try {
      await api.delete(`/studio/narratives/${removing.id}`)
      list.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
    setRemoving(null)
  }

  return (
    <div>
      <PageHeader title="Narrativas" description="Histórias longas narradas: a IA planeja, escreve os capítulos, confere a continuidade, cria as cenas, grava a voz e monta o vídeo." />
      {overview.data && !overview.data.narrative && <MissingKeys>Cadastre a chave do OpenRouter para criar narrativas.</MissingKeys>}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Gênero" error={errors.genre}>
            {(id, desc) => <Input id={id} aria-describedby={desc} aria-invalid={Boolean(errors.genre) || undefined} placeholder="Ex.: romance de época" value={form.genre} onChange={(e) => set({ genre: e.target.value })} />}
          </Field>
          <Field label="Período e local" error={errors.period}>
            {(id, desc) => <Input id={id} aria-describedby={desc} aria-invalid={Boolean(errors.period) || undefined} placeholder="Ex.: Inglaterra, 1815" value={form.period} onChange={(e) => set({ period: e.target.value })} />}
          </Field>
          <Field label="Tom (opcional)" error={errors.tone}>{(id) => <Input id={id} placeholder="Ex.: melancólico e esperançoso" value={form.tone} onChange={(e) => set({ tone: e.target.value })} />}</Field>
          <Field label="Duração do vídeo (minutos)" error={errors.targetMinutes} hint="Define quantos capítulos serão escritos. Cerca de 8 minutos por capítulo.">
            {(id, desc) => <Input id={id} aria-describedby={desc} type="number" min={5} max={240} value={form.targetMinutes} onChange={(e) => set({ targetMinutes: Number(e.target.value) || 30 })} />}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Premissa (opcional)" error={errors.premise} hint="Em branco, a IA cria uma história original.">
            {(id, desc) => <Textarea id={id} aria-describedby={desc} className="min-h-24" value={form.premise} onChange={(e) => set({ premise: e.target.value })} />}
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Uma narrativa de 30 minutos faz dezenas de chamadas à IA e leva um bom tempo. O custo estimado aparece em cada narrativa.</p>
          <Button variant="primary" icon={<BookOpen size={16} aria-hidden />} loading={sending} loadingText="Criando..." disabled={overview.data ? !overview.data.narrative : false} onClick={create}>
            Criar narrativa
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        {list.loading && !list.data ? (
          <SkeletonList rows={3} />
        ) : list.error ? (
          <div className="p-5"><ErrorCard message={list.error} onRetry={list.reload} /></div>
        ) : !items.length ? (
          <EmptyState text="Nenhuma narrativa ainda." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <Link to={`/estudio/narrativas/${n.id}`} className="block truncate font-medium hover:underline">{n.title}</Link>
                  <p className="truncate text-xs text-muted">{isWorking(n.status) ? n.step : `${n.genre} · ${n.period}`}</p>
                </div>
                <StatusTag status={n.status} />
                <span className="text-sm text-muted tabular-nums">{n.chaptersApproved}/{n.chaptersPlanned} cap.</span>
                <span className="w-24 text-right text-sm tabular-nums">{usd(n.totalUsd)}</span>
                <Button variant="ghost" aria-label={`Apagar ${n.title}`} icon={<Trash2 size={16} aria-hidden />} disabled={isWorking(n.status)} onClick={() => setRemoving(n)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog open={Boolean(removing)} title="Apagar narrativa?" message="Texto, imagens, voz e vídeo são removidos do servidor." confirmLabel="Apagar" danger onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  )
}
