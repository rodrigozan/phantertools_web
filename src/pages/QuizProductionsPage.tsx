import { QuizBoundary, ProductionRows } from '../components/quiz'
import { useState } from 'react'
import { Button, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import { quizStates, useQuizFetch, type QuizProduction } from '../lib/quiz'
export default function QuizProductionsPage() {
  const [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  if (from) params.set('from', from + 'T00:00:00.000Z')
  if (to) params.set('to', to + 'T23:59:59.999Z')
  const state = useQuizFetch<QuizProduction[]>(`/quiz/productions?${params}`, true)
  return (
    <>
      <PageHeader title="Produções" description="Roteiros, vídeos, revisões e resultado de cada envio." />
      <QuizBoundary {...state} hasData={!!state.data}>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Field label="Etapa">
            {(id) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas as etapas</option>
                {Object.entries(quizStates).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Criação a partir de (UTC)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPage(1)
                }}
              />
            )}
          </Field>
          <Field label="Criação até (UTC)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(1)
                }}
              />
            )}
          </Field>
        </div>
        {state.data?.length ? <ProductionRows rows={state.data} /> : <EmptyState text="Nenhuma produção neste filtro." />}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm tabular-nums">Página {page}</span>
          <Button disabled={!state.data || state.data.length < 25} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      </QuizBoundary>
    </>
  )
}
