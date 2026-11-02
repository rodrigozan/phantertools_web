import { QuizBoundary, ProductionRows } from '../components/quiz'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, PageHeader } from '../components/ui'
import { useToast } from '../components/toast'
import { useYoutubeChannels } from '../lib/youtubeChannels'
import { quizAction, quizDate, useQuizFetch, type QuizConfig, type QuizProduction } from '../lib/quiz'
type Overview = QuizConfig & { counts: { _id: string; count: number }[]; latest: QuizProduction[] }
export default function QuizDashboardPage() {
  const state = useQuizFetch<Overview>('/quiz/overview', true),
    a = state.data?.automation
  const { channels } = useYoutubeChannels(),
    toast = useToast(),
    navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  async function action(kind: 'test' | 'pause' | 'resume') {
    setBusy(true)
    try {
      const r = await quizAction(`/quiz/${kind}`, kind === 'resume' ? { revision: a?.revision } : {})
      if (kind === 'test') {
        toast({ tone: 'success', text: 'Produção de teste criada. Nenhum vídeo será publicado.' })
        navigate(`/quiz/producoes/${r.id}`)
      } else await state.reload()
    } catch (e) {
      toast({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const counts = state.data?.counts || [],
    total = counts.reduce((s, v) => s + v.count, 0),
    count = (states: string[]) => counts.filter((c) => states.includes(c._id)).reduce((s, v) => s + v.count, 0)
  return (
    <>
      <PageHeader
        title="Quiz Factory"
        description="Do roteiro ao YouTube, uma produção por dia."
        actions={
          <Button variant="primary" disabled={!a} loading={busy} onClick={() => action('test')}>
            Criar teste
          </Button>
        }
      />
      <QuizBoundary {...state} hasData={!!state.data}>
        {!a ? (
          <EmptyState
            text="Escolha o canal, as categorias e o horário para preparar sua primeira produção."
            action={
              <Link to="/quiz/configuracao" className="text-brand underline">
                Configurar Quiz Factory
              </Link>
            }
          />
        ) : (
          <>
            <section className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" aria-label="Operação">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{a.enabled ? 'Agenda ativa' : 'Agenda pausada'}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {channels.find((c) => c.id === a.channelId)?.title || 'Canal selecionado'} ·{' '}
                      {a.delivery === 'publish' ? 'Publicação configurada' : 'Testes sem publicação'}
                    </p>
                  </div>
                  <Button loading={busy} onClick={() => action(a.enabled ? 'pause' : 'resume')}>
                    {a.enabled ? 'Pausar' : 'Retomar agenda'}
                  </Button>
                </div>
                <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted">Próxima execução</dt>
                    <dd className="mt-1 font-medium tabular-nums">{a.enabled ? quizDate(a.nextRunAt, a.timezone) : 'Pausada'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">Horário local</dt>
                    <dd className="mt-1 font-medium">
                      {a.localTime} · {a.timezone}
                    </dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm text-muted">
                  {!state.data?.publishingEnabled
                    ? 'O envio ao YouTube está desativado no servidor.'
                    : 'A revisão e a visibilidade seguem a configuração de cada produção.'}
                </p>
                {a.lastError && (
                  <p role="alert" className="mt-3 text-sm text-negative">
                    A agenda precisa de atenção: {a.lastError.code}
                  </p>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold">Próximas produções</h2>
                <p className="mt-3 text-sm text-muted">{a.categories.join(', ')}</p>
                <p className="mt-2 text-sm">
                  {a.questionCount} perguntas · {a.language} · {a.mode === 'manual_review' ? 'Revisão manual' : 'Modo automático'}
                </p>
                <Link className="mt-5 inline-block text-sm text-brand underline" to="/quiz/configuracao">
                  Editar configuração
                </Link>
              </Card>
            </section>
            <dl className="mb-6 grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4">
              {[
                ['Produções registradas', total],
                ['Vídeos prontos', count(['video_ready', 'awaiting_approval', 'ready_to_publish'])],
                ['Disponíveis no YouTube', count(['published'])],
                ['Precisam de atenção', count(['blocked', 'failed_retryable'])],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="mt-1 text-2xl tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <section>
              <div className="mb-2 flex justify-between">
                <h2 className="font-semibold">Últimas produções</h2>
                <Link to="/quiz/producoes" className="text-sm text-brand underline">
                  Ver todas
                </Link>
              </div>
              {state.data?.latest.length ? (
                <ProductionRows rows={state.data.latest} />
              ) : (
                <EmptyState text="Nenhuma produção ainda. Crie um teste para acompanhar o roteiro e a renderização." />
              )}
            </section>
          </>
        )}
      </QuizBoundary>
    </>
  )
}
