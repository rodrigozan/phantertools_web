import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import { api, apiUrl, errorInfo } from '../lib/api'
import { Button, Card, Field, Input, PageHeader } from '../components/ui'

type Item = { id: string; platform: 'instagram' | 'tiktok' | 'youtube'; url: string; title?: string; sizeBytes?: number; status: 'queued' | 'downloading' | 'ready' | 'failed'; error?: string; expiresAt: string }
const platforms = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }
const states = { queued: 'Na fila', downloading: 'Baixando e preparando MP4', ready: 'Pronto para baixar', failed: 'Falhou' }
const bytes = (n: number) => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`

export default function DownloadsPage() {
  const [url, setUrl] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const refresh = useCallback(async () => {
    try { const { data } = await api.get<Item[]>('/downloads'); setItems(data); setListError('') }
    catch (e) { setListError(errorInfo(e).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { void refresh() }, 4000); return () => window.clearInterval(timer) }, [refresh])
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.post('/downloads', { url }); setUrl(''); await refresh() }
    catch (e) { setError(errorInfo(e).message) }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    try { await api.delete(`/downloads/${id}`); await refresh() }
    catch (e) { setListError(errorInfo(e).message) }
  }
  return <>
    <PageHeader title="Downloads de vídeos" description="Instagram, TikTok e YouTube — Reels, Shorts e vídeos longos." />
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Link do vídeo" hint="Cole o link de um vídeo público. Sem limite de tamanho ou duração; transmissões ao vivo em andamento não são aceitas." error={error}>
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} aria-invalid={!!error} type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={busy} icon={<Download size={16} />}>Preparar download</Button>
          <p className="text-sm text-muted">MP4 com áudio · Arquivo disponível por 24 horas após ficar pronto.</p>
        </div>
      </form>
    </Card>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Seus downloads</h2>
      <Button icon={<RefreshCw size={16} />} onClick={() => void refresh()}>Atualizar</Button>
    </div>
    {listError && <p role="alert" className="mb-3 text-sm text-negative">{listError}</p>}
    <Card className="divide-y divide-border" aria-live="polite">
      {loading ? <p role="status" className="p-5 text-sm text-muted">Carregando downloads…</p> : !items.length ? <p className="p-5 text-sm text-muted">Nenhum download ainda. Cole um link acima para começar.</p> : items.map(item => <div key={item.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="break-words font-medium">{item.title || `Vídeo do ${platforms[item.platform]}`}</p>
          <p className="mt-1 text-sm text-muted">{platforms[item.platform]} · {states[item.status]}{item.sizeBytes ? ` · ${bytes(item.sizeBytes)}` : ''}</p>
          <p className="mt-1 break-all text-xs text-faint">{item.url}</p>
          {item.status === 'ready' && <p className="mt-1 text-xs text-faint">Disponível até {new Date(item.expiresAt).toLocaleString('pt-BR')}</p>}
          {item.error && <p className="mt-2 text-sm text-negative">{item.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.status === 'ready' && <a className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-3 text-sm font-medium text-on-primary" href={apiUrl(`/downloads/${item.id}/file`)} download><Download size={16} /> Baixar MP4</a>}
          {item.status === 'failed' && <Button onClick={() => { setUrl(item.url); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Tentar novamente</Button>}
          {(item.status === 'failed' || item.status === 'ready') && <Button aria-label="Remover download" icon={<Trash2 size={16} />} onClick={() => void remove(item.id)} />}
        </div>
      </div>)}
    </Card>
  </>
}
