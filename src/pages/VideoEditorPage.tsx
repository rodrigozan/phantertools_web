import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CalendarClock, CheckCircle2, Film, Image as ImageIcon, Info, MonitorPlay, Send, Smartphone, Upload } from 'lucide-react'
import { api, apiFileUrl, errorInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatBytes, zonedParts, zonedToUtc } from '../lib/format'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import { TAGS_MAX_CHARS, THUMB_MAX_BYTES, TITLE_MAX, DESCRIPTION_MAX_BYTES, byteLength, categoryLabel, formatDuration, tagsLength, tzLabel, youtubeCategories, youtubeLanguages } from '../lib/youtube'
import type { MediaItem, YoutubePrivacy, YoutubeQuota, YoutubeVideo, YoutubeFormat } from '../lib/types'
import { Button, Card, EmptyState, ErrorCard, Field, FormError, Input, PageHeader, Select, Skeleton, Tag, Textarea, Toggle } from '../components/ui'
import { YoutubeReconnectBanners } from '../components/AccountBanners'
import { Chip, Counter, Progress, RadioCard, Section, Thumb } from '../components/youtube'
import { useBeforeUnload } from '../components/useDirtyGuard'
import { useToast } from '../components/toast'

type Errors = Record<string, string>

const isReady = (m: MediaItem) => m.conversionStatus === 'done' || m.conversionStatus === 'not_needed'

function suggest(m: MediaItem): YoutubeFormat {
  const ratio = m.width && m.height ? m.width / m.height : undefined
  return m.durationSec && m.durationSec <= 180 && ratio !== undefined && ratio <= 1 ? 'short' : 'long'
}

function defaultWhen(tz: string) {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  d.setMinutes(0, 0, 0)
  return zonedParts(d, tz)
}

const shortDate = (date: string) => date.split('-').reverse().slice(0, 2).join('/')

function useMediaPoll(media: MediaItem | null, onUpdate: (m: MediaItem) => void) {
  const id = media && !isReady(media) && media.conversionStatus !== 'failed' ? media.id : null
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  useEffect(() => {
    if (!id) return
    const t = setInterval(async () => {
      try {
        const r = await api.get<MediaItem[]>(`/media?purpose=youtube&ids=${id}`)
        if (r.data[0]) cb.current(r.data[0])
      } catch {
        return
      }
    }, 2000)
    return () => clearInterval(t)
  }, [id])
}

type Sending = { file: File; progress: number; loaded: number; startedAt: number; abort: AbortController }

async function sendFile(file: File, signal: AbortSignal, onProgress: (loaded: number) => void) {
  const form = new FormData()
  form.append('files', file)
  const r = await api.post<MediaItem[]>('/youtube/media', form, { signal, onUploadProgress: (e) => onProgress(e.loaded) })
  return r.data[0]
}

function VideoPicker({
  media,
  onMedia,
  library,
  onSending,
  error,
}: {
  media: MediaItem | null
  onMedia: (m: MediaItem | null) => void
  library: MediaItem[]
  onSending: (busy: boolean) => void
  error?: string
}) {
  const [sending, setSending] = useState<Sending | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const start = async (file: File) => {
    setFailure(null)
    if (!file.type.startsWith('video/')) {
      setFailure('Escolha um arquivo de vídeo (MP4, MOV, WebM e similares).')
      return
    }
    const abort = new AbortController()
    const base = { file, startedAt: Date.now(), abort }
    setSending({ ...base, progress: 0, loaded: 0 })
    onSending(true)
    try {
      const m = await sendFile(file, abort.signal, (loaded) => setSending((s) => (s ? { ...s, loaded, progress: Math.round((loaded / file.size) * 100) } : s)))
      onMedia(m)
    } catch (e) {
      if (!abort.signal.aborted) setFailure(errorInfo(e).message)
    } finally {
      setSending(null)
      onSending(false)
    }
  }

  const eta = (s: Sending) => {
    const secs = (Date.now() - s.startedAt) / 1000
    if (s.loaded <= 0 || secs < 2) return ''
    const left = (s.file.size - s.loaded) / (s.loaded / secs)
    return left < 60 ? ' · restam menos de 1 min' : ` · restam cerca de ${Math.round(left / 60)} min`
  }

  if (sending) {
    return (
      <div className="rounded-card border border-dashed border-control p-5">
        <div className="flex items-center gap-3">
          <Film size={20} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{sending.file.name}</p>
              <span className="text-sm tabular-nums text-muted">{sending.progress}%</span>
            </div>
            <div className="mt-2">
              <Progress pct={sending.progress} label={`Envio de ${sending.file.name}`} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted" aria-live="off">
              {formatBytes(sending.loaded)} de {formatBytes(sending.file.size)}
              {eta(sending)}
            </p>
          </div>
          <Button variant="ghost" aria-label="Cancelar o envio do arquivo" onClick={() => sending.abort.abort()}>
            Remover
          </Button>
        </div>
      </div>
    )
  }

  if (media) {
    return (
      <div className="flex items-center gap-3 rounded-control bg-raised p-3">
        <Film size={20} className="shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{media.originalName}</p>
          <p className="text-xs tabular-nums text-muted">
            {[media.durationSec ? formatDuration(media.durationSec) : '', media.width ? `${media.width}×${media.height}` : '', formatBytes(media.sizeBytes)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {media.conversionStatus === 'failed' ? (
          <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>Não foi possível ler</Tag>
        ) : isReady(media) ? (
          <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>Pronto</Tag>
        ) : (
          <Tag tone="warning">Analisando</Tag>
        )}
        <Button variant="ghost" onClick={() => onMedia(null)}>
          Trocar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (e.dataTransfer.files[0]) void start(e.dataTransfer.files[0])
        }}
        className={`flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-8 text-center ${drag ? 'border-brand bg-brand-soft' : error ? 'border-negative' : 'border-control'}`}
      >
        <Upload size={18} className="text-muted" aria-hidden />
        <p className="text-sm text-muted">Arraste o vídeo para cá ou</p>
        <Button type="button" onClick={() => input.current?.click()}>Escolher vídeo</Button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher vídeo"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void start(f)
          }}
        />
      </div>
      {library.length > 0 && (
        <Field label="Ou escolha um vídeo já enviado">
          {(id) => (
            <Select
              id={id}
              value=""
              onChange={(e) => {
                const m = library.find((x) => x.id === e.target.value)
                if (m) onMedia(m)
              }}
            >
              <option value="">Escolher da biblioteca</option>
              {library.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.originalName} · {formatBytes(m.sizeBytes)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {(failure || error) && (
        <p role="alert" className="flex items-center gap-1 text-xs text-negative">
          <AlertCircle size={14} aria-hidden /> {failure ?? error}
        </p>
      )}
    </div>
  )
}

type ThumbState = { media: MediaItem | null; preview?: string; name: string; size: number; error?: string; uploading?: boolean; width?: number; height?: number }

function ThumbnailPicker({ value, onChange }: { value: ThumbState | null; onChange: (t: ThumbState | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const pick = async (file: File) => {
    const ok = /^image\/(png|jpeg)$/.test(file.type)
    const preview = URL.createObjectURL(file)
    if (!ok) {
      onChange({ media: null, name: file.name, size: file.size, preview, error: 'A thumbnail precisa ser PNG ou JPG.' })
      return
    }
    if (file.size > THUMB_MAX_BYTES) {
      onChange({ media: null, name: file.name, size: file.size, preview, error: 'A thumbnail passa de 2 MB. Reduza o arquivo e envie de novo.' })
      return
    }
    const dims = await new Promise<{ width: number; height: number }>((res) => {
      const img = new window.Image()
      img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => res({ width: 0, height: 0 })
      img.src = preview
    })
    onChange({ media: null, name: file.name, size: file.size, preview, uploading: true, ...dims })
    try {
      const m = await sendFile(file, new AbortController().signal, () => {})
      onChange({ media: m, name: file.name, size: file.size, preview, ...dims })
    } catch (e) {
      onChange({ media: null, name: file.name, size: file.size, preview, error: errorInfo(e).message })
    }
  }
  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg"
      className="sr-only"
      tabIndex={-1}
      aria-label="Escolher thumbnail"
      onChange={(e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) void pick(f)
      }}
    />
  )
  if (!value) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-control p-4 text-sm text-muted">
        <ImageIcon size={18} aria-hidden /> Escolha uma imagem
        <Button type="button" onClick={() => input.current?.click()}>Escolher arquivo</Button>
        {fileInput}
      </div>
    )
  }
  const offRatio = value.width && value.height && Math.abs(value.width / value.height - 16 / 9) > 0.05
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-3 rounded-control p-3 ${value.error ? 'border border-negative' : 'bg-raised'}`}>
        <Thumb src={value.preview} className="w-28" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          <p className={`text-xs tabular-nums ${value.error ? 'text-negative' : 'text-muted'}`}>
            {value.uploading ? 'Enviando…' : value.error && value.size > THUMB_MAX_BYTES ? `${formatBytes(value.size)}, maior que o limite de 2 MB` : [value.width ? `${value.width}×${value.height}` : '', formatBytes(value.size)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button type="button" onClick={() => input.current?.click()}>Trocar</Button>
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          Remover
        </Button>
        {fileInput}
      </div>
      {value.error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-negative">
          <AlertCircle size={14} aria-hidden /> {value.error}
        </p>
      )}
      {offRatio && !value.error && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Info size={13} aria-hidden /> A imagem não está em 16:9. O YouTube pode cortar as bordas. O recomendado é 1280×720.
        </p>
      )}
    </div>
  )
}

export default function VideoEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const navigate = useNavigate()
  const toast = useToast()
  const { channels, loading: channelsLoading } = useYoutubeChannels()
  const usable = channels.filter((c) => c.status === 'connected')

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(editing ? 'loading' : 'ready')
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [quota, setQuota] = useState<YoutubeQuota | null>(null)
  const [channelId, setChannelId] = useState('')
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [format, setFormat] = useState<YoutubeFormat>('long')
  const [formatTouched, setFormatTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [thumb, setThumb] = useState<ThumbState | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [language, setLanguage] = useState('pt-BR')
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null)
  const [privacy, setPrivacy] = useState<YoutubePrivacy>('private')
  const [schedule, setSchedule] = useState(false)
  const [date, setDate] = useState(() => defaultWhen(tz).date)
  const [time, setTime] = useState(() => defaultWhen(tz).time)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [sending, setSending] = useState(false)
  const [dirty, setDirty] = useState(false)
  useBeforeUnload(dirty || sending)

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setDirty(true)
  }

  useEffect(() => {
    api.get<YoutubeQuota>('/youtube/quota').then((r) => setQuota(r.data)).catch(() => {})
    api.get<MediaItem[]>('/media?purpose=youtube&kind=video').then((r) => setLibrary(r.data.filter(isReady))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!channelId && usable.length) setChannelId(usable[0].channelId)
  }, [usable, channelId])

  // Edição de rascunho, fila ou envio que falhou antes de chegar ao YouTube.
  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      try {
        const { data: v } = await api.get<YoutubeVideo>(`/youtube/videos/${id}`)
        if (!alive) return
        if (!['draft', 'queued', 'failed'].includes(v.status) || v.youtubeVideoId) {
          navigate(`/videos/${id}`, { replace: true })
          return
        }
        const ids = [v.mediaId, v.thumbnailMediaId].filter(Boolean).join(',')
        const items = ids ? (await api.get<MediaItem[]>(`/media?purpose=youtube&ids=${ids}`)).data : []
        if (!alive) return
        setChannelId(v.channelId)
        setMedia(items.find((m) => m.id === v.mediaId) ?? null)
        const t = items.find((m) => m.id === v.thumbnailMediaId)
        if (t) setThumb({ media: t, name: t.originalName, size: t.sizeBytes, preview: t.url ? apiFileUrl(t.url) : undefined, width: t.width, height: t.height })
        if (v.format) {
          setFormat(v.format)
          setFormatTouched(true)
        }
        setTitle(v.title)
        setDescription(v.description ?? '')
        setTags(v.tags ?? [])
        setCategoryId(v.categoryId ?? '')
        setLanguage(v.language ?? 'pt-BR')
        setMadeForKids(v.madeForKids ?? null)
        setPrivacy(v.privacyStatus ?? 'private')
        if (v.publishAt) {
          const p = zonedParts(v.publishAt, tz)
          setSchedule(true)
          setDate(p.date)
          setTime(p.time)
        }
        setLoadState('ready')
      } catch {
        if (alive) setLoadState('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [id, navigate, tz])

  const onMedia = useCallback(
    (m: MediaItem | null) => {
      setMedia(m)
      setDirty(true)
      setErrors((e) => ({ ...e, mediaId: '' }))
      if (m && !formatTouched && isReady(m)) setFormat(suggest(m))
    },
    [formatTouched],
  )
  useMediaPoll(media, (m) => {
    setMedia(m)
    if (isReady(m) && !formatTouched) setFormat(suggest(m))
  })

  const channel = channels.find((c) => c.channelId === channelId)
  const selectedCategory = categoryId || channel?.defaultCategoryId || '22'
  const ready = Boolean(media && isReady(media))
  const shortTagged = format === 'short' && !/#shorts\b/i.test(description) ? (description ? `${description}\n\n#Shorts` : '#Shorts') : description
  const descBytes = byteLength(shortTagged)
  const publishAtIso = schedule && privacy === 'private' ? zonedToUtc(date, time, tz) : undefined
  const exhausted = Boolean(quota?.full)

  const validate = (publish: boolean) => {
    const e: Errors = {}
    if (!title.trim()) e.title = 'Escreva um título para o vídeo.'
    else if (title.length > TITLE_MAX) e.title = `O título passa de ${TITLE_MAX} caracteres.`
    else if (/[<>]/.test(title)) e.title = 'O título não pode ter < ou >.'
    if (descBytes > DESCRIPTION_MAX_BYTES) e.description = `A descrição passa de ${DESCRIPTION_MAX_BYTES} bytes.`
    else if (/[<>]/.test(description)) e.description = 'A descrição não pode ter < ou >.'
    if (tagsLength(tags) > TAGS_MAX_CHARS) e.tags = `As tags passam de ${TAGS_MAX_CHARS} caracteres.`
    if (thumb?.error) e.thumbnail = thumb.error
    if (thumb?.uploading) e.thumbnail = 'Aguarde o envio da thumbnail terminar.'
    if (publish) {
      if (!media) e.mediaId = 'Escolha o vídeo.'
      else if (!isReady(media)) e.mediaId = 'O vídeo ainda está sendo analisado. Aguarde um instante.'
      if (!channelId) e.channelId = 'Escolha o canal.'
      if (madeForKids === null) e.madeForKids = 'Informe se o conteúdo é para crianças.'
      if (publishAtIso && Date.parse(publishAtIso) <= Date.now()) e.publishAt = 'Escolha uma data futura.'
    }
    return e
  }

  const summary = (e: Errors) => {
    const names: Record<string, string> = {
      title: 'o título precisa de ajuste',
      description: 'a descrição precisa de ajuste',
      tags: 'as tags precisam de ajuste',
      thumbnail: 'há um problema na thumbnail',
      mediaId: 'falta escolher o vídeo',
      channelId: 'falta escolher o canal',
      madeForKids: 'falta informar se é para crianças',
      publishAt: 'a data de publicação já passou',
    }
    const list = Object.keys(e).filter((k) => e[k]).map((k) => names[k] ?? e[k])
    return `Não deu para continuar: ${list.join(', ')}.`
  }

  const save = async (action: 'draft' | 'publish') => {
    const e = validate(action === 'publish')
    setErrors(e)
    if (Object.values(e).some(Boolean)) {
      setFormError(summary(e))
      return
    }
    setFormError('')
    setSaving(action)
    const body = {
      action,
      channelId,
      mediaId: media?.id,
      thumbnailMediaId: thumb?.media?.id,
      format,
      title: title.trim(),
      description,
      tags,
      categoryId: selectedCategory,
      language,
      madeForKids: madeForKids ?? undefined,
      privacyStatus: privacy,
      publishAt: publishAtIso ?? (editing ? '' : undefined),
    }
    try {
      const r = editing ? await api.patch<YoutubeVideo>(`/youtube/videos/${id}`, body) : await api.post<YoutubeVideo>('/youtube/videos', body)
      setDirty(false)
      if (action === 'draft') {
        toast({ tone: 'success', text: 'Rascunho salvo.' })
        navigate('/videos')
      } else {
        toast({ tone: 'success', text: publishAtIso ? 'Vídeo enviado e agendado.' : 'Vídeo na fila para envio.' })
        navigate(`/videos/${r.data.id}`)
      }
    } catch (err) {
      const info = errorInfo(err)
      const fe: Errors = {}
      for (const [k, v] of Object.entries(info.fields)) fe[k === 'thumbnailMediaId' ? 'thumbnail' : k] = v
      if (/publishAt/.test(info.message)) fe.publishAt = 'Escolha uma data futura.'
      setErrors(fe)
      setFormError(Object.keys(fe).length ? summary(fe) : info.message)
      if (info.status === 429) api.get<YoutubeQuota>('/youtube/quota').then((r) => setQuota(r.data)).catch(() => {})
    } finally {
      setSaving(null)
    }
  }

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim()
    if (!t || tags.includes(t)) return
    setTags([...tags, t])
    setDirty(true)
  }

  const primaryLabel = schedule && privacy === 'private' ? `Agendar para ${shortDate(date)} às ${time}` : privacy === 'public' ? 'Publicar' : privacy === 'unlisted' ? 'Enviar não listado' : 'Enviar privado'
  const footerText = !ready
    ? 'Escolha o vídeo para continuar.'
    : formError
      ? 'Corrija os campos marcados para continuar.'
      : exhausted
        ? 'A cota diária do YouTube acabou. Salve como rascunho e envie depois.'
        : schedule && privacy === 'private'
          ? `Será enviado agora e publicado em ${date.split('-').reverse().join('/')} às ${time}.`
          : privacy === 'public'
            ? 'Será enviado e publicado agora.'
            : privacy === 'unlisted'
              ? 'Será enviado como não listado.'
              : 'Será enviado como privado.'

  const previewTitle = title || 'O título aparece aqui'
  const short = format === 'short'

  if (loadState === 'loading' || channelsLoading) {
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  }
  if (loadState === 'error') return <ErrorCard message="Não foi possível abrir este vídeo." onRetry={() => window.location.reload()} />
  if (!usable.length && !editing) {
    return (
      <div>
        <YoutubeReconnectBanners context="videos" />
        <PageHeader title="Novo vídeo" description="Envie um vídeo longo ou um Short para o YouTube." />
        <Card>
          <EmptyState text="Conecte um canal do YouTube para enviar vídeos." action={<Button variant="primary" onClick={() => navigate('/contas?aba=youtube')}>Ir para Contas</Button>} />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <YoutubeReconnectBanners context="videos" />
      <PageHeader title={editing ? 'Editar envio' : 'Novo vídeo'} description="Envie um vídeo longo ou um Short para o YouTube." />
      <FormError message={formError} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_384px]">
        <div className="flex flex-col gap-4">
          <Section title="Vídeo">
            <VideoPicker media={media} onMedia={onMedia} library={library} onSending={setSending} error={errors.mediaId} />
            {media && ready && (
              <>
                <div role="radiogroup" aria-label="Formato" className="flex flex-wrap gap-3">
                  <RadioCard name="formato" on={!short} title="Vídeo longo" hint="Horizontal, aparece no feed do canal" Icon={MonitorPlay} onSelect={() => (setFormat('long'), setFormatTouched(true), setDirty(true))} />
                  <RadioCard name="formato" on={short} title="Short" hint="Vertical, até 3 minutos" Icon={Smartphone} onSelect={() => (setFormat('short'), setFormatTouched(true), setDirty(true))} />
                </div>
                {!formatTouched && media.durationSec && media.width && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Info size={13} aria-hidden /> Detectamos {formatDuration(media.durationSec)} {media.width / (media.height ?? 1) <= 1 ? 'na vertical' : 'na horizontal'}, então marcamos {suggest(media) === 'short' ? 'Short' : 'vídeo longo'}. Você pode trocar.
                  </p>
                )}
              </>
            )}
          </Section>

          {ready && (
            <>
              <Section title="Detalhes">
                <Field label="Canal" error={errors.channelId}>
                  {(fid, d) => (
                    <Select id={fid} aria-describedby={d} value={channelId} onChange={(e) => touch(setChannelId)(e.target.value)}>
                      {(editing ? channels : usable).map((c) => (
                        <option key={c.id} value={c.channelId}>{c.title}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Título" error={errors.title}>
                  {(fid, d) => (
                    <div className="flex flex-col gap-1">
                      <Input id={fid} aria-describedby={d} aria-invalid={Boolean(errors.title) || undefined} value={title} placeholder="Título do vídeo" onChange={(e) => touch(setTitle)(e.target.value)} />
                      <div className="flex justify-end"><Counter n={title.length} max={TITLE_MAX} /></div>
                    </div>
                  )}
                </Field>
                <Field label="Descrição" error={errors.description} hint={short ? 'No Short, a hashtag #Shorts fica só na descrição: ela é acrescentada no fim, no envio.' : undefined}>
                  {(fid, d) => (
                    <div className="flex flex-col gap-1">
                      <Textarea id={fid} aria-describedby={d} aria-invalid={Boolean(errors.description) || undefined} className="min-h-36" value={description} onChange={(e) => touch(setDescription)(e.target.value)} />
                      <div className="flex justify-end"><Counter n={descBytes} max={DESCRIPTION_MAX_BYTES} unit=" bytes" /></div>
                    </div>
                  )}
                </Field>
                <Field label="Tags" error={errors.tags}>
                  {(fid, d) => (
                    <div className="flex flex-col gap-2">
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((t) => (
                            <Chip key={t} onRemove={() => (setTags(tags.filter((x) => x !== t)), setDirty(true))}>{t}</Chip>
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
                            addTag(tagInput)
                            setTagInput('')
                          }
                        }}
                        onBlur={() => {
                          addTag(tagInput)
                          setTagInput('')
                        }}
                      />
                      <div className="flex justify-end"><Counter n={tagsLength(tags)} max={TAGS_MAX_CHARS} unit=" caracteres" /></div>
                    </div>
                  )}
                </Field>
              </Section>

              <Section title="Thumbnail" hint={short ? 'Opcional em Shorts. O YouTube escolhe um quadro se você não enviar.' : 'PNG ou JPG até 2 MB. Recomendado 1280×720.'}>
                <ThumbnailPicker value={thumb} onChange={(t) => (setThumb(t), setDirty(true), setErrors((e) => ({ ...e, thumbnail: "" })))} />
              </Section>

              <Section title="Publicação">
                <div role="radiogroup" aria-label="Visibilidade" className="flex flex-wrap gap-3">
                  <RadioCard name="visibilidade" on={privacy === 'private'} title="Privado" hint="Só você vê, até a data agendada" onSelect={() => (setPrivacy('private'), setDirty(true))} />
                  <RadioCard name="visibilidade" on={privacy === 'unlisted'} title="Não listado" hint="Só quem tem o link" onSelect={() => (setPrivacy('unlisted'), setSchedule(false), setDirty(true))} />
                  <RadioCard name="visibilidade" on={privacy === 'public'} title="Público" hint="Aparece para todos" onSelect={() => (setPrivacy('public'), setSchedule(false), setDirty(true))} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-control bg-raised px-3 py-2">
                  <div>
                    <p className="font-medium">Agendar publicação</p>
                    <p className="text-xs text-muted">O YouTube publica sozinho na data. Só vale para vídeo privado.</p>
                  </div>
                  <Toggle checked={schedule && privacy === 'private'} disabled={privacy !== 'private'} label="Agendar publicação" onChange={(v) => (setSchedule(v), setDirty(true))} />
                </div>
                {schedule && privacy === 'private' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Data" error={errors.publishAt}>
                      {(fid, d) => <Input id={fid} type="date" aria-describedby={d} aria-invalid={Boolean(errors.publishAt) || undefined} value={date} onChange={(e) => touch(setDate)(e.target.value)} />}
                    </Field>
                    <Field label={`Hora (${tzLabel(tz)})`}>{(fid) => <Input id={fid} type="time" value={time} onChange={(e) => touch(setTime)(e.target.value)} />}</Field>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Categoria">
                    {(fid) => (
                      <Select id={fid} value={selectedCategory} onChange={(e) => touch(setCategoryId)(e.target.value)}>
                        {youtubeCategories.some((c) => c.id === selectedCategory) ? null : <option value={selectedCategory}>{categoryLabel(selectedCategory)}</option>}
                        {youtubeCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Idioma do vídeo">
                    {(fid) => (
                      <Select id={fid} value={language} onChange={(e) => touch(setLanguage)(e.target.value)}>
                        {youtubeLanguages.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Conteúdo para crianças</legend>
                  <div role="radiogroup" aria-label="Conteúdo para crianças" className="flex flex-wrap gap-3">
                    <RadioCard name="criancas" on={madeForKids === false} title="Não, não é para crianças" onSelect={() => (setMadeForKids(false), setDirty(true), setErrors((e) => ({ ...e, madeForKids: '' })))} />
                    <RadioCard name="criancas" on={madeForKids === true} title="Sim, é para crianças" onSelect={() => (setMadeForKids(true), setDirty(true), setErrors((e) => ({ ...e, madeForKids: '' })))} />
                  </div>
                  {errors.madeForKids && (
                    <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-negative">
                      <AlertCircle size={14} aria-hidden /> {errors.madeForKids}
                    </p>
                  )}
                </fieldset>
              </Section>
            </>
          )}
        </div>

        {ready && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-5">
              <h2 className="text-lg font-semibold">Prévia</h2>
              <p className="mt-1 text-sm text-muted">Como deve aparecer no YouTube.</p>
              <div className={`mt-4 ${short ? 'mx-auto w-44' : ''}`}>
                <Thumb src={thumb?.preview && !thumb.error ? thumb.preview : undefined} dur={formatDuration(media?.durationSec)} short={short} className="w-full" />
                <p className="mt-3 line-clamp-2 font-medium">{previewTitle}</p>
                <p className="text-xs text-muted">{channel?.title}</p>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
                <Info size={13} aria-hidden /> A miniatura final vem da thumbnail que você enviar.
              </p>
            </Card>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 md:-mx-8 md:px-8">
        <p className="text-sm text-muted" aria-live="polite">{footerText}</p>
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>*]:flex-1">
          <Button disabled={!title.trim() || sending} loading={saving === 'draft'} onClick={() => save('draft')}>Salvar rascunho</Button>
          <Button variant="primary" disabled={!ready || exhausted || sending} loading={saving === 'publish'} icon={schedule && privacy === 'private' ? <CalendarClock size={16} aria-hidden /> : <Send size={16} aria-hidden />} onClick={() => save('publish')}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
