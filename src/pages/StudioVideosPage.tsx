import { useState } from 'react'
import { Clapperboard, Download, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { clock, imageFileUrl, isWorking, usePolling, videoFileUrl, videoSubtitlesUrl, type StudioImage, type StudioOverview, type StudioTrack, type StudioVideo } from '../lib/studio'
import { useToast } from '../components/toast'
import { Section, StatusTag } from '../components/studio'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, Field, FormError, Input, PageHeader, Select, SkeletonList, Tag, Toggle } from '../components/ui'
import { Link } from 'react-router-dom'

const MODES: Record<StudioVideo['mode'], { label: string; help: string }> = {
  individual: { label: 'Um vídeo por música', help: 'Cada música vira um vídeo. Use uma imagem para todas ou uma para cada, na mesma ordem.' },
  playlist: { label: 'Playlist em um vídeo', help: 'Junta as músicas na ordem escolhida em um só vídeo, com capítulos para a descrição e legendas.' },
  loop: { label: 'Loop sem áudio', help: 'Um clipe curto da imagem, para usar como fundo.' },
}

export default function StudioVideosPage() {
  const toast = useToast()
  const overview = useFetch<StudioOverview>('/studio/overview')
  const images = useFetch<{ items: StudioImage[] }>('/studio/images')
  const tracks = useFetch<{ items: StudioTrack[] }>('/studio/tracks')
  const videos = useFetch<{ items: StudioVideo[] }>('/studio/videos')
  const [mode, setMode] = useState<StudioVideo['mode']>('playlist')
  const [title, setTitle] = useState('')
  const [effects, setEffects] = useState(false)
  const [loopSeconds, setLoopSeconds] = useState(20)
  const [pickedImages, setPickedImages] = useState<string[]>([])
  const [pickedTracks, setPickedTracks] = useState<string[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [removing, setRemoving] = useState<StudioVideo | null>(null)

  const readyImages = (images.data?.items ?? []).filter((i) => i.status === 'done')
  const readyTracks = (tracks.data?.items ?? []).filter((t) => t.status === 'done')
  const list = videos.data?.items ?? []
  usePolling(videos.reload, list.some((v) => isWorking(v.status)), 3000)

  const toggle = (set: (fn: (s: string[]) => string[]) => void, id: string) => set((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const move = (index: number, by: -1 | 1) =>
    setPickedTracks((s) => {
      const next = [...s]
      ;[next[index], next[index + by]] = [next[index + by], next[index]]
      return next
    })

  async function create() {
    setSending(true)
    setError('')
    try {
      await api.post('/studio/videos', { title, mode, effects, imageIds: pickedImages, trackIds: mode === 'loop' ? [] : pickedTracks, ...(mode === 'loop' ? { loopSeconds } : {}) })
      toast({ tone: 'success', text: 'Vídeo na fila. Ele aparece abaixo quando ficar pronto.' })
      setTitle('')
      videos.reload()
    } catch (err) {
      const info = errorInfo(err)
      setError(Object.values(info.fields)[0] ?? info.message)
    } finally {
      setSending(false)
    }
  }

  async function remove() {
    if (!removing) return
    try {
      await api.delete(`/studio/videos/${removing.id}`)
      videos.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
    setRemoving(null)
  }

  const canCreate = pickedImages.length > 0 && (mode === 'loop' || pickedTracks.length > 0)

  return (
    <div>
      <PageHeader title="Vídeos" description="Monte vídeos com as imagens e músicas da biblioteca. A renderização roda no servidor, um vídeo por vez." />
      <Card className="p-5">
        <FormError message={error} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo de vídeo" hint={MODES[mode].help}>
            {(id, desc) => (
              <Select id={id} aria-describedby={desc} value={mode} onChange={(e) => setMode(e.target.value as StudioVideo['mode'])}>
                {Object.entries(MODES).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Título (opcional)">{(id) => <Input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}</Field>
        </div>

        <Section title="Imagens" description={mode === 'individual' ? 'Uma para todas as músicas ou uma para cada, na ordem.' : mode === 'playlist' ? 'Com várias, elas se alternam de música em música.' : 'A primeira escolhida é usada.'}>
          {!readyImages.length ? (
            <p className="text-sm text-muted">Nenhuma imagem pronta. <Link to="/estudio/imagens" className="underline">Gerar ou enviar imagens</Link>.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {readyImages.map((img) => {
                const order = pickedImages.indexOf(img.id)
                return (
                  <li key={img.id}>
                    <label className={`relative block cursor-pointer overflow-hidden rounded-control border focus-within:ring-2 focus-within:ring-brand ${order >= 0 ? 'border-brand' : 'border-card-border'}`}>
                      <input type="checkbox" className="sr-only" checked={order >= 0} onChange={() => toggle(setPickedImages, img.id)} aria-label={img.prompt || img.originalName || 'Imagem'} />
                      <img src={imageFileUrl(img.id)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                      {order >= 0 && <span className="absolute top-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-on-primary tabular-nums">{order + 1}</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {mode !== 'loop' ? (
          <Section title="Músicas" description="A ordem escolhida é a ordem do vídeo. Use as setas para reorganizar.">
            {!readyTracks.length ? (
              <p className="text-sm text-muted">Nenhuma música pronta. <Link to="/estudio/musicas" className="underline">Gerar ou enviar músicas</Link>.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <ul className="divide-y divide-border rounded-control border border-card-border">
                  {readyTracks.map((t) => (
                    <li key={t.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 focus-within:bg-raised">
                        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={pickedTracks.includes(t.id)} onChange={() => toggle(setPickedTracks, t.id)} />
                        <span className="min-w-0 flex-1 truncate text-sm">{t.title || 'Sem título'}</span>
                        <span className="text-xs text-muted tabular-nums">{clock(t.duration)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="mb-2 text-sm font-medium">Ordem no vídeo</p>
                  {!pickedTracks.length ? (
                    <p className="text-sm text-muted">Marque as músicas ao lado.</p>
                  ) : (
                    <ol className="divide-y divide-border rounded-control border border-card-border">
                      {pickedTracks.map((id, i) => {
                        const t = readyTracks.find((x) => x.id === id)
                        return (
                          <li key={id} className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-sm">
                            <span className="w-5 text-faint tabular-nums">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{t?.title}</span>
                            <Button variant="ghost" aria-label={`Subir ${t?.title}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                            <Button variant="ghost" aria-label={`Descer ${t?.title}`} disabled={i === pickedTracks.length - 1} onClick={() => move(i, 1)}>↓</Button>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </Section>
        ) : (
          <div className="mt-6 max-w-48">
            <Field label="Duração do loop (s)">{(id) => <Input id={id} type="number" min={5} max={3600} value={loopSeconds} onChange={(e) => setLoopSeconds(Number(e.target.value) || 20)} />}</Field>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" title={overview.data?.effects ? undefined : 'Coloque particles.mp4 e overlay.mp4 na pasta de efeitos do servidor para ligar.'}>
            <Toggle checked={effects && Boolean(overview.data?.effects)} onChange={setEffects} label="Partículas e luzes" disabled={!overview.data?.effects} />
            <span className={`text-sm ${overview.data?.effects ? '' : 'text-faint'}`}>Partículas e luzes{overview.data?.effects ? '' : ' (indisponível: faltam os vídeos de efeito)'}</span>
          </div>
          <Button variant="primary" icon={<Clapperboard size={16} aria-hidden />} loading={sending} loadingText="Enviando..." disabled={!canCreate} onClick={create}>
            Criar vídeo
          </Button>
        </div>
      </Card>

      <Section title="Vídeos criados">
        {videos.loading && !videos.data ? (
          <SkeletonList rows={3} />
        ) : videos.error ? (
          <ErrorCard message={videos.error} onRetry={videos.reload} />
        ) : !list.length ? (
          <Card><EmptyState text="Nenhum vídeo criado ainda." /></Card>
        ) : (
          <div className="flex flex-col gap-4">
            {list.map((v) => (
              <Card key={v.id} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="min-w-0 flex-1 truncate font-medium">{v.title || MODES[v.mode].label}</h3>
                  <Tag tone="neutral">{MODES[v.mode].label}</Tag>
                  <StatusTag status={v.status} />
                  {v.totalDuration != null && <span className="text-sm text-muted tabular-nums">{clock(v.totalDuration)}</span>}
                  <Button variant="ghost" aria-label="Apagar vídeo" icon={<Trash2 size={16} aria-hidden />} disabled={v.status === 'rendering'} onClick={() => setRemoving(v)} />
                </div>
                {isWorking(v.status) && <p className="mt-2 text-sm text-muted" role="status">{v.step}</p>}
                {v.status === 'failed' && v.error && <p className="mt-2 text-sm text-negative" role="alert">{v.error}</p>}
                {v.status === 'done' && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {v.items.map((it) => (
                      <div key={it.index}>
                        <video controls preload="metadata" src={videoFileUrl(v.id, it.index)} className="aspect-video w-full rounded-control bg-raised" aria-label={it.name} />
                        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{it.name} · <span className="tabular-nums">{clock(it.duration)}</span></span>
                          <a className="inline-flex h-9 items-center gap-1.5 rounded-control border border-control px-3 hover:bg-raised" href={videoFileUrl(v.id, it.index)} download>
                            <Download size={16} aria-hidden /> Baixar
                          </a>
                        </div>
                      </div>
                    ))}
                    {v.chapters && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-medium">Capítulos para a descrição</p>
                          <div className="flex gap-2">
                            <Button onClick={() => navigator.clipboard.writeText(v.chapters ?? '').then(() => toast({ tone: 'success', text: 'Capítulos copiados.' }))}>Copiar</Button>
                            <a className="inline-flex h-9 items-center rounded-control border border-control px-3 text-sm hover:bg-raised" href={videoSubtitlesUrl(v.id)}>Legendas .srt</a>
                          </div>
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-control bg-raised p-3 text-sm tabular-nums whitespace-pre-wrap">{v.chapters}</pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>
      <ConfirmDialog open={Boolean(removing)} title="Apagar vídeo?" message="Os arquivos do vídeo são removidos do servidor." confirmLabel="Apagar" danger onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  )
}
