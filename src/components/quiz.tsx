import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ErrorCard, Skeleton, Tag } from './ui'
import { quizStates, quizDate, type QuizProduction } from '../lib/quiz'
export function QuizStatus({ status }: { status: string }) {
  return (
    <Tag
      tone={
        ['blocked', 'failed_retryable'].includes(status)
          ? 'error'
          : ['published', 'video_ready', 'content_ready', 'simulated'].includes(status)
            ? 'success'
            : 'neutral'
      }
    >
      {quizStates[status] || status}
    </Tag>
  )
}
export function QuizNav() {
  return (
    <nav aria-label="Quiz Factory" className="mb-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-sm">
      {[
        ['/quiz', 'Visão geral'],
        ['/quiz/producoes', 'Produções'],
        ['/quiz/configuracao', 'Configuração'],
        ['/quiz/templates', 'Template'],
      ].map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'font-medium text-brand' : 'text-muted hover:text-ink')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
export function QuizBoundary({
  loading,
  error,
  hasData,
  children,
  reload,
}: {
  loading: boolean
  error: string | null
  hasData: boolean
  children: ReactNode
  reload: () => void
}) {
  return (
    <>
      <QuizNav />
      {error ? (
        <>
          <ErrorCard message={error} onRetry={reload} />
          <p className="mt-3 text-sm text-muted">
            Se a funcionalidade estiver desativada, o responsável pelo servidor precisa concluir a configuração antes do uso.
          </p>
        </>
      ) : loading && !hasData ? (
        <div role="status" aria-label="Carregando Quiz Factory">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        children
      )}
    </>
  )
}
export function ProductionRows({ rows }: { rows: QuizProduction[] }) {
  return (
    <div role="list" className="divide-y divide-border">
      {rows.map((p) => (
        <Link role="listitem" key={p._id} to={`/quiz/producoes/${p._id}`} className="flex items-center gap-4 py-4 hover:bg-raised">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{p.topic || `Produção de ${p.localDate}`}</p>
            <p className="mt-1 text-xs text-muted">
              {p.dryRun ? 'Teste sem publicação' : 'Produção para publicação'} · Template v{p.templateVersion} ·{' '}
              {quizDate(p.createdAt, p.timezone)}
            </p>
          </div>
          <QuizStatus status={p.status} />
        </Link>
      ))}
    </div>
  )
}
