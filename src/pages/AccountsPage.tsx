import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Camera, CheckCircle2, Clapperboard, Music2, Plus, Users } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { connectUrl, useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/format'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, FormError, PageHeader, SkeletonList, Tag } from '../components/ui'
import { ReconnectBanners, YoutubeReconnectBanners } from '../components/AccountBanners'
import { Tabs, type TabItem } from '../components/youtube'
import { useYoutubeChannels, youtubeConnectUrl } from '../lib/youtubeChannels'
import { apiUrl } from '../lib/api'
import { useToast } from '../components/toast'
import type { Account, YoutubeChannel } from '../lib/types'
import { categoryLabel } from '../lib/youtube'

const connectErrors: Record<string, string> = {
  cancelado: 'A conexão foi cancelada no Instagram.',
  nao_profissional: 'A conta precisa ser profissional (Creator ou Business).',
  outra_pessoa: 'Esta conta do Instagram já está conectada a outro usuário.',
  falha: 'Não foi possível conectar. Tente de novo.',
}

export function ConnectButton({ label = 'Conectar conta', primary = true }: { label?: string; primary?: boolean }) {
  return (
    <a
      href={connectUrl}
      className={`inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control px-3.5 text-sm font-medium ${
        primary ? 'bg-primary text-on-primary hover:opacity-90' : 'border border-control text-ink hover:bg-raised'
      }`}
    >
      <Camera size={16} aria-hidden /> {label}
    </a>
  )
}

function InstagramTab() {
  const { accounts, loading, error, reload } = useAccounts()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const [removing, setRemoving] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const connected = params.get('conectada')
  const err = params.get('erro')

  useEffect(() => {
    if (connected) {
      toast({ tone: 'success', text: `@${connected} conectado.` })
      reload()
      setParams({ aba: 'instagram' }, { replace: true })
    }
  }, [connected, reload, setParams, toast])

  const disconnect = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.delete(`/instagram/accounts/${removing.id}`)
      toast({ tone: 'success', text: `@${removing.username} desconectado.` })
      await reload()
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      {err && <FormError message={connectErrors[err] ?? connectErrors.falha} />}
      <ReconnectBanners />
      <Card>
        {loading ? (
          <SkeletonList rows={2} />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState text="Nenhuma conta conectada" action={<ConnectButton />} />
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex min-h-[72px] flex-wrap items-center gap-3 px-5 py-3">
                {a.profilePictureUrl ? (
                  <img src={a.profilePictureUrl} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised">
                    <Camera size={16} aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">@{a.username}</p>
                  <p className="text-xs text-faint">
                    {a.accountType === 'BUSINESS' ? 'Business' : 'Creator'} · conectada em {formatDate(a.connectedAt, user?.timezone ?? 'UTC')} ·{' '}
                    <span className="tabular-nums">
                      {a.usage.used}/{a.usage.limit}
                    </span>{' '}
                    publicações em 24 h
                  </p>
                </div>
                {a.status === 'connected' ? (
                  <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>
                    Conectada
                  </Tag>
                ) : (
                  <Tag tone="warning">Precisa reconectar</Tag>
                )}
                <div className="flex gap-2">
                  {a.status !== 'connected' && <ConnectButton label="Reconectar" primary={false} />}
                  <Button variant="danger" onClick={() => setRemoving(a)}>
                    Desconectar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Desconectar @${removing?.username ?? ''}?`}
        message="As publicações pendentes desta conta serão canceladas e as automações desativadas. O histórico fica."
        confirmLabel="Desconectar"
        danger
        loading={busy}
        onClose={() => setRemoving(null)}
        onConfirm={disconnect}
      />
    </div>
  )
}

const youtubeErrors: Record<string, string> = {
  cancelado: 'A conexão foi cancelada no Google.',
  sem_token: 'O Google não liberou o acesso permanente. Tente de novo e aceite todas as permissões.',
  outra_pessoa: 'Este canal já está conectado a outro usuário.',
  falha: 'Não foi possível conectar o canal. Tente de novo.',
}

function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full" referrerPolicy="no-referrer" />
  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-raised font-medium text-ink" aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

const rowCls = 'flex flex-wrap items-center gap-3 px-5 py-3 max-md:py-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border'

function YoutubeConnect({ label = 'Conectar canal', primary = true }: { label?: string; primary?: boolean }) {
  return (
    <a
      href={youtubeConnectUrl}
      className={`inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control px-3.5 text-sm font-medium ${primary ? 'bg-primary text-on-primary hover:opacity-90' : 'border border-control text-ink hover:bg-raised'}`}
    >
      {primary && <Plus size={16} aria-hidden />} {label}
    </a>
  )
}

function YoutubeTab() {
  const { channels, loading, error, reload } = useYoutubeChannels()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const [removing, setRemoving] = useState<YoutubeChannel | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const connected = params.get('conectada')
  const err = params.get('erro')

  useEffect(() => {
    if (connected) {
      toast({ tone: 'success', text: `Canal ${connected} conectado.` })
      reload()
      setParams({ aba: 'youtube' }, { replace: true })
    }
  }, [connected, reload, setParams, toast])

  const check = async (c: YoutubeChannel) => {
    setChecking(c.id)
    try {
      await api.post(`/youtube/channels/${c.id}/check`)
      toast({ tone: 'success', text: `A conexão com ${c.title} está funcionando.` })
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setChecking(null)
      await reload()
    }
  }

  const disconnect = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.delete(`/youtube/channels/${removing.id}`)
      toast({ tone: 'success', text: `${removing.title} desconectado.` })
      await reload()
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      {err && <FormError message={youtubeErrors[err] ?? youtubeErrors.falha} />}
      <YoutubeReconnectBanners />
      {loading ? (
        <Card>
          <SkeletonList rows={2} />
        </Card>
      ) : error ? (
        <ErrorCard onRetry={reload} />
      ) : channels.length === 0 ? (
        <Card>
          <EmptyState text="Nenhum canal do YouTube conectado." action={<YoutubeConnect />} />
        </Card>
      ) : (
        <>
          <Card>
            <ul>
              {channels.map((c) => {
                const ok = c.status === 'connected'
                return (
                  <li key={c.id} className={rowCls}>
                    <Avatar name={c.title} src={c.thumbnailUrl} />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted">
                        {c.handle ? `${c.handle} · ` : ''}Categoria padrão: {categoryLabel(c.defaultCategoryId)} · Conectado em {formatDate(c.connectedAt, user?.timezone ?? 'UTC')}
                      </p>
                    </div>
                    {ok ? (
                      <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>
                        Conectado
                      </Tag>
                    ) : (
                      <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>
                        Reconectar
                      </Tag>
                    )}
                    <div className="flex gap-2">
                      {ok ? (
                        <Button loading={checking === c.id} onClick={() => check(c)}>
                          Verificar conexão
                        </Button>
                      ) : (
                        <YoutubeConnect label="Reconectar" />
                      )}
                      <Button variant="danger" onClick={() => setRemoving(c)}>
                        Desconectar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
          <p className="mt-3 text-xs text-faint">
            O Phanter Tools pede ao Google permissão para enviar vídeos e editar título, descrição, tags e thumbnail. Você pode revogar a qualquer momento em myaccount.google.com.
          </p>
        </>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Desconectar ${removing?.title ?? ''}?`}
        message="Os vídeos em rascunho ou na fila deste canal serão cancelados. Os vídeos já enviados continuam no YouTube."
        confirmLabel="Desconectar"
        danger
        loading={busy}
        onClose={() => setRemoving(null)}
        onConfirm={disconnect}
      />
    </div>
  )
}

type FbPage = { pageId: string; name: string }

function FacebookTab() {
  const [state, setState] = useState<{ pages: FbPage[]; loading: boolean; error: boolean }>({ pages: [], loading: true, error: false })
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: false }))
    api
      .get<FbPage[]>('/publishing/facebook-pages')
      .then((r) => setState({ pages: r.data, loading: false, error: false }))
      .catch(() => setState({ pages: [], loading: false, error: true }))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])
  const connect = (
    <a href={apiUrl('/analysis/facebook/connect')} className="inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control bg-primary px-3.5 text-sm font-medium text-on-primary hover:opacity-90">
      <Plus size={16} aria-hidden /> Conectar Facebook
    </a>
  )
  if (state.loading)
    return (
      <Card>
        <SkeletonList rows={2} />
      </Card>
    )
  if (state.error) return <ErrorCard onRetry={load} />
  return (
    <Card>
      {state.pages.length === 0 ? (
        <EmptyState text="Nenhuma página do Facebook conectada." action={connect} />
      ) : (
        <ul>
          {state.pages.map((p) => (
            <li key={p.pageId} className={rowCls}>
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted">Página conectada pelo login do Facebook</p>
              </div>
              <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>
                Conectada
              </Tag>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function TikTokTab() {
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <div className="flex items-center gap-2">
        <Music2 size={18} aria-hidden />
        <h2 className="text-lg font-semibold">TikTok chega em breve</h2>
        <Tag tone="neutral">Em breve</Tag>
      </div>
      <p className="max-w-xl text-muted">Você vai poder conectar sua conta e agendar vídeos curtos junto com Instagram, Facebook e YouTube. Avisaremos aqui quando estiver disponível.</p>
      <span title="Disponível em breve">
        <Button disabled icon={<Plus size={16} aria-hidden />} aria-describedby="tiktok-motivo">
          Conectar conta
        </Button>
      </span>
      <p id="tiktok-motivo" className="text-xs text-faint">
        Ainda não dá para conectar: a integração com o TikTok está em preparação.
      </p>
    </Card>
  )
}

const tabs: TabItem[] = [
  { id: 'youtube', label: 'YouTube', Icon: Clapperboard },
  { id: 'instagram', label: 'Instagram', Icon: Camera },
  { id: 'facebook', label: 'Facebook', Icon: Users },
  { id: 'tiktok', label: 'TikTok', Icon: Music2, soon: true },
]

export default function AccountsPage() {
  const [params, setParams] = useSearchParams()
  const { channels } = useYoutubeChannels()
  const requested = params.get('aba')
  const tab = tabs.some((t) => t.id === requested) ? (requested as string) : 'youtube'
  const change = (id: string) => setParams({ aba: id }, { replace: true })
  const action =
    tab === 'youtube' ? (channels.length > 0 ? <YoutubeConnect /> : undefined) : tab === 'instagram' ? <ConnectButton label="Conectar conta" /> : undefined
  return (
    <div>
      <PageHeader title="Contas" description="Conecte as redes onde você publica." actions={action} />
      <Tabs items={tabs} active={tab} onChange={change} />
      <div role="tabpanel" id="aba-painel" aria-labelledby={`aba-${tab}`}>
        {tab === 'youtube' ? <YoutubeTab /> : tab === 'instagram' ? <InstagramTab /> : tab === 'facebook' ? <FacebookTab /> : <TikTokTab />}
      </div>
    </div>
  )
}


