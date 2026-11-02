import { QuizBoundary } from '../components/quiz'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorInfo } from '../lib/api'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import { useToast } from '../components/toast'
import { useBeforeUnload } from '../components/useDirtyGuard'
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '../components/ui'
import { useQuizFetch, type QuizConfig } from '../lib/quiz'
export default function QuizSettingsPage() {
  const state = useQuizFetch<QuizConfig>('/quiz/config')
  return (
    <>
      <PageHeader title="Configuração do quiz" description="As alterações valem para as próximas produções." />
      <QuizBoundary {...state} hasData={!!state.data}>
        {state.data && <SettingsForm key={state.data.automation?.revision || 0} config={state.data} reload={state.reload} />}
      </QuizBoundary>
    </>
  )
}
function SettingsForm({ config, reload }: { config: QuizConfig; reload: () => Promise<void> }) {
  const a = config.automation,
    { channels } = useYoutubeChannels(),
    toast = useToast()
  const initial = {
    revision: a?.revision || 0,
    channelId: a?.channelId || '',
    categories: a?.categories.join(', ') || '',
    language: a?.language || 'pt-BR',
    timezone: a?.timezone || 'America/Sao_Paulo',
    localTime: a?.localTime || '12:00',
    questionType: a?.questionType || 'multiple_choice',
    questionCount: a?.questionCount || 3,
    difficulty: a?.difficulty || 'mixed',
    instructions: a?.instructions || '',
    mode: a?.mode || 'automatic',
    delivery: a?.delivery || 'dry_run',
    privacyStatus: a?.privacyStatus || 'private',
    madeForKids: a?.madeForKids === undefined ? '' : String(a.madeForKids),
  }
  const [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false),
    [fields, setFields] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState(false)
  const dirty = !saved && JSON.stringify(form) !== JSON.stringify(initial)
  useBeforeUnload(dirty)
  const change = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }))
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/quiz/config', {
        ...form,
        categories: form.categories
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        madeForKids: form.madeForKids === '' ? undefined : form.madeForKids === 'true',
      })
      setSaved(true)
      toast({ tone: 'success', text: 'Configuração salva. A agenda permanece pausada.' })
      await reload()
    } catch (err) {
      const e = errorInfo(err)
      setFields(e.fields)
      toast({ tone: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }
  const input = (key: keyof typeof form, label: string, type = 'text') => (
    <Field label={label} error={fields[key]}>
      {(id, desc) => (
        <Input
          id={id}
          aria-describedby={desc}
          type={type}
          value={form[key]}
          onChange={(e) => change(key, type === 'number' ? Number(e.target.value) : e.target.value)}
          required
        />
      )}
    </Field>
  )
  const select = (key: keyof typeof form, label: string, options: [string, string][]) => (
    <Field label={label} error={fields[key]}>
      {(id, desc) => (
        <Select id={id} aria-describedby={desc} value={form[key]} onChange={(e) => change(key, e.target.value)}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
  return (
    <form onSubmit={save} className="space-y-6">
      {a?.enabled && (
        <p role="alert" className="text-sm text-warning">
          Pause a agenda na{' '}
          <Link to="/quiz" className="underline">
            visão geral
          </Link>{' '}
          antes de editar.
        </p>
      )}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2 className="font-semibold">Canal e conteúdo</h2>
          <p className="mt-2 text-sm text-muted">
            Um canal e um template ativo. As perguntas são escolhidas dentro das categorias autorizadas.
          </p>
        </div>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {select('channelId', 'Canal YouTube', [
            ['', 'Selecione um canal'],
            ...channels.filter((c) => c.status === 'connected').map((c) => [c.id, c.title] as [string, string]),
          ])}
          {input('categories', 'Categorias separadas por vírgula')}
          {input('language', 'Idioma')}
          {select('questionType', 'Tipo de pergunta', [
            ['multiple_choice', 'Múltipla escolha'],
            ['visual_identification', 'Identificação visual'],
            ['true_false', 'Verdadeiro ou falso'],
            ['preference_poll', 'Preferência'],
          ])}
          {input('questionCount', 'Quantidade de perguntas', 'number')}
          {select('difficulty', 'Dificuldade', [
            ['mixed', 'Mista'],
            ['easy', 'Fácil'],
            ['medium', 'Média'],
            ['hard', 'Difícil'],
          ])}
          <div className="sm:col-span-2">
            <Field label="Instruções adicionais" error={fields.instructions}>
              {(id) => (
                <Textarea id={id} value={form.instructions} maxLength={2000} onChange={(e) => change('instructions', e.target.value)} />
              )}
            </Field>
          </div>
        </Card>
      </section>
      <section className="grid gap-5 border-t border-border pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2 className="font-semibold">Agenda e revisão</h2>
          <p className="mt-2 text-sm text-muted">No máximo um envio automático por dia. Testes nunca são publicados.</p>
        </div>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {input('localTime', 'Horário local', 'time')}
          {input('timezone', 'Fuso horário (ex.: America/Sao_Paulo)')}
          {select('mode', 'Revisão', [
            ['automatic', 'Automático'],
            ['manual_review', 'Revisão manual por versão'],
          ])}
          {select(
            'delivery',
            'Destino',
            config.publishingEnabled
              ? [
                  ['dry_run', 'Somente teste'],
                  ['publish', 'Publicação no YouTube'],
                ]
              : [['dry_run', 'Somente teste — publicação desativada']],
          )}
          {select('privacyStatus', 'Visibilidade', [
            ['private', 'Privado'],
            ['unlisted', 'Não listado'],
            ['public', 'Público'],
          ])}
          {select('madeForKids', 'Conteúdo criado para crianças?', [
            ['', 'Selecione explicitamente'],
            ['false', 'Não'],
            ['true', 'Sim'],
          ])}
        </Card>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-muted">
          {dirty ? 'Alterações não salvas' : a ? 'Configuração atual carregada' : 'A configuração começa pausada'}
        </span>
        <Button type="submit" variant="primary" loading={busy} disabled={!!a?.enabled || !!a?.pendingSlot}>
          Salvar configuração
        </Button>
      </div>
    </form>
  )
}
