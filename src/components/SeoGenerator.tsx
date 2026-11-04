import { useEffect, useRef, useState } from 'react'
import { api, errorInfo } from '../lib/api'
import { Button, Field, FormError, Textarea } from './ui'

export type SeoDraft = { title: string; description: string; keywords: string[]; titleEvidence?: string }
type Props = {
  mediaIds?: string[]; videoId?: string; context: string
  platform: 'youtube' | 'instagram' | 'facebook'; format?: 'long' | 'short'
  disabled?: boolean; onApply: (draft: SeoDraft) => void
}

export function SeoGenerator({ mediaIds = [], videoId, context, platform, format, disabled, onApply }: Props) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<SeoDraft | null>(null)
  const [applied, setApplied] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const generate = async () => {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setError(''); setDraft(null); setApplied(false)
    try {
      const { data } = await api.post<{ id: string }>('/seo', {
        mediaIds, videoId, context: [context, notes].filter(Boolean).join('\n').slice(0, 12000), platform, format,
      }, { signal: abort.signal })
      const deadline = Date.now() + 30 * 60_000
      while (!abort.signal.aborted) {
        if (Date.now() > deadline) throw new Error('A análise excedeu o tempo limite. Tente novamente.')
        const { data: job } = await api.get<{ status: string; draft?: SeoDraft; error?: string }>(`/seo/${data.id}`, { signal: abort.signal })
        if (job.status === 'completed' && job.draft) { setDraft(job.draft); break }
        if (job.status === 'failed') throw new Error(job.error || 'Não foi possível gerar os metadados.')
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', done); resolve() }
          const timer = setTimeout(done, 2500)
          abort.signal.addEventListener('abort', done, { once: true })
        })
      }
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error && !('response' in e) ? e.message : errorInfo(e).message)
    } finally {
      if (!abort.signal.aborted) setBusy(false)
    }
  }

  return (
    <section aria-label="Metadados SEO" className="flex flex-col gap-3 rounded-control border border-border p-4">
      <h2 className="text-sm font-medium">Metadados otimizados de SEO</h2>
      <p className="text-sm text-muted">Gere título, descrição com exatamente 5 hashtags e palavras-chave. Revise a prévia antes de aplicar.</p>
      <Field label="Contexto para o SEO" hint="Opcional para vídeos com fala. Para imagens ou vídeos sem fala, descreva o conteúdo em pelo menos 40 caracteres.">
        {(id) => <Textarea id={id} rows={3} maxLength={12000} value={notes} disabled={busy || disabled} onChange={e => setNotes(e.target.value)} placeholder="Assunto, público e conteúdo que a publicação realmente entrega" />}
      </Field>
      <Button type="button" loading={busy} loadingText="Gerando metadados…" disabled={disabled || busy} onClick={generate}>Gerar metadados SEO</Button>
      {busy && <p role="status" className="text-sm text-muted">Analisando o conteúdo. Isso pode levar alguns minutos.</p>}
      <FormError message={error} />
      {draft && <div className="flex flex-col gap-3">
        <Field label="Título sugerido">{id => <Textarea id={id} rows={2} value={draft.title} readOnly />}</Field>
        <Field label="Descrição com 5 hashtags">{id => <Textarea id={id} rows={5} value={draft.description} readOnly />}</Field>
        <Field label="Keywords (palavras-chave)">{id => <Textarea id={id} rows={3} value={draft.keywords.join(', ')} readOnly />}</Field>
        <Button type="button" disabled={disabled} onClick={() => { onApply(draft); setApplied(true) }}>Aplicar metadados aos campos</Button>
        {applied && <p role="status" className="text-sm text-muted">Metadados aplicados. Salve o formulário para guardar as alterações.</p>}
      </div>}
    </section>
  )
}
