import { useEffect, useState, type FormEvent } from 'react'
import { Music } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { Button, Card, Field, Input } from './ui'

export function DriveMusicLibrary({ automationId, initialFolder, onImported }: { automationId?: string; initialFolder?: string; onImported: (folder: string) => void }) {
  const library = useFetch<{ files: string[] }>('/weekly/music')
  const [folder, setFolder] = useState(initialFolder ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  useEffect(() => { setFolder(initialFolder ?? '') }, [initialFolder])
  async function importMusic(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setResult('')
    try {
      const { data } = await api.post<{ downloaded: number; total: number; folder: string }>('/weekly/music/import', { folder, ...(automationId ? { automationId } : {}) })
      setResult(`${data.downloaded} músicas importadas. ${data.total} faixas disponíveis para os vídeos.`)
      await library.reload(); onImported(data.folder)
    } catch (err) { setError(errorInfo(err).message) }
    finally { setBusy(false) }
  }
  return <Card className="mb-5 p-5">
    <h2 className="font-semibold">Músicas do Google Drive</h2>
    <p className="mt-1 text-sm text-muted">Importe suas trilhas. Cada vídeo recebe uma música da biblioteca, com a fala preservada e volume de fundo entre 15% e 20%.</p>
    <form onSubmit={importMusic} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <Field label="Pasta com as músicas" hint="Cole o link da pasta do Google Drive. Apenas arquivos de áudio serão importados.">
        {(id, desc) => <Input id={id} aria-describedby={desc} required value={folder} onChange={e => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" disabled={busy} />}
      </Field>
      <Button type="submit" icon={<Music size={16} />} loading={busy}>Importar músicas do Drive</Button>
    </form>
    {busy && <p role="status" className="mt-3 text-sm text-muted">Importando as músicas. Aguarde a conclusão sem fechar esta página.</p>}
    {error && <p role="alert" className="mt-3 break-words text-sm text-negative">{error}</p>}
    {result && <p role="status" className="mt-3 text-sm">{result}</p>}
    <div className="mt-4">
      <p className="text-sm font-medium">Biblioteca · {library.data?.files.length ?? 0} faixas</p>
      {library.loading ? <p className="mt-1 text-sm text-muted">Carregando músicas…</p> : library.error ? <p role="alert" className="text-sm text-negative">{library.error}</p> : library.data?.files.length ?
        <ul className="mt-2 max-h-48 overflow-y-auto space-y-2">{library.data.files.map(name => <li key={name} className="break-words text-sm">{name}</li>)}</ul> :
        <p className="mt-1 text-sm text-muted">Nenhuma faixa importada. Importe a pasta antes de iniciar o processamento.</p>}
    </div>
  </Card>
}
