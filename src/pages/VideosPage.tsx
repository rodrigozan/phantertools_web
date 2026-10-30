import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Gauge, Plus, RotateCcw } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { formatDateTime } from '../lib/format'
import { formatReset, tzLabel } from '../lib/youtube'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import type { YoutubeQuota, YoutubeVideo } from '../lib/types'
import { Button, Card, EmptyState, ErrorCard, PageHeader, Select, Skeleton, Tag } from '../components/ui'
import { YoutubeReconnectBanners } from '../components/AccountBanners'
import { FormatTag, PlatformMark, Progress, Thumb, YtStatusTag, youtubeStatusLabels } from '../components/youtube'
import { useToast } from '../components/toast'

export function videoWhen(v: YoutubeVideo, tz: string) {
  switch (v.status) {
    case 'uploading': return `Enviando: ${Math.round(v.progress ?? 0)}%`
    case 'queued': return 'Na fila para envio'
    case 'processing': return 'Processando no YouTube'
    case 'scheduled': return v.publishAt ? `Publica em ${formatDateTime(v.publishAt, tz)}` : 'Agendado'
    case 'published': return formatDateTime(v.publishAt && Date.parse(v.publishAt) <= Date.now() ? v.publishAt : (v.uploadedAt ?? v.createdAt), tz)
    case 'failed': return v.lastError ?? 'O envio falhou'
    case 'cancelled': return 'Cancelado'
    default: return `Editado ${formatDateTime(v.updatedAt, tz)}`
  }
}

const periods = [
  { v: '30', l: 'Últimos 30 dias' },
  { v: '7', l: 'Últimos 7 dias' },
  { v: '', l: 'Todo o período' },
]

export function QuotaCard({ quota, tz }: { quota: YoutubeQuota; tz: string }) {
  const total = Math.max(quota.uploadsUsed + quota.remainingUploads, 1)
  return (
    <Card className="mb-4 flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <Gauge size={16} aria-hidden /> Envios de hoje: <span className="tabular-nums">{quota.uploadsUsed} de {total}</span>
        </p>
        {quota.full ? (
          <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>Cota esgotada</Tag>
        ) : quota.near ? (
          <Tag tone="warning" icon={<AlertTriangle size={12} aria-hidden />}>Perto do limite</Tag>
        ) : null}
      </div>
      <Progress pct={(quota.uploadsUsed / total) * 100} label="Envios usados hoje" />
      <p className="text-xs text-muted">
        {quota.full
          ? `O YouTube libera mais envios às ${formatReset(quota.resetsAt, tz)} (${tzLabel(tz)}). Vídeos que você criar agora ficam na fila e saem depois.`
          : `O limite diário do YouTube renova às ${formatReset(quota.resetsAt, tz)} (${tzLabel(tz)}). Cada envio usa uma parte da cota da API.`}
      </p>
    </Card>
  )
}

export default function VideosPage() {
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const navigate = useNavigate()
  const toast = useToast()
  const { channels } = useYoutubeChannels()
  const [channelId, setChannelId] = useState('')
  const [status, setStatus] = useState('')
  const [format, setFormat] = useState('')
  const [period, setPeriod] = useState('30')
  const [retrying, setRetrying] = useState<string | null>(null)

  const url = useMemo(() => {
    const q = new URLSearchParams()
    if (channelId) q.set('channelId', channelId)
    if (status) q.set('status', status)
    if (format) q.set('format', format)
    if (period) q.set('from', new Date(Date.now() - Number(period) * 86_400_000).toISOString())
    return `/youtube/videos?${q}`
  }, [channelId, status, format, period])

  const list = useFetch<YoutubeVideo[]>(url)
  const quota = useFetch<YoutubeQuota>('/youtube/quota')
  const { setData, reload: reloadList } = list
  const { reload: reloadQuota } = quota

  // O envio roda no servidor: a tela só observa, a cada 3 s enquanto houver vídeo em andamento.
  const open = (list.data ?? []).some((v) => ['queued', 'uploading', 'processing'].includes(v.status))
  useEffect(() => {
    if (!open) return
    const t = setInterval(async () => {
      try {
        const r = await api.get<YoutubeVideo[]>(url)
        setData(r.data)
      } catch {
        return
      }
    }, 3000)
    return () => clearInterval(t)
  }, [open, url, setData])

  const retry = useCallback(
    async (v: YoutubeVideo) => {
      setRetrying(v.id)
      try {
        await api.post(`/youtube/videos/${v.id}/retry`)
        toast({ tone: 'success', text: 'Envio recolocado na fila.' })
      } catch (e) {
        toast({ tone: 'error', text: errorInfo(e).message })
      } finally {
        setRetrying(null)
        reloadList()
        reloadQuota()
      }
    },
    [toast, reloadList, reloadQuota],
  )

  const items = list.data ?? []
  const filtered = Boolean(channelId || status || format)
  const exhausted = Boolean(quota.data?.full)
  const newButton = (
    <Button variant="primary" disabled={exhausted} icon={<Plus size={16} aria-hidden />} onClick={() => navigate('/videos/novo')}>
      Novo vídeo
    </Button>
  )

  return (
    <div>
      <YoutubeReconnectBanners context="videos" />
      <PageHeader title="Vídeos" description="Envios para o YouTube." actions={exhausted ? <span title={`Cota esgotada até as ${formatReset(quota.data!.resetsAt, tz)}`}>{newButton}</span> : newButton} />
      {list.loading && !list.data ? (
        <>
          <Skeleton className="mb-4 h-24 w-full" />
          <Card>
            <div role="status" aria-label="Carregando" className="flex flex-col gap-4 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-[54px] w-24 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : list.error ? (
        <ErrorCard message={list.error} onRetry={reloadList} />
      ) : items.length === 0 && !filtered && !period ? (
        <Card>
          <EmptyState text="Nenhum vídeo enviado ainda." action={newButton} />
        </Card>
      ) : (
        <>
          {quota.data && <QuotaCard quota={quota.data} tz={tz} />}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select aria-label="Canal" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Todos os canais</option>
              {channels.map((c) => (
                <option key={c.id} value={c.channelId}>{c.title}</option>
              ))}
            </Select>
            <Select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas as situações</option>
              {Object.entries(youtubeStatusLabels).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
            <Select aria-label="Formato" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Longo e Short</option>
              <option value="long">Só vídeos longos</option>
              <option value="short">Só Shorts</option>
            </Select>
            <Select aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => (
                <option key={p.v} value={p.v}>{p.l}</option>
              ))}
            </Select>
          </div>
          <Card>
            {items.length === 0 ? (
              <EmptyState
                text={filtered ? 'Nenhum vídeo com esses filtros.' : 'Nenhum vídeo neste período.'}
                action={!filtered && period ? <Button onClick={() => setPeriod('')}>Ver todo o período</Button> : undefined}
              />
            ) : (
              <ul>
                {items.map((v) => (
                  <li key={v.id} className="flex items-center gap-4 px-5 py-3 max-md:flex-wrap max-md:gap-3 md:min-h-[72px] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
                    <Link to={`/videos/${v.id}`} className="flex min-w-0 flex-1 items-center gap-4 max-md:basis-40">
                      <Thumb src={v.thumbnailUrl} className="w-24 max-md:w-20" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block font-medium">{v.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <PlatformMark p="youtube" text={false} />
                          {v.channelTitle}
                          <FormatTag f={v.format} />
                          <span className="tabular-nums">{videoWhen(v, tz)}</span>
                        </span>
                      </span>
                    </Link>
                    <div className="flex items-center gap-2 max-md:w-full">
                      <YtStatusTag s={v.status} />
                      {v.status === 'failed' && !v.youtubeVideoId && (
                        <Button loading={retrying === v.id} icon={<RotateCcw size={14} aria-hidden />} onClick={() => retry(v)}>
                          Tentar de novo
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
