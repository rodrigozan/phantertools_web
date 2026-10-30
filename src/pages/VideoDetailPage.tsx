import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Info, Pencil, RotateCcw, Upload } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatBytes, formatDateTime } from '../lib/format'
import { DESCRIPTION_MAX_BYTES, THUMB_MAX_BYTES, TAGS_MAX_CHARS, TITLE_MAX, byteLength, categoryLabel, languageLabel, studioUrl, tagsLength } from '../lib/youtube'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import type { YoutubeVideo } from '../lib/types'
import { Button, Card, ConfirmDialog, ErrorCard, Field, Input, PageHeader, Skeleton, Textarea } from '../components/ui'
import { YoutubeReconnectBanners } from '../components/AccountBanners'
import { Chip, Counter, FormatTag, Notice, Progress, Section, Steps, Thumb, YtStatusTag, type Step } from '../components/youtube'
import { useToast } from '../components/toast'

const privacyLabel = { private: 'Privado', unlisted: 'Não listado', public: 'Público' } as const
const INTERRUPTED = /Confira no YouTube/

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

function ProgressSteps({ v }: { v: YoutubeVideo }) {
  const hasThumb = Boolean(v.thumbnailStatus && v.thumbnailStatus !== 'none')
  const stage = v.status === 'queued' ? 'queued' : (v.stage ?? 'uploading')
  const order = ['queued', 'uploading', 'thumbnail', 'verifying']
  const at = Math.max(order.indexOf(stage), 0)
  const state = (i: number): Step['state'] => (i < at ? 'done' : i === at ? 'now' : 'todo')
  const pct = Math.round(v.progress ?? 0)
  const steps: Step[] = [
    { label: 'Na fila', state: state(0) },
    {
      label: 'Enviando para o YouTube',
      state: state(1),
      note:
        state(1) === 'now' ? (
          <div className="max-w-md">
            <Progress pct={pct} label="Envio para o YouTube" />
            <p className="mt-1 tabular-nums">{pct}%</p>
          </div>
        ) : undefined,
    },
    ...(hasThumb ? [{ label: 'Aplicando a thumbnail', state: state(2) }] : []),
    { label: 'Conferindo no YouTube', state: state(3) },
  ]
  return <Steps steps={steps} />
}

export default function VideoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const { channels } = useYoutubeChannels()
  const [video, setVideo] = useState<YoutubeVideo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'retry' | 'discard' | 'thumb' | 'thumbRetry' | null>(null)
  const [confirm, setConfirm] = useState<'retry' | 'discard' | null>(null)
  const thumbInput = useRef<HTMLInputElement>(null)
  const hadId = useRef(false)

  const adopt = useCallback((v: YoutubeVideo, resetForm: boolean) => {
    setVideo(v)
    if (resetForm) {
      setTitle(v.title)
      setDescription(v.description ?? '')
      setTags(v.tags ?? [])
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await api.get<YoutubeVideo>(`/youtube/videos/${id}`)
      adopt(r.data, true)
      hadId.current = Boolean(r.data.youtubeVideoId)
      setLoadError('')
    } catch (e) {
      setLoadError(errorInfo(e).message)
    }
  }, [id, adopt])

  useEffect(() => {
    void load()
  }, [load])

  // O envio roda no servidor; a tela só observa enquanto o vídeo está em andamento.
  const inProgress = video ? ['queued', 'uploading', 'processing'].includes(video.status) : false
  useEffect(() => {
    if (!inProgress) return
    const t = setInterval(async () => {
      try {
        const r = await api.get<YoutubeVideo>(`/youtube/videos/${id}`)
        adopt(r.data, Boolean(r.data.youtubeVideoId) && !hadId.current)
        hadId.current = Boolean(r.data.youtubeVideoId)
      } catch {
        return
      }
    }, 2500)
    return () => clearInterval(t)
  }, [inProgress, id, adopt])

  if (loadError && !video) return <ErrorCard message={loadError} onRetry={load} />
  if (!video)
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )

  const v = video
  const channel = channels.find((c) => c.channelId === v.channelId)
  const live = Boolean(v.youtubeVideoId)
  const interrupted = v.status === 'failed' && !live && INTERRUPTED.test(v.lastError ?? '')
  const subtitle = `${v.channelTitle ?? channel?.title ?? ''} · ${v.format === 'short' ? 'Short' : 'Vídeo longo'}`
  const scheduleText =
    v.publishAt && Date.parse(v.publishAt) > Date.now() ? `Publica em ${formatDateTime(v.publishAt, tz)} · Privado até lá` : v.status === 'published' && v.privacyStatus ? `${privacyLabel[v.privacyStatus]} no YouTube` : ''

  const discard = async () => {
    setBusy('discard')
    try {
      await api.delete(`/youtube/videos/${v.id}`)
      toast({ tone: 'success', text: 'Envio descartado.' })
      navigate('/videos')
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  const retry = async () => {
    setBusy('retry')
    try {
      const r = await api.post<YoutubeVideo>(`/youtube/videos/${v.id}/retry`)
      adopt(r.data, false)
      toast({ tone: 'success', text: 'Envio recolocado na fila.' })
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  const changed = title !== v.title || description !== (v.description ?? '') || !sameTags(tags, v.tags ?? [])

  const save = async () => {
    const fe: Record<string, string> = {}
    if (!title.trim()) fe.title = 'Escreva um título para o vídeo.'
    else if (title.length > TITLE_MAX) fe.title = `O título passa de ${TITLE_MAX} caracteres.`
    else if (/[<>]/.test(title)) fe.title = 'O título não pode ter < ou >.'
    if (byteLength(description) > DESCRIPTION_MAX_BYTES) fe.description = `A descrição passa de ${DESCRIPTION_MAX_BYTES} bytes.`
    else if (/[<>]/.test(description)) fe.description = 'A descrição não pode ter < ou >.'
    if (tagsLength(tags) > TAGS_MAX_CHARS) fe.tags = `As tags passam de ${TAGS_MAX_CHARS} caracteres.`
    setFieldErrors(fe)
    if (Object.keys(fe).length) return
    setSaving(true)
    setResult(null)
    const body: Record<string, unknown> = { channelId: v.channelId }
    if (title !== v.title) body.title = title.trim()
    if (description !== (v.description ?? '')) body.description = description
    if (!sameTags(tags, v.tags ?? [])) body.tags = tags
    try {
      await api.patch(`/youtube/videos/${v.youtubeVideoId}/snippet`, body)
      setResult({ tone: 'success', text: 'Conferido no YouTube: título, descrição e tags batem com o que você salvou.' })
      setVideo({ ...v, title: title.trim(), description, tags })
    } catch (e) {
      const info = errorInfo(e)
      if (info.fields && Object.keys(info.fields).length) setFieldErrors(info.fields)
      const diverged = (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'verify_diverged'
      setResult({
        tone: 'error',
        text: diverged ? 'Atualização enviada, mas a conferência divergiu. Não repita agora: abra o vídeo no YouTube Studio e confira antes de salvar de novo.' : info.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const replaceThumb = async (file: File) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) return toast({ tone: 'error', text: 'A thumbnail precisa ser PNG ou JPG.' })
    if (file.size > THUMB_MAX_BYTES) return toast({ tone: 'error', text: `A thumbnail tem ${formatBytes(file.size)}, mais que o limite de 2 MB.` })
    setBusy('thumb')
    const form = new FormData()
    form.append('file', file)
    try {
      await api.put(`/youtube/videos/${v.youtubeVideoId}/thumbnail?channelId=${encodeURIComponent(v.channelId)}`, form)
      toast({ tone: 'success', text: 'Thumbnail atualizada.' })
      await load()
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(null)
    }
  }

  const retryThumb = async () => {
    setBusy('thumbRetry')
    try {
      const r = await api.post<YoutubeVideo>(`/youtube/videos/${v.id}/thumbnail/retry`)
      adopt(r.data, false)
      toast({ tone: 'success', text: 'Thumbnail aplicada.' })
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const thumbFailed = live && v.thumbnailStatus === 'failed'
  const details = (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Dados do envio</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Visibilidade</dt>
        <dd>{v.privacyStatus ? privacyLabel[v.privacyStatus] : '—'}{v.publishAt ? `, publica em ${formatDateTime(v.publishAt, tz)}` : ''}</dd>
        <dt className="text-muted">Categoria</dt>
        <dd>{categoryLabel(v.categoryId)}</dd>
        <dt className="text-muted">Idioma</dt>
        <dd>{languageLabel(v.language)}</dd>
        <dt className="text-muted">Para crianças</dt>
        <dd>{v.madeForKids === undefined ? '—' : v.madeForKids ? 'Sim' : 'Não'}</dd>
        <dt className="text-muted">Tags</dt>
        <dd>{v.tags.length === 1 ? '1 tag' : `${v.tags.length} tags`}</dd>
      </dl>
    </Card>
  )

  return (
    <div>
      <YoutubeReconnectBanners context="videos" />
      <Link to="/videos" className="mb-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-ink md:min-h-0">
        ← Vídeos
      </Link>
      <PageHeader
        title={v.title}
        description={subtitle}
        actions={
          live && v.youtubeUrl ? (
            <a href={v.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control border border-control px-3.5 text-sm font-medium hover:bg-raised">
              <ExternalLink size={16} aria-hidden /> Ver no YouTube
            </a>
          ) : v.status === 'queued' ? (
            <Button variant="danger" onClick={() => setConfirm('discard')}>Cancelar envio</Button>
          ) : v.status === 'draft' ? (
            <Button variant="primary" icon={<Pencil size={14} aria-hidden />} onClick={() => navigate(`/videos/${v.id}/editar`)}>Continuar editando</Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <YtStatusTag s={v.status} />
        <FormatTag f={v.format} />
        {scheduleText && <span className="text-sm tabular-nums text-muted">{scheduleText}</span>}
      </div>

      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      {thumbFailed && (
        <Notice
          tone="warning"
          action={<Button loading={busy === 'thumbRetry'} icon={<RotateCcw size={14} aria-hidden />} onClick={retryThumb}>Tentar de novo</Button>}
        >
          O vídeo está no YouTube, mas a thumbnail não foi aplicada{v.thumbnailError ? `: ${v.thumbnailError}` : '.'} Se o canal ainda não pode ter thumbnail personalizada, verifique o canal em youtube.com/verify.
        </Notice>
      )}
      {live && v.status === 'failed' && v.lastError && <Notice tone="error">{v.lastError}</Notice>}

      {!live ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_384px]">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">{inProgress ? 'Andamento do envio' : 'O que aconteceu'}</h2>
            {inProgress && (
              <>
                <div className="mt-4"><ProgressSteps v={v} /></div>
                <p className="mt-5 flex items-center gap-1.5 text-sm text-muted">
                  <Info size={14} aria-hidden /> Pode fechar esta página. O envio continua no servidor e você recebe um aviso se algo falhar.
                </p>
              </>
            )}
            {v.status === 'failed' && !interrupted && (
              <div className="mt-4 flex flex-col gap-4">
                <Notice tone="error">{v.lastError ?? 'O envio falhou. Nada foi enviado ao canal.'}</Notice>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" loading={busy === 'retry'} icon={<RotateCcw size={14} aria-hidden />} onClick={retry}>Tentar de novo</Button>
                  <Button onClick={() => navigate(`/videos/${v.id}/editar`)}>Editar</Button>
                  <Button variant="danger" onClick={() => setConfirm('discard')}>Descartar</Button>
                </div>
                <p className="text-xs text-muted">Tentar de novo só aparece porque o vídeo não chegou ao YouTube.</p>
              </div>
            )}
            {interrupted && (
              <div className="mt-4 flex flex-col gap-4">
                <Notice tone="warning">O envio foi interrompido quando o servidor reiniciou. Pode ser que o vídeo já tenha chegado ao canal.</Notice>
                <p className="text-sm">Confira no YouTube Studio antes de enviar de novo, para não duplicar o vídeo.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={studioUrl(v.channelId)} target="_blank" rel="noreferrer" className="inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control border border-control px-3.5 text-sm font-medium hover:bg-raised">
                    <ExternalLink size={14} aria-hidden /> Abrir YouTube Studio
                  </a>
                  <Button onClick={() => setConfirm('retry')}>Já conferi, enviar de novo</Button>
                  <Button variant="danger" onClick={() => setConfirm('discard')}>Descartar</Button>
                </div>
              </div>
            )}
            {v.status === 'draft' && <p className="mt-4 text-sm text-muted">Este vídeo ainda é um rascunho. Continue editando para enviar ao YouTube.</p>}
            {v.status === 'cancelled' && <p className="mt-4 text-sm text-muted">Este envio foi cancelado e nada foi enviado ao canal.</p>}
          </Card>
          {details}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_384px]">
          <div className="flex flex-col gap-4">
            <Section title="Título, descrição e tags" hint="Editar aqui altera o vídeo no YouTube. A visibilidade e a data não mudam.">
              <Field label="Título" error={fieldErrors.title}>
                {(fid, d) => (
                  <div className="flex flex-col gap-1">
                    <Input id={fid} aria-describedby={d} aria-invalid={Boolean(fieldErrors.title) || undefined} value={title} onChange={(e) => setTitle(e.target.value)} />
                    <div className="flex justify-end"><Counter n={title.length} max={TITLE_MAX} /></div>
                  </div>
                )}
              </Field>
              <Field label="Descrição" error={fieldErrors.description}>
                {(fid, d) => (
                  <div className="flex flex-col gap-1">
                    <Textarea id={fid} aria-describedby={d} aria-invalid={Boolean(fieldErrors.description) || undefined} className="min-h-36" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <div className="flex justify-end"><Counter n={byteLength(description)} max={DESCRIPTION_MAX_BYTES} unit=" bytes" /></div>
                  </div>
                )}
              </Field>
              <Field label="Tags" error={fieldErrors.tags}>
                {(fid, d) => (
                  <div className="flex flex-col gap-2">
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <Chip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</Chip>
                        ))}
                      </div>
                    )}
                    <Input
                      id={fid}
                      aria-describedby={d}
                      value={tagInput}
                      placeholder="Digite uma tag e aperte Enter"
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          const t = tagInput.trim()
                          if (t && !tags.includes(t)) setTags([...tags, t])
                          setTagInput('')
                        }
                      }}
                    />
                    <div className="flex justify-end"><Counter n={tagsLength(tags)} max={TAGS_MAX_CHARS} unit=" caracteres" /></div>
                  </div>
                )}
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">Depois de salvar, conferimos no YouTube se tudo ficou igual.</p>
                <Button variant="primary" disabled={!changed} loading={saving} icon={<Pencil size={14} aria-hidden />} onClick={save}>Salvar alterações</Button>
              </div>
            </Section>
          </div>
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <h2 className="text-lg font-semibold">Thumbnail</h2>
              <div className="mt-4">
                {v.thumbnailUrl && !thumbFailed ? (
                  <Thumb src={v.thumbnailUrl} className="w-full" />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-control bg-raised text-sm text-muted">Sem thumbnail personalizada</div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button loading={busy === 'thumb'} icon={<Upload size={14} aria-hidden />} onClick={() => thumbInput.current?.click()}>Trocar thumbnail</Button>
                <input
                  ref={thumbInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Escolher nova thumbnail"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void replaceThumb(f)
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-muted">PNG ou JPG até 2 MB. Recomendado 1280×720.</p>
            </Card>
            <Card className="p-5">
              <h2 className="text-lg font-semibold">Visibilidade</h2>
              <p className="mt-3 flex items-center gap-2"><YtStatusTag s={v.status} /></p>
              <p className="mt-2 text-sm tabular-nums text-muted">
                {v.publishAt && Date.parse(v.publishAt) > Date.now()
                  ? `Privado até ${formatDateTime(v.publishAt, tz)}, quando o YouTube publica.`
                  : v.privacyStatus
                    ? `${privacyLabel[v.privacyStatus]} no YouTube.`
                    : ''}
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-faint">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden /> Por enquanto, para mudar a visibilidade use o YouTube Studio.
              </p>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'discard'}
        title="Descartar este envio?"
        message="O vídeo não será enviado ao YouTube. O arquivo continua na biblioteca por alguns dias."
        confirmLabel="Descartar"
        danger
        loading={busy === 'discard'}
        onClose={() => setConfirm(null)}
        onConfirm={discard}
      />
      <ConfirmDialog
        open={confirm === 'retry'}
        title="Enviar de novo?"
        message="Se o vídeo já estiver no canal, ele será enviado outra vez e ficará duplicado. Confirme só depois de conferir no YouTube Studio."
        confirmLabel="Enviar de novo"
        loading={busy === 'retry'}
        onClose={() => setConfirm(null)}
        onConfirm={retry}
      />
    </div>
  )
}
