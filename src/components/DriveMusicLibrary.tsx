import { useEffect, useState } from 'react'
import { Folder, Music } from 'lucide-react'
import { api, apiUrl, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { Button, Card, ConfirmDialog } from './ui'
import { DriveFolderPicker, type DriveFolder } from './DriveFolderPicker'
export type DriveStatus = { configured: boolean; connected: boolean; status: string; email?: string; musicFolder?: DriveFolder | null }
const oauthMessages: Record<string, string> = {
  connected: 'Google Drive conectado. Agora escolha sua pasta de músicas.',
  denied: 'A conexão não foi autorizada. Você pode conectar o Google Drive quando quiser.',
  invalid_state: 'A conexão expirou. Clique em Conectar Google Drive para tentar novamente.',
  permission_missing: 'A permissão de leitura do Drive não foi autorizada. Reconecte e permita esse acesso.',
  failed: 'Não foi possível conectar o Google Drive. Tente novamente.',
}
export function DriveMusicLibrary({ automationId, initialFolder, onImported }: { automationId?: string; initialFolder?: string; onImported: (folder: string) => void }) {
  const connection = useFetch<DriveStatus>('/drive/status')
  const library = useFetch<{ files: string[] }>('/drive/music')
  const [selected, setSelected] = useState<DriveFolder | null>(null)
  const [picker, setPicker] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const connected = connection.data?.connected
  const initial = initialFolder || connection.data?.musicFolder?.id
  const oauthQuery = new URLSearchParams(window.location.search)
  const oauthResult = oauthQuery.get('drive')
  const oauthCode = oauthQuery.get('code')
  const safeOauthCode = oauthCode && /^[A-Za-z_]{1,80}$/.test(oauthCode) ? oauthCode : null
  useEffect(() => {
    if (!connected || !initial) { setSelected(null); return }
    let live = true
    api.get<DriveFolder>(`/drive/folders/${encodeURIComponent(initial)}`).then(({ data }) => { if (live) setSelected(data) }).catch(err => { if (live) setError(errorInfo(err).message) })
    return () => { live = false }
  }, [connected, initial])
  async function importMusic() {
    if (!selected) return
    setBusy(true); setError(''); setResult('')
    try {
      const { data } = await api.post<{ downloaded: number; total: number; folder: DriveFolder }>('/drive/music/import', { folderId: selected.id, ...(automationId ? { automationId } : {}) })
      setResult(`${data.downloaded} músicas importadas. ${data.total} faixas disponíveis na sua biblioteca.`)
      await library.reload(); await connection.reload(); onImported(data.folder.id)
    } catch (err) { setError(errorInfo(err).message); void connection.reload() }
    finally { setBusy(false) }
  }
  async function disconnect() {
    setBusy(true); setError('')
    try { await api.delete('/drive/connection'); setSelected(null); setResult('Google Drive desconectado. As automações desta conta foram pausadas.'); await connection.reload() }
    catch (err) { setError(errorInfo(err).message) }
    finally { setBusy(false); setDisconnecting(false) }
  }
  return <Card className="mb-5 p-5">
    <h2 className="font-semibold">Google Drive e músicas</h2>
    <p className="mt-1 text-sm text-muted">Conecte sua conta Google, escolha a pasta e importe as músicas para usar nos seus vídeos.</p>
    {oauthResult && oauthMessages[oauthResult] && <p role="status" className="mt-3 text-sm">{oauthMessages[oauthResult]}{safeOauthCode && oauthResult !== 'connected' ? ` [${safeOauthCode}]` : ''}</p>}
    {connection.loading && !connection.data ? <p className="mt-3 text-sm text-muted">Verificando conexão…</p> : connected ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 break-all text-sm">Conectado como <strong>{connection.data?.email}</strong></p>
      <Button type="button" disabled={busy} onClick={() => setDisconnecting(true)}>Desconectar</Button>
    </div> : <div className="mt-4">
      <Button type="button" variant="primary" disabled={!connection.data?.configured || busy} onClick={() => { window.location.assign(apiUrl(`/drive/connect?next=${encodeURIComponent(window.location.pathname)}`)) }}>{connection.data?.status === 'expired' ? 'Reconectar Google Drive' : 'Conectar Google Drive'}</Button>
      {connection.data && !connection.data.configured && <p className="mt-2 text-sm text-negative">Integração indisponível no momento. Contate o administrador.</p>}
      <p className="mt-2 text-sm text-muted">O Google pedirá sua autorização de leitura. Sua senha não é compartilhada com o Phantertools.</p>
    </div>}
    {connected && <div className="mt-5">
      <p className="text-sm font-medium">Pasta de músicas</p>
      <p className="mt-1 break-words text-sm text-muted">{selected?.name ?? 'Escolha a pasta na sua conta Google Drive.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" icon={<Folder size={16} />} disabled={busy} onClick={() => setPicker(true)}>{selected ? 'Trocar pasta' : 'Escolher pasta no Drive'}</Button>
        {selected && <Button type="button" variant="primary" icon={<Music size={16} />} loading={busy} onClick={() => void importMusic()}>Importar músicas</Button>}
      </div>
    </div>}
    {busy && <p role="status" className="mt-3 text-sm text-muted">Aguarde a conclusão da operação.</p>}
    {(error || connection.error) && <p role="alert" className="mt-3 break-words text-sm text-negative">{error || connection.error}</p>}
    {result && <p role="status" className="mt-3 text-sm">{result}</p>}
    <div className="mt-4">
      <p className="text-sm font-medium">Sua biblioteca · {library.data?.files.length ?? 0} faixas</p>
      {library.loading ? <p className="mt-1 text-sm text-muted">Carregando músicas…</p> : library.error ? <p role="alert" className="text-sm text-negative">{library.error}</p> : library.data?.files.length ?
        <ul className="mt-2 max-h-48 overflow-y-auto space-y-2">{library.data.files.map((name, i) => <li key={`${i}-${name}`} className="break-words text-sm">{name}</li>)}</ul> :
        <p className="mt-1 text-sm text-muted">Nenhuma música importada nesta conta.</p>}
    </div>
    <DriveFolderPicker open={picker} onClose={() => setPicker(false)} onSelect={folder => { setSelected(folder); setError(''); setResult('') }} />
    <ConfirmDialog open={disconnecting} title="Desconectar Google Drive?" message="As automações da sua conta serão pausadas. As músicas já importadas continuam na sua biblioteca." confirmLabel="Desconectar" loading={busy} onConfirm={() => void disconnect()} onClose={() => setDisconnecting(false)} />
  </Card>
}
