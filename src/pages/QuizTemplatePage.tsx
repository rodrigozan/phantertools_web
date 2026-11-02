import { QuizBoundary } from '../components/quiz'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useBeforeUnload } from '../components/useDirtyGuard'
import { useToast } from '../components/toast'
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import { useQuizFetch, type QuizConfig, type QuizTemplate } from '../lib/quiz'
export default function QuizTemplatePage() {
  const config = useQuizFetch<QuizConfig>('/quiz/config'),
    templates = useFetch<QuizTemplate[]>('/quiz/templates'),
    voices = useFetch<{ id: string; language: string }[]>('/quiz/voices'),
    assets = useFetch<{ id: string; kind: string; author: string; license: string }[]>('/quiz/assets')
  const active = templates.data?.find((t) => t._id === config.data?.automation?.templateId)
  return (
    <>
      <PageHeader title="Template do quiz" description="Cada edição cria uma versão; vídeos existentes conservam sua composição." />
      <QuizBoundary
        loading={config.loading || templates.loading}
        error={config.error || templates.error}
        hasData={!!active}
        reload={() => {
          void config.reload()
          void templates.reload()
        }}
      >
        {active && config.data ? (
          <TemplateForm
            key={active._id}
            template={active}
            config={config.data}
            voices={voices.data || []}
            assets={assets.data || []}
            reload={async () => {
              await config.reload()
              await templates.reload()
            }}
          />
        ) : (
          <EmptyState
            text="Configure a automação para criar seu template inicial."
            action={
              <Link to="/quiz/configuracao" className="text-brand underline">
                Configurar
              </Link>
            }
          />
        )}
      </QuizBoundary>
    </>
  )
}
function TemplateForm({
  template: t,
  config,
  voices,
  assets,
  reload,
}: {
  template: QuizTemplate
  config: QuizConfig
  voices: { id: string; language: string }[]
  assets: { id: string; kind: string; author: string; license: string }[]
  reload: () => Promise<void>
}) {
  const initial = {
    name: t.name,
    questionSeconds: t.timings.questionSeconds,
    revealSeconds: t.timings.revealSeconds,
    background: t.theme.background,
    foreground: t.theme.foreground,
    voiceId: t.voice?.id || 'default',
    musicId: t.audio?.musicId || '',
    effectId: t.audio?.effectId || '',
  }
  const [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false)
  const toast = useToast()
  useBeforeUnload(!saved && JSON.stringify(form) !== JSON.stringify(initial))
  const change = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }))
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/quiz/templates/${t._id}`, {
        ...form,
        revision: config.automation?.revision,
        musicId: form.musicId || null,
        effectId: form.effectId || null,
      })
      setSaved(true)
      toast({ tone: 'success', text: 'Nova versão do template criada.' })
      await reload()
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <form onSubmit={save}>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-5 text-sm text-muted">Versão ativa: {t.version} · Formato vertical 9:16</p>
            <Field label="Nome do template">
              {(id) => <Input id={id} value={form.name} maxLength={100} required onChange={(e) => change('name', e.target.value)} />}
            </Field>
          </div>
          <Field label="Cronômetro após a narração (s)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={2}
                max={30}
                value={form.questionSeconds}
                onChange={(e) => change('questionSeconds', Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Duração mínima da resposta (s)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={10}
                value={form.revealSeconds}
                onChange={(e) => change('revealSeconds', Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Cor de fundo">
            {(id) => <Input id={id} type="color" value={form.background} onChange={(e) => change('background', e.target.value)} />}
          </Field>
          <Field label="Cor do texto">
            {(id) => <Input id={id} type="color" value={form.foreground} onChange={(e) => change('foreground', e.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Voz cadastrada">
              {(id) => (
                <Select id={id} value={form.voiceId} onChange={(e) => change('voiceId', e.target.value)}>
                  {!voices.some((v) => v.id === form.voiceId) && <option value={form.voiceId}>{form.voiceId} — cadastro pendente</option>}
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} · {v.language}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {(
            [
              ['musicId', 'music', 'Música de fundo'],
              ['effectId', 'effect', 'Efeito da resposta'],
            ] as const
          ).map(([field, kind, label]) => (
            <Field key={field} label={label} hint="Somente ativos do catálogo licenciado.">
              {(id) => (
                <Select id={id} value={form[field]} onChange={(e) => change(field, e.target.value)}>
                  <option value="">Desativado</option>
                  {form[field] && !assets.some((a) => a.id === form[field]) && (
                    <option value={form[field]}>{form[field]} — cadastro pendente</option>
                  )}
                  {assets
                    .filter((a) => a.kind === kind)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} · {a.author} ({a.license})
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          ))}
        </Card>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {config.automation?.enabled ? 'Pause a agenda antes de editar.' : 'A próxima produção usará a nova versão.'}
          </p>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!!config.automation?.enabled || !!config.automation?.pendingSlot}
          >
            Criar nova versão
          </Button>
        </div>
      </form>
      <aside>
        <h2 className="mb-3 font-semibold">Prévia de composição</h2>
        <div
          className="mx-auto flex aspect-[9/16] w-full max-w-[280px] flex-col justify-between rounded-card p-6 text-center"
          style={{ backgroundColor: form.background, color: form.foreground }}
        >
          <p className="text-xs">QUIZ FACTORY</p>
          <div>
            <p className="font-semibold">Pergunta do quiz</p>
            <div className="mt-7 space-y-4 text-sm">
              <p>A. Primeira alternativa</p>
              <p>B. Segunda alternativa</p>
              <p>C. Terceira alternativa</p>
            </div>
          </div>
          <p className="text-sm">Cronômetro: {form.questionSeconds} s</p>
        </div>
        <p className="mt-3 text-sm text-muted">Exemplo de layout. A prévia final é o vídeo renderizado na produção.</p>
      </aside>
    </div>
  )
}
