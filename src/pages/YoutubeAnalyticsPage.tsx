import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFetch } from '../lib/useFetch'
import { apiUrl } from '../lib/api'
import type { YtAnalyticsOverview, YtChannelAnalytics } from '../lib/youtube'
import { Card, EmptyState, ErrorCard, PageHeader, Skeleton } from '../components/ui'
import { RetentionChart } from '../components/QuizMetricsPanel'

const nf = new Intl.NumberFormat('pt-BR')
const dur = (s: number | null | undefined) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`)
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(0)}%`)
const hours = (m: number | undefined) => (m == null ? '—' : `${nf.format(Math.round(m / 60))} h`)

function DailyChart({ daily }: { daily: YtChannelAnalytics['daily'] }) {
  if (!daily.length) return <p className="text-sm text-muted">Sem série diária ainda.</p>
  const max = Math.max(1, ...daily.map((d) => d.views))
  const w = 300 / daily.length
  return (
    <figure>
      <svg viewBox="0 0 300 80" className="h-28 w-full" role="img" aria-label="Visualizações por dia" preserveAspectRatio="none">
        {daily.map((d, i) => (
          <rect key={d.day} x={i * w + 0.5} width={Math.max(1, w - 1)} y={80 - (d.views / max) * 80} height={(d.views / max) * 80} className="fill-brand">
            <title>{`${d.day}: ${nf.format(d.views)} visualizações`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>{daily[0].day}</span>
        <span>Visualizações por dia (pico {nf.format(max)})</span>
        <span>{daily[daily.length - 1].day}</span>
      </figcaption>
    </figure>
  )
}

function ChannelDetail({ id }: { id: string }) {
  const { data, error, loading } = useFetch<YtChannelAnalytics>(`/youtube/analytics/channels/${id}`)
  const [open, setOpen] = useState<string | null>(null)
  if (error) return <ErrorCard message={error} />
  if (loading || !data) return <Skeleton className="h-48" />
  const t = data.totals
  return (
    <section aria-label={`Detalhes de ${data.channel.title}`} className="mt-6">
      <h2 className="mb-3 font-semibold">{data.channel.title} — últimos {data.windowDays} dias</h2>
      {!data.channel.analyticsScope && (
        <p className="mb-3 text-sm text-muted">
          Reconecte este canal para liberar retenção e tempo assistido.{' '}
          <a className="text-brand underline" href={apiUrl('/youtube/connect')}>Reconectar canal</a>
        </p>
      )}
      {t ? (
        <dl className="mb-4 grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4">
          {[
            ['Visualizações', nf.format(t.views)],
            ['Tempo assistido', hours(t.minutesWatched)],
            ['Retenção média', pct(t.avgViewPercentage)],
            ['Inscritos (líquido)', `${t.subscribersGained - t.subscribersLost >= 0 ? '+' : ''}${nf.format(t.subscribersGained - t.subscribersLost)}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-2xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mb-4 text-sm text-muted">Dados do Analytics ainda não disponíveis para este canal.</p>
      )}
      <DailyChart daily={data.daily} />
      <h3 className="mb-2 mt-6 font-semibold">Vídeos</h3>
      {!data.videos.length ? (
        <EmptyState text="Nenhum vídeo publicado nos últimos 90 dias foi medido ainda." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 pr-3 font-normal">Vídeo</th>
                <th className="py-2 pr-3 text-right font-normal">Visualizações</th>
                <th className="py-2 pr-3 text-right font-normal">Desde a última leitura</th>
                <th className="py-2 pr-3 text-right font-normal">Curtidas</th>
                <th className="py-2 pr-3 text-right font-normal">Retenção</th>
                <th className="py-2 pr-3 text-right font-normal">Tempo médio</th>
                <th className="py-2 text-right font-normal">Curva</th>
              </tr>
            </thead>
            <tbody>
              {data.videos.map((v) => (
                <Fragment key={v.id}>
                  <tr className="border-t border-border">
                    <td className="py-2 pr-3">
                      {v.title}
                      <span className="ml-2 text-xs text-muted">{new Date(v.publishedAt).toLocaleDateString('pt-BR')}</span>
                      {v.missing && <span className="ml-2 text-xs text-negative">não encontrado no canal</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nf.format(v.views)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{v.viewsDelta == null ? '—' : `${v.viewsDelta >= 0 ? '+' : ''}${nf.format(v.viewsDelta)}`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nf.format(v.likes)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(v.avgViewPercentage)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{dur(v.avgViewDurationSec)}</td>
                    <td className="py-2 text-right">
                      {v.hasRetention ? (
                        <button type="button" className="text-brand underline" aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>
                          {open === v.id ? 'Ocultar' : 'Ver'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {open === v.id && (
                    <tr>
                      <td colSpan={7} className="pb-4">
                        <RetentionChart url={`/youtube/analytics/videos/${v.id}/retention`} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function YoutubeAnalyticsPage() {
  const { data, error, loading } = useFetch<YtAnalyticsOverview>('/youtube/analytics')
  const [params, setParams] = useSearchParams()
  const selected = params.get('canal') ?? data?.channels[0]?.id
  return (
    <>
      <PageHeader title="Análises do YouTube" description="Todos os canais conectados, atualizados automaticamente." />
      {error ? (
        <ErrorCard message={error} />
      ) : loading || !data ? (
        <Skeleton className="h-40" />
      ) : !data.channels.length ? (
        <EmptyState text="Conecte um canal do YouTube para ver as análises." />
      ) : (
        <>
          {data.needsReconnect.length > 0 && (
            <p className="mb-4 text-sm text-muted">
              {data.needsReconnect.length === 1 ? '1 canal precisa' : `${data.needsReconnect.length} canais precisam`} ser reconectado para liberar retenção e tempo assistido.{' '}
              <a className="text-brand underline" href={apiUrl('/youtube/connect')}>Reconectar</a>
            </p>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Canais">
            {data.channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setParams({ canal: c.id })}
                  aria-pressed={selected === c.id}
                  className="w-full text-left"
                >
                  <Card className={`p-4 ${selected === c.id ? 'ring-2 ring-brand' : ''}`}>
                    <p className="font-semibold">{c.title}</p>
                    {c.handle && <p className="text-xs text-muted">{c.handle}</p>}
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted">Inscritos</dt>
                        <dd className="tabular-nums">{c.stats?.subscribers == null ? '—' : nf.format(c.stats.subscribers)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Visualizações ({c.windowDays} d)</dt>
                        <dd className="tabular-nums">{c.totals ? nf.format(c.totals.views) : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Retenção média</dt>
                        <dd className="tabular-nums">{pct(c.totals?.avgViewPercentage)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Tempo assistido</dt>
                        <dd className="tabular-nums">{hours(c.totals?.minutesWatched)}</dd>
                      </div>
                    </dl>
                    {!c.analyticsScope && <p className="mt-3 text-xs text-negative">Reconexão necessária para o Analytics</p>}
                    {c.analyticsScope && c.analyticsStatus === 'unavailable' && <p className="mt-3 text-xs text-muted">Analytics indisponível no momento</p>}
                  </Card>
                </button>
              </li>
            ))}
          </ul>
          {selected && <ChannelDetail key={selected} id={selected} />}
          <p className="mt-6 text-xs text-muted">Atualização a cada {data.intervalHours} h. Os dados do Analytics têm cerca de 2 dias de atraso.</p>
        </>
      )}
    </>
  )
}
