import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/toast'
import {
  Button,
  Card,
  EmptyState,
  ErrorCard,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  Tag,
  Textarea,
  Toggle,
} from '../components/ui'
import { ForbiddenPage } from './ErrorPages'

type Automation = {
  id: string
  name: string
  telegramChat: string
  channelId: string
  format: 'short' | 'long'
  titleTemplate: string
  descriptionTemplate: string
  historyLimit: number
  active: boolean
  privacyStatus: string
  lastCheckedAt?: string
  lastError?: string
}
type Imported = {
  id: string
  messageId: number
  status: string
  title?: string
  error?: string
  videoId: string
  video?: { status: string; youtubeUrl?: string; lastError?: string }
}
const states: Record<string, string> = {
  downloading: 'Baixando',
  queued: 'Na fila',
  uploading: 'Enviando',
  published: 'Enviado',
  processing: 'Processando',
  scheduled: 'Agendado',
  skipped: 'Ignorado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}
const initial = {
  name: '',
  telegramChat: '',
  channelId: '',
  format: 'short',
  privacyStatus: 'private',
  titleTemplate: '{caption}',
  descriptionTemplate: '{caption}',
  historyLimit: 0,
  active: true,
}

export default function TelegramAutomationsPage() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <TelegramAutomations /> : <ForbiddenPage />
}
function TelegramAutomations() {
  const { data, loading, error, reload } = useFetch<Automation[]>('/telegram/automations')
  const { data: connection } = useFetch<{ configured: boolean }>('/telegram/status')
  const { channels } = useYoutubeChannels()
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      void reload()
      setRefresh((n) => n + 1)
    }, 15000)
    return () => clearInterval(timer)
  }, [reload])
  const {
    data: imported,
    loading: importsLoading,
    error: importsError,
  } = useFetch<Imported[]>(selected ? `/telegram/automations/${selected}/imports` : null, [refresh])
  const imports = imported ?? []
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFields({})
    try {
      if (editingId) await api.patch(`/telegram/automations/${editingId}`, form)
      else await api.post('/telegram/automations', form)
      setCreating(false)
      setEditingId(null)
      setForm(initial)
      await reload()
      toast({
        tone: 'success',
        text: editingId
          ? 'Automação atualizada. Os novos ajustes valem para as próximas importações.'
          : 'Automação criada. A primeira verificação acontece em até um minuto.',
      })
    } catch (err) {
      const info = errorInfo(err)
      setFields(info.fields)
      toast({ tone: 'error', text: info.message })
    } finally {
      setBusy(false)
    }
  }
  async function toggle(a: Automation) {
    setBusy(true)
    try {
      await api.patch(`/telegram/automations/${a.id}/active`, { active: !a.active })
      await reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
    }
  }
  const input = (key: 'name' | 'telegramChat' | 'titleTemplate', label: string, hint?: string) => (
    <Field label={label} hint={hint} error={fields[key]}>
      {(id, desc) => (
        <Input
          id={id}
          aria-describedby={desc}
          aria-invalid={!!fields[key]}
          required
          disabled={key === 'telegramChat' && !!editingId}
          value={form[key]}
          maxLength={key === 'telegramChat' ? 100 : 100}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </Field>
  )
  return (
    <div>
      <PageHeader
        title="Telegram → YouTube"
        description="Importe vídeos de um canal do Telegram e envie para o seu canal do YouTube."
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingId(null)
              setForm(initial)
              setFields({})
              setCreating(true)
            }}
          >
            Nova automação
          </Button>
        }
      />
      {connection && !connection.configured && (
        <Card className="mb-5 p-4">
          <p className="font-medium">Configure a conexão no servidor</p>
          <p className="mt-1 text-sm text-muted">
            A sessão do Telegram ainda não foi configurada. Você pode preparar as automações; as verificações começam após configurar e
            reiniciar a API.
          </p>
        </Card>
      )}
      {creating && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Editar automação' : 'Nova automação'}</h2>
          <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
            {input('name', 'Nome da automação')}
            {input('telegramChat', 'Canal do Telegram', 'Use @nomedocanal ou o ID -100… de um canal que a conta do servidor já acessa.')}
            <Field label="Canal do YouTube" error={fields.channelId}>
              {(id) => (
                <Select id={id} required value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
                  <option value="">Selecione um canal conectado</option>
                  {channels
                    .filter((c) => c.status === 'connected')
                    .map((c) => (
                      <option key={c.channelId} value={c.channelId}>
                        {c.title}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field
              label="Formato"
              hint="Shorts: vertical ou quadrado, até 3 minutos. Vídeos incompatíveis são ignorados; não há recorte automático."
            >
              {(id) => (
                <Select id={id} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="short">Short</option>
                  <option value="long">Vídeo longo</option>
                </Select>
              )}
            </Field>
            <Field
              label="Visibilidade"
              hint="Público publica automaticamente. Privado permite conferir os vídeos no YouTube antes de liberar."
            >
              {(id) => (
                <Select id={id} value={form.privacyStatus} onChange={(e) => setForm({ ...form, privacyStatus: e.target.value })}>
                  <option value="private">Privado</option>
                  <option value="unlisted">Não listado</option>
                  <option value="public">Público</option>
                </Select>
              )}
            </Field>
            <Field
              label="Histórico inicial"
              hint="Zero começa a acompanhar na primeira verificação. Um número de 1 a 100 examina as últimas mensagens, incluindo as que não contêm vídeos."
              error={fields.historyLimit}
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={100}
                  required
                  disabled={!!editingId}
                  value={form.historyLimit}
                  onChange={(e) => setForm({ ...form, historyLimit: Number(e.target.value) })}
                />
              )}
            </Field>
            {input(
              'titleTemplate',
              'Modelo do título',
              '{caption} usa a primeira linha da legenda; {id} usa o número da mensagem. Até 100 caracteres no título final.',
            )}
            <Field
              label="Modelo da descrição"
              hint="Use {caption} para a legenda completa e {id} para o número da mensagem."
              error={fields.descriptionTemplate}
            >
              {(id) => (
                <Textarea
                  id={id}
                  maxLength={4500}
                  value={form.descriptionTemplate}
                  onChange={(e) => setForm({ ...form, descriptionTemplate: e.target.value })}
                />
              )}
            </Field>
            <div className="md:col-span-2">
              <p className="mb-4 text-sm text-muted">
                A verificação acontece a cada minuto. A pausa interrompe novas importações; vídeos já na fila continuam na tela Vídeos.
              </p>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" loading={busy}>
                  {editingId ? 'Salvar alterações' : 'Criar automação'}
                </Button>
                <Button type="button" disabled={busy} onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}
      <Card>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : !data?.length ? (
          <EmptyState
            text="Nenhuma automação de vídeos criada"
            action={<Button onClick={() => setCreating(true)}>Criar primeira automação</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1 basis-56">
                  <button className="text-left font-medium hover:underline" onClick={() => setSelected(a.id)}>
                    {a.name}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="break-all">{a.telegramChat}</span>
                    <ArrowRight size={14} aria-hidden />
                    <span>{channels.find((c) => c.channelId === a.channelId)?.title ?? a.channelId}</span>
                  </div>
                  {a.lastError && <p className="mt-2 text-sm text-negative">{a.lastError}</p>}
                  <p className="mt-1 text-xs text-faint">
                    {a.lastCheckedAt
                      ? `Verificado em ${new Date(a.lastCheckedAt).toLocaleString('pt-BR')}`
                      : 'Aguardando primeira verificação'}
                  </p>
                </div>
                <Tag tone="neutral">
                  {a.format === 'short' ? 'Short' : 'Longo'} ·{' '}
                  {a.privacyStatus === 'public' ? 'Público' : a.privacyStatus === 'private' ? 'Privado' : 'Não listado'}
                </Tag>
                <Button
                  onClick={() => {
                    setEditingId(a.id)
                    setForm({
                      name: a.name,
                      telegramChat: a.telegramChat,
                      channelId: a.channelId,
                      format: a.format,
                      privacyStatus: a.privacyStatus,
                      titleTemplate: a.titleTemplate,
                      descriptionTemplate: a.descriptionTemplate,
                      historyLimit: a.historyLimit,
                      active: a.active,
                    })
                    setFields({})
                    setCreating(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Editar
                </Button>
                <Button
                  onClick={() => {
                    setSelected(a.id)
                  }}
                >
                  Histórico
                </Button>
                <span className="text-sm text-muted">{a.active ? 'Ativa' : 'Pausada'}</span>
                <Toggle checked={a.active} label={`${a.name} ativa`} disabled={busy} onChange={() => void toggle(a)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {selected && (
        <Card className="mt-6 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Importações · {data?.find((a) => a.id === selected)?.name}</h2>
            <Button onClick={() => setSelected(null)}>Fechar</Button>
          </div>
          {importsLoading ? (
            <SkeletonList />
          ) : importsError ? (
            <p role="alert" className="text-sm text-negative">
              {importsError}
            </p>
          ) : imports.length === 0 ? (
            <p className="text-sm text-muted">Nenhum vídeo encontrado nesta automação ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {imports.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="break-words text-sm">{i.title || `Mensagem ${i.messageId}`}</p>
                    {(i.error || i.video?.lastError) && <p className="mt-1 text-sm text-negative">{i.error || i.video?.lastError}</p>}
                  </div>
                  <span className="text-sm text-muted">{states[i.video?.status ?? i.status] ?? i.status}</span>
                  {i.video && (
                    <Link to={`/videos/${i.videoId}`} className="text-sm text-brand underline">
                      Ver envio
                    </Link>
                  )}
                  {i.video?.youtubeUrl && (
                    <a href={i.video.youtubeUrl} target="_blank" rel="noreferrer" className="text-sm text-brand underline">
                      YouTube
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
