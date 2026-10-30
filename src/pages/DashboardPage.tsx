import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Clapperboard, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccounts } from '../lib/accounts'
import { useNotifications } from '../lib/notifications'
import { useFetch } from '../lib/useFetch'
import { formatDateTime, zonedParts, zonedToUtc } from '../lib/format'
import { useYoutubeChannels, youtubeConnectUrl } from '../lib/youtubeChannels'
import type { Post, YoutubeVideo } from '../lib/types'
import { Button, Card, EmptyState, ErrorCard, PageHeader, PostStatusTag, Skeleton } from '../components/ui'
import { ReconnectBanners, YoutubeReconnectBanners } from '../components/AccountBanners'
import { PlatformMark, YtStatusTag } from '../components/youtube'
import { WeekCalendar, addDays, startOfWeek, videoDate } from '../components/WeekCalendar'
import { ConnectButton } from './AccountsPage'
import { NotificationRow, useNotificationActions } from './NotificationsPage'

type Dashboard = {
  stats: { weekPosts: number; next24h: number; failed: number; connectedAccounts: number; accountsNeedingReconnect: number; unreadNotifications: number }
  upcoming: Post[]
}

type Net = 'all' | 'instagram' | 'youtube' | 'facebook'
const nets: { id: Net; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'facebook', label: 'Facebook' },
]

const typeLabel = { post: 'Post', reel: 'Reel', carousel: 'Carrossel' }
const onInstagram = (p: Post) => p.destination !== 'facebook'
const onFacebook = (p: Post) => p.destination === 'facebook' || p.destination === 'both'
const countedVideo = (v: YoutubeVideo) => ['scheduled', 'published', 'uploading', 'processing', 'queued', 'failed'].includes(v.status)

function Stat({ label, value, detail, danger }: { label: string; value: number; detail?: string; danger?: boolean }) {
  return (
    <div className="bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-medium tabular-nums ${danger && value ? 'text-negative' : ''}`}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-faint">{detail}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const navigate = useNavigate()
  const { accounts, loading: accLoading } = useAccounts()
  const { channels, loading: chLoading } = useYoutubeChannels()
  const { items: notifications } = useNotifications()
  const { read } = useNotificationActions()
  const dash = useFetch<Dashboard>('/dashboard')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(zonedParts(new Date(), tz).date))
  const [net, setNet] = useState<Net>('all')
  const weekFrom = zonedToUtc(weekStart, '00:00', tz)
  const weekTo = zonedToUtc(addDays(weekStart, 7), '00:00', tz)
  const week = useFetch<Post[]>(`/posts?from=${encodeURIComponent(weekFrom)}&to=${encodeURIComponent(weekTo)}&status=draft,scheduled,publishing,published,failed`)
  const yt = useFetch<YoutubeVideo[]>('/youtube/videos?limit=200')
  const pages = useFetch<{ pageId: string }[]>('/publishing/facebook-pages')

  const weekVideos = useMemo(
    () => (yt.data ?? []).filter((v) => countedVideo(v) && videoDate(v) >= weekFrom && videoDate(v) < weekTo),
    [yt.data, weekFrom, weekTo],
  )
  const weekPosts = week.data ?? []
  const shownPosts = net === 'all' ? weekPosts : net === 'instagram' ? weekPosts.filter(onInstagram) : net === 'facebook' ? weekPosts.filter(onFacebook) : []
  const shownVideos = net === 'all' || net === 'youtube' ? weekVideos : []

  const now = Date.now()
  const nextVideos = (yt.data ?? [])
    .filter((v) => v.status === 'scheduled' && v.publishAt && Date.parse(v.publishAt) >= now - 3600_000)
    .sort((a, b) => a.publishAt!.localeCompare(b.publishAt!))
  const next24Videos = nextVideos.filter((v) => Date.parse(v.publishAt!) < now + 86_400_000).length
  const failedVideos = (yt.data ?? []).filter((v) => v.status === 'failed').length
  const upcoming = [
    ...(dash.data?.upcoming ?? []).map((p) => ({ key: `p${p.id}`, at: p.scheduledAt, post: p, video: undefined as YoutubeVideo | undefined })),
    ...nextVideos.map((v) => ({ key: `v${v.id}`, at: v.publishAt!, post: undefined as Post | undefined, video: v })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8)

  const noAccounts = !accLoading && !chLoading && accounts.length === 0 && channels.length === 0
  const unread = notifications.filter((n) => !n.readAt).slice(0, 5)
  const igConnected = accounts.filter((a) => a.status === 'connected').length
  const ytConnected = channels.filter((c) => c.status === 'connected').length
  const fbPages = pages.data?.length ?? 0
  const statsLoading = dash.loading || !dash.data || yt.loading || week.loading

  const countsWeek = `Instagram ${weekPosts.filter(onInstagram).length} · YouTube ${weekVideos.length} · Facebook ${weekPosts.filter(onFacebook).length}`

  return (
    <div>
      <PageHeader
        title="Painel"
        actions={
          <>
            <Button icon={<Clapperboard size={16} aria-hidden />} onClick={() => navigate('/videos/novo')}>
              Novo vídeo
            </Button>
            <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => navigate('/publicacoes/nova')}>
              Nova publicação
            </Button>
          </>
        }
      />
      <ReconnectBanners />
      <YoutubeReconnectBanners />

      {noAccounts && (
        <Card className="mb-4 flex flex-col items-start gap-3 p-5">
          <Camera size={20} className="text-brand" aria-hidden />
          <h2 className="text-lg font-semibold">Conecte suas redes</h2>
          <p className="text-muted">Conecte uma conta profissional do Instagram (Creator ou Business) ou um canal do YouTube para agendar publicações.</p>
          <div className="flex flex-wrap gap-2">
            <ConnectButton label="Conectar Instagram" />
            <a href={youtubeConnectUrl} className="inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control border border-control px-3.5 text-sm font-medium text-ink hover:bg-raised">
              <Clapperboard size={16} aria-hidden /> Conectar YouTube
            </a>
          </div>
        </Card>
      )}

      {dash.error ? (
        <div className="mb-4">
          <ErrorCard onRetry={dash.reload} />
        </div>
      ) : (
        <Card className="mb-4 grid grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-7 w-12" />
              </div>
            ))
          ) : (
            <>
              <Stat label="Publicações da semana" value={dash.data!.stats.weekPosts + weekVideos.length} detail={countsWeek} />
              <Stat label="Próximas 24 horas" value={dash.data!.stats.next24h + next24Videos} detail={`Instagram e Facebook ${dash.data!.stats.next24h} · YouTube ${next24Videos}`} />
              <Stat label="Falhas" value={dash.data!.stats.failed + failedVideos} detail="Veja em Avisos" danger />
              <Stat label="Contas conectadas" value={igConnected + ytConnected + fbPages} detail={`Instagram ${igConnected} · YouTube ${ytConnected} · Facebook ${fbPages}`} />
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_384px]">
        <Card className="min-w-0 self-start">
          {week.error ? (
            <div className="p-5">
              <ErrorCard onRetry={week.reload} />
            </div>
          ) : week.loading && !week.data ? (
            <div className="p-5">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <WeekCalendar
              weekStart={weekStart}
              onChange={setWeekStart}
              posts={shownPosts}
              videos={shownVideos}
              accounts={accounts}
              timeZone={tz}
              extra={
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por rede">
                  {nets.map((n) => (
                    <button
                      type="button"
                      key={n.id}
                      aria-pressed={net === n.id}
                      onClick={() => setNet(n.id)}
                      className={`inline-flex h-8 items-center rounded-full px-3 text-sm max-md:min-h-11 ${net === n.id ? 'bg-tag-brand-bg font-medium text-tag-brand-text' : 'bg-raised text-muted hover:text-ink'}`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              }
            />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">Próximas publicações</h2>
              <Link to="/publicacoes" className="text-sm font-medium text-brand underline">
                Ver todas
              </Link>
            </div>
            {dash.loading || yt.loading ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !upcoming.length ? (
              <EmptyState
                text="Nenhuma publicação agendada"
                action={
                  <Button variant="primary" onClick={() => navigate('/publicacoes/nova')}>
                    Nova publicação
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((u) => (
                  <li key={u.key}>
                    {u.post ? (
                      <Link to={`/publicacoes/${u.post.id}`} className="flex min-h-[45px] items-center gap-3 px-5 py-2 hover:bg-raised">
                        <span className="w-24 text-sm font-medium tabular-nums">{formatDateTime(u.post.scheduledAt, tz)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted">
                          {typeLabel[u.post.type]} · @{accounts.find((a) => a.id === u.post!.accountId)?.username ?? '—'}
                        </span>
                        <PostStatusTag status={u.post.status} />
                      </Link>
                    ) : (
                      <Link to={`/videos/${u.video!.id}`} className="flex min-h-[45px] items-center gap-3 px-5 py-2 hover:bg-raised">
                        <span className="w-24 text-sm font-medium tabular-nums">{formatDateTime(u.video!.publishAt!, tz)}</span>
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted">
                          <PlatformMark p="youtube" text={false} />
                          <span className="truncate">{u.video!.title}</span>
                        </span>
                        <YtStatusTag s={u.video!.status} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">Avisos</h2>
              <Link to="/avisos" className="text-sm font-medium text-brand underline">
                Ver todos
              </Link>
            </div>
            {unread.length === 0 ? (
              <EmptyState text="Nenhum aviso" />
            ) : (
              <ul className="divide-y divide-border">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={() => read(n)} compact />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
