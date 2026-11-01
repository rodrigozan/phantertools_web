import { useEffect, useState, type FormEvent } from 'react'
import { Download, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useAccounts } from '../lib/accounts'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/toast'
import { Button, Card, EmptyState, ErrorCard, Field, Input, PageHeader, Select, SkeletonList, Tag, Textarea, Toggle } from '../components/ui'
import { ForbiddenPage } from './ErrorPages'

const TZ = 'America/Sao_Paulo'

type Automation = {
  id: string
  name: string
  sources: string[]
  channelId: string
  instagramAccountId?: string
  slotTimes: string[]
  runTime: string
  musicVolumePct: number
  active: boolean
  lastPlannedWeek?: string
  lastRunAt?: string
  lastError?: string
}
type Status = {
  telegramConfigured: boolean
  audioToolsReady: boolean
  musicCount: number
  musicDir: string
  nextWeekStart: string
}
type Item = {
  id: string
  messageId: number
  telegramChat: string
  caption?: string
  status: string
  error?: string
  title?: string
  slotAt?: string
  musicFile?: string
  updatedAt: string
  youtube?: { status: string; progress?: number; url?: string; error?: string }
  instagram?: { status: string; permalink?: string; error?: string }
}
type Week = { week: string; weeks: string[]; slots: string[]; items: Item[] }

type Tone = 'success' | 'error' | 'warning' | 'neutral' | 'brand'
const stages: Record<string, [string, Tone]> = {
  queued: ['Na fila', 'neutral'],
  downloading: ['Baixando do Telegram', 'warning'],
  separating: ['Separando voz e música', 'warning'],
  mixing: ['Misturando a música', 'warning'],
  transcribing: ['Transcrevendo a fala', 'warning'],
  analyzing: ['Codex criando o título', 'warning'],
  scheduling: ['Agendando', 'warning'],
  scheduled: ['Agendado', 'brand'],
  uploading: ['Enviando ao YouTube', 'warning'],
  published: ['Publicado', 'success'],
  publish_failed: ['Falha ao publicar', 'error'],
  failed: ['Falhou', 'error'],
  skipped: ['Ignorado', 'neutral'],
}
const ytLabels: Record<string, string> = {
  queued: 'na fila', uploading: 'enviando', processing: 'processando', scheduled: 'agendado', published: 'publicado', failed: 'falhou', cancelled: 'cancelado',
}
const igLabels: Record<string, string> = {
  scheduled: 'agendado', publishing: 'publicando', published: 'publicado', failed: 'falhou', cancelled: 'cancelado', draft: 'rascunho',
}

function StatusTag({ status }: { status: string }) {
  const [label, tone] = stages[status] ?? [status, 'neutral' as Tone]
  return <Tag tone={tone}>{label}</Tag>
}
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })
const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const weekLabel = (w: string) => `Semana de ${w.split('-').reverse().slice(0, 2).join('/')}`

const emptyForm = { name: 'Semana automática', sources: '', channelId: '', instagramAccountId: '', slotTimes: ['08:00', '12:00', '20:00'], runTime: '06:00', musicVolumePct: 18, active: true }

export default function WeeklyPage() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Weekly /> : <ForbiddenPage />
}

function Weekly() {
  const toast = useToast()
  const { channels } = useYoutubeChannels()
  const { accounts } = useAccounts()
  const status = useFetch<Status>('/weekly/status')
  const autos = useFetch<Automation[]>('/weekly/automations')
  const automation = autos.data?.[0]
  const [week, setWeek] = useState<string | undefined>()
  const weekData = useFetch<Week>(automation ? `/weekly/automations/${automation.id}/week${week ? `?week=${week}` : ''}` : null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const reloadWeek = weekData.reload
  const reloadStatus = status.reload
  const reloadAutos = autos.reload

  // O status de cada vídeo precisa estar sempre atualizado na tela.
  useEffect(() => {
    const t = setInterval(() => {
      void reloadWeek()
      void reloadAutos()
      void reloadStatus()
    }, 5000)
    return () => clearInterval(t)
  }, [reloadWeek, reloadAutos, reloadStatus])

  function edit(a?: Automation) {
    setForm(
      a
        ? { name: a.name, sources: a.sources.join('\n'), channelId: a.channelId, instagramAccountId: a.instagramAccountId ?? '', slotTimes: a.slotTimes, runTime: a.runTime, musicVolumePct: a.musicVolumePct, active: a.active }
        : emptyForm,
    )
    setFields({})
    setEditing(true)
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFields({})
    const body = {
      name: form.name,
      sources: form.sources.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
      channelId: form.channelId,
      instagramAccountId: form.instagramAccountId || null,
      slotTimes: form.slotTimes,
      runTime: form.runTime,
      musicVolumePct: form.musicVolumePct,
      active: form.active,
    }
    try {
      if (automation) await api.patch(`/weekly/automations/${automation.id}`, body)
      else await api.post('/weekly/automations', body)
      setEditing(false)
      await autos.reload()
      toast({ tone: 'success', text: 'Configuração salva.' })
    } catch (err) {
      const info = errorInfo(err)
      setFields(info.fields)
      toast({ tone: 'error', text: info.message })
    } finally {
      setBusy(false)
    }
  }
  async function runNow() {
    if (!automation) return
    setBusy(true)
    try {
      const r = await api.post<{ weekStart: string; created: number }>(`/weekly/automations/${automation.id}/run`, {})
      setWeek(r.data.weekStart)
      await weekData.reload()
      toast({ tone: 'success', text: r.data.created ? `${r.data.created} vídeo(s) entraram na fila da semana.` : 'Nenhum vídeo novo encontrado nos canais.' })
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
    }
  }
  async function retry(id: string) {
    try {
      await api.post(`/weekly/items/${id}/retry`, {})
      await weekData.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }
  const setTime = (i: number, v: string) => setForm({ ...form, slotTimes: form.slotTimes.map((t, k) => (k === i ? v : t)) })

  const s = status.data
  const w = weekData.data
  const bySlot = new Map((w?.items ?? []).filter((i) => i.slotAt).map((i) => [+new Date(i.slotAt!), i]))
  const days = [...new Set((w?.slots ?? []).map(dayKey))]
  const times = [...new Set((w?.slots ?? []).map(hourLabel))]
  const queue = (w?.items ?? []).filter((i) => !i.slotAt)
  const channelName = (id: string) => channels.find((c) => c.channelId === id)?.title ?? id

  return (
    <div>
      <PageHeader
        title="Semana automática"
        description="Todo domingo, baixa os vídeos do Telegram, troca a música de fundo por uma da biblioteca, cria título e legenda com o Codex e agenda 3 por dia, de segunda a domingo, no YouTube e no Instagram."
        actions={
          automation && (
            <div className="flex gap-2">
              <Button icon={<Pencil size={16} />} onClick={() => edit(automation)}>
                Configurar
              </Button>
              <Button variant="primary" icon={<Download size={16} />} loading={busy} onClick={runNow}>
                Baixar a semana agora
              </Button>
            </div>
          )
        }
      />
      {s && (!s.telegramConfigured || !s.audioToolsReady || s.musicCount === 0) && (
        <Card className="mb-5 p-4">
          <p className="font-medium">Pendências no servidor</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">
            {!s.telegramConfigured && <li>Sessão do Telegram não configurada.</li>}
            {!s.audioToolsReady && <li>Ferramentas de áudio (Demucs e Whisper) não encontradas em tools/venv.</li>}
            {s.musicCount === 0 && <li>A biblioteca de músicas está vazia. Coloque arquivos de áudio em {s.musicDir}.</li>}
          </ul>
        </Card>
      )}
      {s && (
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Tag tone={s.telegramConfigured ? 'success' : 'error'}>Telegram {s.telegramConfigured ? 'configurado' : 'pendente'}</Tag>
          <Tag tone={s.audioToolsReady ? 'success' : 'error'}>Ferramentas de áudio {s.audioToolsReady ? 'prontas' : 'ausentes'}</Tag>
          <Tag tone={s.musicCount ? 'success' : 'error'}>{s.musicCount} música(s) na biblioteca</Tag>
        </div>
      )}

      {(editing || (!autos.loading && !automation)) && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-lg font-semibold">{automation ? 'Configuração' : 'Criar a semana automática'}</h2>
          <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
            <Field label="Nome" error={fields.name}>
              {(id) => <Input id={id} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Canais do Telegram" hint="Um por linha: @canal ou ID -100…. Entram os vídeos postados nos últimos 7 dias." error={fields.sources}>
              {(id) => <Textarea id={id} required rows={3} value={form.sources} onChange={(e) => setForm({ ...form, sources: e.target.value })} />}
            </Field>
            <Field label="Canal do YouTube" error={fields.channelId}>
              {(id) => (
                <Select id={id} required value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
                  <option value="">Selecione um canal conectado</option>
                  {channels.filter((c) => c.status === 'connected').map((c) => (
                    <option key={c.channelId} value={c.channelId}>{c.title}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Conta do Instagram" hint="Opcional. Sem conta, publica só no YouTube." error={fields.instagramAccountId}>
              {(id) => (
                <Select id={id} value={form.instagramAccountId} onChange={(e) => setForm({ ...form, instagramAccountId: e.target.value })}>
                  <option value="">Não publicar no Instagram</option>
                  {accounts.filter((a) => a.status === 'connected').map((a) => (
                    <option key={a.id} value={a.id}>@{a.username}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Horários de publicação (fuso de São Paulo)" hint="Valem para todos os dias, de segunda a domingo." error={fields.slotTimes}>
              {() => (
                <div className="flex flex-wrap items-center gap-2">
                  {form.slotTimes.map((t, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Input aria-label={`Horário ${i + 1}`} type="time" required value={t} onChange={(e) => setTime(i, e.target.value)} />
                      {form.slotTimes.length > 1 && (
                        <button type="button" aria-label="Remover horário" className="text-muted hover:text-negative" onClick={() => setForm({ ...form, slotTimes: form.slotTimes.filter((_, k) => k !== i) })}>
                          <X size={16} />
                        </button>
                      )}
                    </span>
                  ))}
                  {form.slotTimes.length < 6 && (
                    <Button type="button" icon={<Plus size={14} />} onClick={() => setForm({ ...form, slotTimes: [...form.slotTimes, '18:00'] })}>
                      Horário
                    </Button>
                  )}
                </div>
              )}
            </Field>
            <Field label="Preparar a semana no domingo às" hint="O download e o processamento começam neste horário." error={fields.runTime}>
              {(id) => <Input id={id} type="time" required value={form.runTime} onChange={(e) => setForm({ ...form, runTime: e.target.value })} />}
            </Field>
            <Field label="Volume da música (15% a 20%)" hint="Porcentagem do volume original da música da biblioteca." error={fields.musicVolumePct}>
              {(id) => <Input id={id} type="number" min={15} max={20} required value={form.musicVolumePct} onChange={(e) => setForm({ ...form, musicVolumePct: Number(e.target.value) })} />}
            </Field>
            <div className="flex items-center gap-3">
              <Toggle checked={form.active} label="Automação ativa" onChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm text-muted">{form.active ? 'Ativa' : 'Pausada'}</span>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" variant="primary" loading={busy}>Salvar</Button>
              {automation && <Button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button>}
            </div>
          </form>
        </Card>
      )}

      {automation && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
            <Tag tone={automation.active ? 'success' : 'neutral'}>{automation.active ? 'Ativa' : 'Pausada'}</Tag>
            <span>{automation.sources.join(', ')} → {channelName(automation.channelId)}{automation.instagramAccountId ? ' + Instagram' : ''}</span>
            <span>Música a {automation.musicVolumePct}%</span>
            {automation.lastRunAt && <span>Última preparação: {new Date(automation.lastRunAt).toLocaleString('pt-BR', { timeZone: TZ })}</span>}
          </div>
          {automation.lastError && <p role="alert" className="mb-4 text-sm text-negative">{automation.lastError}</p>}

          <Card className="mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Agenda da semana</h2>
              {w && (
                <Select aria-label="Semana" className="max-w-56" value={w.week} onChange={(e) => setWeek(e.target.value)}>
                  {w.weeks.map((x) => <option key={x} value={x}>{weekLabel(x)}</option>)}
                </Select>
              )}
            </div>
            {weekData.loading && !w ? (
              <SkeletonList />
            ) : weekData.error && !w ? (
              <ErrorCard onRetry={weekData.reload} />
            ) : !w || !w.items.length ? (
              <EmptyState text="Nenhum vídeo preparado para esta semana. A preparação roda no domingo, ou use “Baixar a semana agora”." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th className="w-14" />
                      {days.map((d) => {
                        const first = w.slots.find((x) => dayKey(x) === d)!
                        return <th key={d} className="px-1 text-left font-medium capitalize">{dayLabel(first)}</th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {times.map((t) => (
                      <tr key={t} className="align-top">
                        <th className="pr-2 text-right font-normal text-muted">{t}</th>
                        {days.map((d) => {
                          const slot = w.slots.find((x) => dayKey(x) === d && hourLabel(x) === t)
                          const item = slot ? bySlot.get(+new Date(slot)) : undefined
                          return (
                            <td key={d} className="rounded-control border border-border p-2">
                              {item ? (
                                <div className="space-y-1">
                                  <StatusTag status={item.status} />
                                  <p className="line-clamp-3 break-words">{item.title}</p>
                                  {item.youtube && (
                                    <p className="text-xs text-muted">
                                      YouTube: {ytLabels[item.youtube.status] ?? item.youtube.status}
                                      {item.youtube.status === 'uploading' && item.youtube.progress ? ` ${item.youtube.progress}%` : ''}
                                      {item.youtube.url && <> · <a className="text-brand underline" href={item.youtube.url} target="_blank" rel="noreferrer">abrir</a></>}
                                    </p>
                                  )}
                                  {item.instagram && (
                                    <p className="text-xs text-muted">
                                      Instagram: {igLabels[item.instagram.status] ?? item.instagram.status}
                                      {item.instagram.permalink && <> · <a className="text-brand underline" href={item.instagram.permalink} target="_blank" rel="noreferrer">abrir</a></>}
                                    </p>
                                  )}
                                  {(item.youtube?.error || item.instagram?.error) && <p className="text-xs text-negative">{item.youtube?.error || item.instagram?.error}</p>}
                                </div>
                              ) : (
                                <span className="text-faint">Livre</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {queue.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Fila de processamento</h2>
              <ul className="divide-y divide-border">
                {queue.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="break-words text-sm">{i.title || i.caption || `${i.telegramChat} · mensagem ${i.messageId}`}</p>
                      {i.error && <p className="mt-1 text-sm text-negative">{i.error}</p>}
                    </div>
                    <StatusTag status={i.status} />
                    {(i.status === 'failed' || i.status === 'skipped') && (
                      <Button icon={<RotateCcw size={14} />} onClick={() => void retry(i.id)}>
                        Tentar de novo
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
