import { useState } from 'react'
import { ImageIcon, Sparkles, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { imageFileUrl, isWorking, usePolling, type StudioImage, type StudioOverview } from '../lib/studio'
import { useToast } from '../components/toast'
import { MissingKeys, StatusTag, UploadButton } from '../components/studio'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, Field, PageHeader, Select, SkeletonList, Textarea } from '../components/ui'

const ENGINES: Record<string, string> = { gemini: 'Gemini', openrouter: 'OpenRouter' }

export default function StudioImagesPage() {
  const toast = useToast()
  const overview = useFetch<StudioOverview>('/studio/overview')
  const list = useFetch<{ items: StudioImage[] }>('/studio/images')
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('')
  const [engine, setEngine] = useState('gemini')
  const [aspect, setAspect] = useState('16:9')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [removing, setRemoving] = useState<StudioImage | null>(null)

  const items = list.data?.items ?? []
  usePolling(list.reload, items.some((i) => isWorking(i.status)))

  const engines = overview.data?.imageEngines ?? []
  const noEngine = Boolean(overview.data) && engines.length === 0
  const activeEngine = engines.includes(engine) ? engine : (engines[0] ?? engine)

  async function generate() {
    setSending(true)
    setErrors({})
    try {
      await api.post('/studio/images', { prompt, ...(preset ? { preset } : {}), engine: activeEngine, aspectRatio: aspect })
      toast({ tone: 'success', text: 'Gerando a imagem. Ela aparece aqui quando ficar pronta.' })
      setPrompt('')
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
      await api.delete(`/studio/images/${removing.id}`)
      list.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
    setRemoving(null)
  }

  return (
    <div>
      <PageHeader
        title="Imagens"
        description="Capas e cenas geradas por IA, ou enviadas por você. Elas ficam na biblioteca e entram nos vídeos."
        actions={<UploadButton url="/studio/images/upload" accept="image/png,image/jpeg,image/webp" label="Enviar imagens" onDone={list.reload} />}
      />
      {noEngine && <MissingKeys>Cadastre a chave do Gemini ou do OpenRouter para gerar imagens.</MissingKeys>}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <Field label="Descrição da imagem" error={errors.prompt} hint="Deixe em branco e escolha um estilo: o Gemini escreve o prompt por você.">
            {(id, desc) => (
              <Textarea id={id} aria-describedby={desc} aria-invalid={Boolean(errors.prompt) || undefined} className="min-h-32" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: farol ao entardecer, mar calmo, luz dourada" />
            )}
          </Field>
          <div className="flex flex-col gap-4">
            <Field label="Estilo da capa">
              {(id) => (
                <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value)}>
                  <option value="">Sem estilo</option>
                  {overview.data?.presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gerador" error={errors.engine}>
                {(id) => (
                  <Select id={id} value={activeEngine} onChange={(e) => setEngine(e.target.value)} disabled={engines.length < 2}>
                    {(engines.length ? engines : ['gemini']).map((e) => (
                      <option key={e} value={e}>{ENGINES[e]}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Formato">
                {(id) => (
                  <Select id={id} value={aspect} onChange={(e) => setAspect(e.target.value)}>
                    {overview.data?.aspectRatios.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    )) ?? <option value="16:9">16:9</option>}
                  </Select>
                )}
              </Field>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" icon={<Sparkles size={16} aria-hidden />} loading={sending} loadingText="Enviando..." disabled={noEngine || (!prompt.trim() && !preset)} onClick={generate}>
            Gerar imagem
          </Button>
        </div>
      </Card>

      <div className="mt-6">
        {list.loading && !list.data ? (
          <SkeletonList rows={3} />
        ) : list.error ? (
          <ErrorCard message={list.error} onRetry={list.reload} />
        ) : !items.length ? (
          <EmptyState text="Nenhuma imagem ainda." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((img) => (
              <li key={img.id}>
                <Card className="overflow-hidden">
                  <div className="flex aspect-video items-center justify-center bg-raised">
                    {img.status === 'done' ? (
                      <img src={imageFileUrl(img.id)} alt={img.prompt || img.originalName || 'Imagem do Estúdio'} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={32} className="text-faint" aria-hidden />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <StatusTag status={img.status} />
                      <span className="text-xs text-muted">{img.engine === 'upload' ? 'Enviada' : (ENGINES[img.engine] ?? img.engine)}{img.aspectRatio ? ` · ${img.aspectRatio}` : ''}</span>
                    </div>
                    <p className="line-clamp-2 min-h-10 text-sm text-muted" title={img.prompt || img.originalName || ''}>
                      {img.prompt || img.originalName || 'Sem descrição'}
                    </p>
                    {img.error && <p className="text-xs text-negative" role="alert">{img.error}</p>}
                    <div className="flex justify-end">
                      <Button variant="ghost" aria-label="Apagar imagem" icon={<Trash2 size={16} aria-hidden />} onClick={() => setRemoving(img)} disabled={img.status === 'generating'}>
                        Apagar
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog open={Boolean(removing)} title="Apagar imagem?" message="O arquivo é removido do servidor. Vídeos já prontos não mudam." confirmLabel="Apagar" danger onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  )
}
