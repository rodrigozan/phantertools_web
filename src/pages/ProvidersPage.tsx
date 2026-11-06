import { useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, AlertCircle, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useToast } from '../components/toast'
import { Banner, Button, Card, ConfirmDialog, EmptyState, ErrorCard, Field, Input, Modal, PageHeader, Select, SkeletonList, Tag, Textarea, Toggle } from '../components/ui'

type Provider = {
  id: string
  name: string
  kind: 'cli' | 'api'
  enabled: boolean
  order: number
  builtin: boolean
  preset: string | null
  command: string | null
  args: string[]
  protocol: 'openai' | 'anthropic' | 'ollama' | null
  baseUrl: string | null
  model: string | null
  keySet: boolean
  keyLast4: string | null
  lastOkAt: string | null
  lastErrorAt: string | null
  lastError: string | null
}

const PRESETS: Record<string, string> = { codex: 'Codex', claude: 'Claude Code', gemini: 'Gemini CLI', opencode: 'OpenCode', custom: 'Outra CLI' }
const PROTOCOLS: Record<string, { label: string; url: string; hint: string }> = {
  openai: { label: 'Compatível com OpenAI (OpenAI, Gemini, DeepSeek, OpenRouter…)', url: 'https://api.openai.com/v1', hint: 'Ex.: gpt-5-mini, gemini-2.5-flash, deepseek-chat' },
  ollama: { label: 'Ollama (local, sem chave)', url: 'http://127.0.0.1:11434', hint: 'Ex.: llama3.2:latest · usa a transcrição, sem imagens' },
  anthropic: { label: 'Anthropic (Claude)', url: 'https://api.anthropic.com/v1', hint: 'Ex.: claude-haiku-5-5' },
}

type Form = {
  kind: 'cli' | 'api'
  name: string
  preset: string
  command: string
  args: string
  protocol: 'openai' | 'anthropic' | 'ollama'
  baseUrl: string
  model: string
  apiKey: string
}
const emptyForm: Form = { kind: 'api', name: '', preset: 'claude', command: '', args: '', protocol: 'openai', baseUrl: '', model: '', apiKey: '' }

const fromProvider = (p: Provider): Form => ({
  kind: p.kind,
  name: p.name,
  preset: p.preset ?? 'custom',
  command: p.command ?? '',
  args: p.args.join('\n'),
  protocol: p.protocol ?? 'openai',
  baseUrl: p.baseUrl ?? '',
  model: p.model ?? '',
  apiKey: '',
})

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ProvidersPage() {
  const toast = useToast()
  const list = useFetch<{ providers: Provider[] }>('/ai-providers')
  const [editing, setEditing] = useState<{ id: string | null; builtin: boolean; form: Form } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Provider | null>(null)
  const [test, setTest] = useState<Record<string, { ok: boolean; detail: string }>>({})

  const providers = list.data?.providers ?? []
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  const open = (p?: Provider) => {
    setErrors({})
    setEditing(p ? { id: p.id, builtin: p.builtin, form: fromProvider(p) } : { id: null, builtin: false, form: emptyForm })
  }

  async function save() {
    if (!editing) return
    const f = editing.form
    const model = f.model.trim() || null
    const body =
      f.kind === 'api'
        ? { kind: 'api', name: f.name, protocol: f.protocol, baseUrl: f.baseUrl.trim() || null, model, ...(f.apiKey ? { apiKey: f.apiKey } : {}) }
        : { kind: 'cli', name: f.name, preset: f.preset, command: f.command.trim() || null, args: f.preset === 'custom' ? f.args.split('\n').filter((l) => l.trim()) : [], model }
    setSaving(true)
    setErrors({})
    try {
      if (editing.id) {
        // O tipo e o preset não mudam depois de criados (a entrada padrão do Codex nem aceita).
        const { kind: _kind, ...patch } = body
        const { preset: _preset, protocol: _protocol, ...rest } = patch as Record<string, unknown>
        await api.patch(`/ai-providers/${editing.id}`, editing.builtin ? { name: f.name, model, command: f.command.trim() || null } : rest)
      } else {
        await api.post('/ai-providers', body)
      }
      setEditing(null)
      toast({ tone: 'success', text: 'Provedor salvo.' })
      list.reload()
    } catch (err) {
      const info = errorInfo(err)
      setErrors(info.fields)
      if (!Object.keys(info.fields).length) toast({ tone: 'error', text: info.message })
    } finally {
      setSaving(false)
    }
  }

  async function patch(p: Provider, body: Record<string, unknown>) {
    try {
      await api.patch(`/ai-providers/${p.id}`, body)
      list.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }

  async function move(index: number, by: -1 | 1) {
    const ids = providers.map((p) => p.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    try {
      const r = await api.post<{ providers: Provider[] }>('/ai-providers/order', { ids })
      list.setData(r.data)
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }

  async function runTest(p: Provider) {
    setTesting(p.id)
    try {
      const r = await api.post<{ ok: boolean; detail: string }>(`/ai-providers/${p.id}/test`)
      setTest((t) => ({ ...t, [p.id]: r.data }))
      list.reload()
    } catch (err) {
      setTest((t) => ({ ...t, [p.id]: { ok: false, detail: errorInfo(err).message } }))
    } finally {
      setTesting(null)
    }
  }

  async function remove() {
    if (!removing) return
    try {
      await api.delete(`/ai-providers/${removing.id}`)
      setRemoving(null)
      list.reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
      setRemoving(null)
    }
  }

  const f = editing?.form
  const lockedType = Boolean(editing?.id)

  return (
    <div>
      <PageHeader
        title="Provedores de IA"
        description="Quem escreve título, descrição e hashtags dos vídeos. Eles são tentados de cima para baixo: se o primeiro falhar ou estourar a cota, o próximo assume."
        actions={<Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => open()}>Adicionar provedor</Button>}
      />
      <Banner tone="warning">
        As chaves ficam criptografadas no servidor e nunca voltam para esta tela. Quando um provedor estoura a cota, ele fica de molho por 15 minutos e os vídeos seguem pelo próximo da lista.
      </Banner>
      <div className="mt-5">
        {list.loading && !list.data ? (
          <SkeletonList rows={3} />
        ) : list.error ? (
          <ErrorCard message={list.error} onRetry={list.reload} />
        ) : !providers.length ? (
          <EmptyState text="Nenhum provedor cadastrado." />
        ) : (
          <div className="flex flex-col gap-3">
            {providers.map((p, i) => {
              const t = test[p.id]
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                      <button type="button" aria-label={`Subir ${p.name}`} disabled={i === 0} onClick={() => move(i, -1)} className="text-muted hover:text-ink disabled:opacity-30">
                        <ArrowUp size={16} aria-hidden />
                      </button>
                      <button type="button" aria-label={`Descer ${p.name}`} disabled={i === providers.length - 1} onClick={() => move(i, 1)} className="text-muted hover:text-ink disabled:opacity-30">
                        <ArrowDown size={16} aria-hidden />
                      </button>
                    </div>
                    <span className="w-5 text-center text-sm text-faint">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{p.name}</h2>
                        <Tag tone="neutral">{p.kind === 'api' ? 'API' : PRESETS[p.preset ?? 'custom']}</Tag>
                        {p.builtin && <Tag tone="brand">Padrão</Tag>}
                        {!p.enabled && <Tag tone="neutral">Desligado</Tag>}
                        {p.lastError && p.lastErrorAt && (!p.lastOkAt || p.lastErrorAt > p.lastOkAt) ? (
                          <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>Falhou em {when(p.lastErrorAt)}</Tag>
                        ) : p.lastOkAt ? (
                          <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>Respondeu em {when(p.lastOkAt)}</Tag>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {p.kind === 'api'
                          ? `${p.model ?? 'sem modelo'} · ${p.protocol === 'ollama' ? 'local, sem chave' : `chave ${p.keySet ? `…${p.keyLast4}` : 'não definida'}`}${p.baseUrl ? ` · ${p.baseUrl}` : ''}`
                          : `${p.command || PRESETS[p.preset ?? 'custom']}${p.model ? ` · ${p.model}` : ''}`}
                      </p>
                      {p.lastError && <p className="mt-1 truncate text-xs text-faint" title={p.lastError}>Último erro: {p.lastError}</p>}
                      {t && <p className={`mt-1 text-sm ${t.ok ? 'text-positive' : 'text-negative'}`}>{t.ok ? 'Funcionando. ' : 'Falhou. '}{t.detail}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Toggle checked={p.enabled} label={`${p.enabled ? 'Desligar' : 'Ligar'} ${p.name}`} onChange={(v) => patch(p, { enabled: v })} />
                      <Button icon={<Zap size={16} aria-hidden />} loading={testing === p.id} loadingText="Testando…" onClick={() => runTest(p)}>Testar</Button>
                      <Button variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => open(p)}><Pencil size={16} aria-hidden /></Button>
                      {!p.builtin && <Button variant="ghost" aria-label={`Apagar ${p.name}`} onClick={() => setRemoving(p)}><Trash2 size={16} aria-hidden /></Button>}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={Boolean(editing)} title={editing?.id ? 'Editar provedor' : 'Novo provedor'} onClose={() => setEditing(null)}>
        {f && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            {!lockedType && (
              <Field label="Tipo">
                {(id) => (
                  <Select id={id} value={f.kind} onChange={(e) => set({ kind: e.target.value as Form['kind'] })}>
                    <option value="api">Chave de API</option>
                    <option value="cli">CLI instalada no servidor</option>
                  </Select>
                )}
              </Field>
            )}
            <Field label="Nome" error={errors.name}>{(id) => <Input id={id} value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Gemini reserva" />}</Field>

            {f.kind === 'api' ? (
              <>
                {!lockedType && (
                  <Field label="Protocolo">
                    {(id) => (
                      <Select id={id} value={f.protocol} onChange={(e) => set({ protocol: e.target.value as Form['protocol'] })}>
                        {Object.entries(PROTOCOLS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
                <Field label="Endereço da API" error={errors.baseUrl} hint="Deixe em branco para usar o endereço oficial. Para Gemini, DeepSeek, OpenRouter etc., use o endereço compatível com OpenAI deles.">
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(errors.baseUrl)} value={f.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={PROTOCOLS[f.protocol].url} />}
                </Field>
                <Field label="Modelo" error={errors.model} hint={PROTOCOLS[f.protocol].hint}>
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(errors.model)} value={f.model} onChange={(e) => set({ model: e.target.value })} />}
                </Field>
                {f.protocol !== 'ollama' && <Field label="Chave de API" error={errors.apiKey} hint={editing?.id ? 'Deixe em branco para manter a chave atual.' : undefined}>
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(errors.apiKey)} type="password" autoComplete="off" value={f.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder={editing?.id ? '••••••••' : 'Cole a chave'} />}
                </Field>}
              </>
            ) : (
              <>
                {!lockedType && (
                  <Field label="CLI">
                    {(id) => (
                      <Select id={id} value={f.preset} onChange={(e) => set({ preset: e.target.value })}>
                        {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
                <Field label={f.preset === 'custom' ? 'Comando' : 'Comando (opcional)'} error={errors.command} hint="Nome ou caminho do programa no servidor, sem opções. O texto vai pela entrada padrão.">
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(errors.command)} value={f.command} onChange={(e) => set({ command: e.target.value })} placeholder={f.preset === 'custom' ? '/usr/local/bin/minha-cli' : PRESETS[f.preset]?.toLowerCase()} />}
                </Field>
                {f.preset === 'custom' && (
                  <Field label="Argumentos (um por linha)" hint="Use {prompt} onde o texto deve entrar. Sem {prompt}, ele vai pela entrada padrão.">
                    {(id, d) => <Textarea id={id} aria-describedby={d} value={f.args} onChange={(e) => set({ args: e.target.value })} className="font-mono" placeholder={'run\n--quiet\n{prompt}'} />}
                  </Field>
                )}
                <Field label="Modelo (opcional)" error={errors.model}>{(id) => <Input id={id} value={f.model} onChange={(e) => set({ model: e.target.value })} />}</Field>
              </>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={saving} loadingText="Salvando…">Salvar</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Apagar provedor"
        message={`Apagar "${removing?.name}"? ${removing?.kind === 'api' ? 'A chave guardada será removida.' : ''}`}
        confirmLabel="Apagar"
        danger
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
