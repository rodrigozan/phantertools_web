import { QuizBoundary, QuizStatus } from '../components/quiz'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, ConfirmDialog, PageHeader } from '../components/ui'
import { useToast } from '../components/toast'
import { quizAction, quizDate, quizMedia, safeQuizLink, useQuizFetch, type QuizProduction, type QuizConfig } from '../lib/quiz'
const cancellable = [
  'scheduled',
  'failed_retryable',
  'generating',
  'validating_content',
  'content_ready',
  'acquiring_assets',
  'generating_audio',
  'rendering',
  'validating_video',
  'video_ready',
  'awaiting_approval',
  'ready_to_publish',
]
export default function QuizProductionDetailPage() {
  const { id } = useParams(),
    state = useQuizFetch<QuizProduction>(`/quiz/productions/${id}`, true),
    config = useQuizFetch<QuizConfig>('/quiz/config'),
    p = state.data,
    toast = useToast()
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<'approve' | 'cancel' | null>(null)
  async function action(kind: 'render' | 'retry' | 'cancel' | 'approve') {
    if (!p) return
    setBusy(true)
    try {
      await quizAction(
        `/quiz/productions/${p._id}/${kind}`,
        kind === 'render'
          ? { payloadHash: p.validation?.payloadHash }
          : kind === 'approve'
            ? { hash: p.approvalHash }
            : { attempts: p.resumeStage === 'render' ? p.renderAttempts : p.attempts },
      )
      setConfirm(null)
      await state.reload()
      toast({ tone: 'success', text: kind === 'approve' ? 'Versão autorizada para envio.' : 'Solicitação registrada.' })
    } catch (e) {
      toast({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const hasMedia = !!p?.renderValidation?.valid && !p.mediaRemovedAt
  return (
    <>
      <PageHeader
        title={p?.quizPayload?.topic || 'Detalhe da produção'}
        description={p ? `${p.localDate} · ${p.timezone} · Template v${p.templateVersion}` : undefined}
      />
      <QuizBoundary {...state} hasData={!!p}>
        {p && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <QuizStatus status={p.status} />
                <span className="text-sm text-muted">
                  {p.dryRun ? 'Teste — publicação bloqueada' : `Publicação · ${p.configSnapshot?.privacyStatus || '—'}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.status === 'content_ready' && !p.renderRequested && (
                  <Button loading={busy} disabled={!config.data?.renderEnabled} variant="primary" onClick={() => action('render')}>
                    Renderizar vídeo
                  </Button>
                )}
                {!p.dryRun && ['video_ready', 'awaiting_approval'].includes(p.status) && p.configSnapshot?.mode === 'manual_review' && (
                  <Button loading={busy} disabled={!config.data?.publishingEnabled} variant="primary" onClick={() => setConfirm('approve')}>
                    Revisar e autorizar
                  </Button>
                )}
                {p.status === 'failed_retryable' && (
                  <Button loading={busy} onClick={() => action('retry')}>
                    Tentar novamente
                  </Button>
                )}
                {cancellable.includes(p.status) && !p.youtubeVideoId && (
                  <Button variant="danger" disabled={busy} onClick={() => setConfirm('cancel')}>
                    Cancelar produção
                  </Button>
                )}
              </div>
            </div>
            {(p.publicationError || p.validation?.code || p.renderValidation?.code) && (
              <div role="alert" className="mb-5 rounded-control border border-control p-4 text-sm">
                <p className="font-medium">A produção precisa de atenção</p>
                <p className="mt-1 text-muted">
                  {p.publicationError === 'upload_outcome_uncertain'
                    ? 'O resultado do envio é incerto. Confira no YouTube; o reenvio está bloqueado.'
                    : p.publicationError || p.renderValidation?.code || p.validation?.code}
                </p>
              </div>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
              <section>
                <h2 className="mb-3 font-semibold">Vídeo final</h2>
                {hasMedia ? (
                  <video
                    className="mx-auto max-h-[600px] w-full rounded-card bg-black"
                    controls
                    crossOrigin="use-credentials"
                    preload="metadata"
                    poster={quizMedia(p._id, 'thumbnail')}
                    src={quizMedia(p._id, 'video')}
                  />
                ) : (
                  <Card className="p-5 text-sm text-muted">
                    {p.mediaRemovedAt
                      ? 'A mídia local foi removida. Os manifestos e o histórico foram conservados.'
                      : 'O vídeo aparecerá aqui depois da renderização e validação.'}
                  </Card>
                )}
                {hasMedia && (
                  <a className="mt-3 inline-block text-sm text-brand underline" href={quizMedia(p._id, 'captions')}>
                    Baixar legendas
                  </a>
                )}
                {p.youtubeVideoId && (
                  <Link to={`/videos/${p.youtubeVideoId}`} className="mt-4 block text-sm text-brand underline">
                    Abrir registro YouTube
                  </Link>
                )}
                {p.youtubeRemoteId && (
                  <a
                    className="mt-3 block text-sm text-brand underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.youtube.com/watch?v=${encodeURIComponent(p.youtubeRemoteId)}`}
                  >
                    Ver no YouTube
                  </a>
                )}
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Geração / renderização</dt>
                    <dd className="tabular-nums">
                      {p.attempts} / {p.renderAttempts || 0} tentativas
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">YouTube</dt>
                    <dd>{p.youtubeStatus || 'Sem envio'}</dd>
                  </div>
                  {p.renderValidation?.duration && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Duração</dt>
                      <dd className="tabular-nums">{p.renderValidation.duration.toFixed(1)} s</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Criada em</dt>
                    <dd>{quizDate(p.createdAt, p.timezone)}</dd>
                  </div>
                </dl>
              </section>
              <div className="min-w-0 space-y-6">
                <section>
                  <h2 className="mb-3 font-semibold">Título e descrição do roteiro</h2>
                  <Card className="p-5">
                    <p className="font-medium">{p.quizPayload?.titleSuggestions[0] || 'Roteiro ainda não gerado'}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                      {p.quizPayload?.description || 'A geração validada definirá os metadados.'}
                    </p>
                  </Card>
                </section>
                <section>
                  <h2 className="mb-3 font-semibold">Perguntas e respostas</h2>
                  <ol className="space-y-4">
                    {p.quizPayload?.questions.map((q, i) => (
                      <li key={q.id}>
                        <Card className="p-5">
                          <h3 className="font-medium">
                            {i + 1}. {q.prompt}
                          </h3>
                          <ol className="mt-3 space-y-1 text-sm">
                            {q.options.map((o, j) => (
                              <li key={j} className={j === q.correctIndex ? 'font-medium text-positive' : 'text-muted'}>
                                {String.fromCharCode(65 + j)}. {o}
                                {j === q.correctIndex ? ' · Resposta correta' : ''}
                              </li>
                            ))}
                          </ol>
                          <p className="mt-3 text-sm text-muted">{q.explanation}</p>
                          {q.evidence.map((e) => (
                            <a
                              key={e.factId}
                              href={safeQuizLink(e.sourceUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block break-all text-xs text-brand underline"
                            >
                              Fonte: {e.factId}
                            </a>
                          ))}
                        </Card>
                      </li>
                    ))}
                  </ol>
                  {!p.quizPayload && <p className="text-sm text-muted">As perguntas ficam disponíveis após a validação.</p>}
                </section>
              </div>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-3 font-semibold">Créditos de mídia</h2>
                {p.assetManifest?.length ? (
                  <ul className="divide-y divide-border">
                    {p.assetManifest.map((a, i) => (
                      <li key={`${a.id}-${i}`} className="py-3 text-sm">
                        <p className="font-medium">
                          {a.id} · {a.rights.license}
                        </p>
                        <p className="mt-1 text-muted">{a.rights.author}</p>
                        {a.rights.attribution && <p className="mt-1 text-muted">{a.rights.attribution}</p>}
                        {safeQuizLink(a.rights.originUrl) ? (
                          <a
                            className="mt-1 inline-block text-brand underline"
                            href={safeQuizLink(a.rights.originUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Origem
                          </a>
                        ) : (
                          <span className="mt-1 block break-all text-xs text-muted">{a.rights.originUrl}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Os créditos são registrados ao selecionar os ativos.</p>
                )}
              </section>
              <section>
                <h2 className="mb-3 font-semibold">Histórico da produção</h2>
                <ol className="space-y-3">
                  {[...(p.events || [])].reverse().map((event, i) => (
                    <li key={`${event.at}-${i}`} className="border-l border-border pl-3 text-sm">
                      <p className="break-words">{event.code.replaceAll('_', ' ')}</p>
                      <time className="mt-1 block text-xs text-muted">{quizDate(event.at, p.timezone)}</time>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <ConfirmDialog
              open={!!confirm}
              onClose={() => setConfirm(null)}
              title={confirm === 'approve' ? 'Autorizar envio desta versão?' : 'Cancelar produção?'}
              message={
                confirm === 'approve'
                  ? `Título: ${p.quizPayload?.titleSuggestions[0]}. Visibilidade: ${p.configSnapshot?.privacyStatus}. Criado para crianças: ${p.configSnapshot?.madeForKids ? 'sim' : 'não'}. Template v${p.templateVersion}. A autorização vale apenas para o roteiro, vídeo e thumbnail exibidos.`
                  : 'Os trabalhos pendentes serão interrompidos. Esta ação não apaga vídeos já enviados ao YouTube.'
              }
              confirmLabel={confirm === 'approve' ? 'Autorizar versão' : 'Cancelar produção'}
              loading={busy}
              onConfirm={() => action(confirm === 'approve' ? 'approve' : 'cancel')}
            />
          </>
        )}
      </QuizBoundary>
    </>
  )
}
