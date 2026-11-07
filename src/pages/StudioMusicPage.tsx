import { useState } from 'react'
import { Music, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { clock, isWorking, trackFileUrl, usePolling, type StudioOverview, type StudioTrack } from '../lib/studio'
import { useToast } from '../components/toast'
import { MissingKeys, StatusTag, UploadButton } from '../components/studio'
import { Button, Card, ConfirmDialog, Dash, EmptyState, ErrorCard, Field, Input, PageHeader, Select, SkeletonList, Tag, Textarea, Toggle } from '../components/ui'

const PROVIDERS: Record<string, string> = { suno: 'Suno', replicate: 'Replicate · MusicGen', upload: 'Enviada' }

export default function StudioMusicPage() {
  const toast = useToast()
  const overview = useFetch<StudioOverview>('/studio/overview')
  const list = useFetch<{ items: StudioTrack[] }>('/studio/tracks')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [provider, setProvider] = useState('auto')
  const [instrumental, setInstrumental] = useState(true)
  const [seconds, setSeconds] = useState(30)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [removing, setRemoving] = useState<StudioTrack | null>(null)

  const items = list.data?.items ?? []
  usePolling(list.reload, items.some((t) => isWorking(t.status)))

  const providers = overview.data?.music ?? []
  const none = Boolean(overview.data) && providers.length === 0

  async function generate() {
    setSending(true)
    setErrors({})
    try {
      await api.post('/studio/tracks', { prompt, title: title || undefined, provider, instrumental, seconds })
      toast({ tone: 'success', text: 'Música enviada. Leva alguns minutos para ficar pronta.' })
      setPrompt('')
      setTitle('')
      list.reload()
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
      await api.delete(`/studio/tracks/${removing.id}`)
      list.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
    setRemoving(null)
  }

  return (
    <div>
      <PageHeader
        title="Músicas"
        description="Gere trilhas com o Suno (ou o Replicate, se o Suno falhar) ou envie as suas. As faixas prontas entram nos vídeos."
        actions={<UploadButton url="/studio/tracks/upload" accept="audio/*" label="Enviar áudios" onDone={list.reload} />}
      />
      {none && <MissingKeys>Cadastre a chave do Suno ou do Replicate para gerar músicas.</MissingKeys>}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <Field label="Como é a música?" error={errors.prompt} hint="Estilo, clima, instrumentos. Ex.: lo-fi calmo com piano e chuva ao fundo.">
            {(id, desc) => <Textarea id={id} aria-describedby={desc} aria-invalid={Boolean(errors.prompt) || undefined} className="min-h-32" value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
          </Field>
          <div className="flex flex-col gap-4">
            <Field label="Título (opcional)" error={errors.title}>
              {(id) => <Input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Provedor">
                {(id) => (
                  <Select id={id} value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="auto">Automático</option>
                    {providers.map((p) => (
                      <option key={p} value={p}>{PROVIDERS[p]}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Duração (s)" hint="Só no Replicate.">
                {(id, desc) => <Input id={id} aria-describedby={desc} type="number" min={5} max={300} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 30)} />}
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Só instrumental</span>
              <Toggle checked={instrumental} onChange={setInstrumental} label="Só instrumental" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" icon={<Music size={16} aria-hidden />} loading={sending} loadingText="Enviando..." disabled={none || prompt.trim().length < 3} onClick={generate}>
            Gerar música
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        {list.loading && !list.data ? (
          <SkeletonList rows={4} />
        ) : list.error ? (
          <div className="p-5"><ErrorCard message={list.error} onRetry={list.reload} /></div>
        ) : !items.length ? (
          <EmptyState text="Nenhuma música ainda." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-medium">{t.title || 'Sem título'}</p>
                  <p className="truncate text-xs text-muted" title={t.prompt}>{t.prompt || 'Áudio enviado por você'}</p>
                  {t.status === 'failed' && t.error && <p className="mt-1 text-xs text-negative" role="alert">{t.error}</p>}
                </div>
                <Tag tone="neutral">{PROVIDERS[t.provider]}</Tag>
                <StatusTag status={t.status} />
                <span className="w-12 text-right text-sm tabular-nums">{t.duration ? clock(t.duration) : <Dash />}</span>
                {t.status === 'done' ? <audio controls preload="none" src={trackFileUrl(t.id)} className="h-9 w-full max-w-64" aria-label={`Ouvir ${t.title}`} /> : <span className="w-full max-w-64" />}
                <Button variant="ghost" aria-label={`Apagar ${t.title || 'música'}`} icon={<Trash2 size={16} aria-hidden />} onClick={() => setRemoving(t)} disabled={t.status === 'queued' || t.status === 'processing'} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog open={Boolean(removing)} title="Apagar música?" message="O áudio é removido do servidor. Vídeos já prontos não mudam." confirmLabel="Apagar" danger onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  )
}
