import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Folder, Search } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { Button, Input, Modal } from './ui'
export type DriveFolder = { id: string; name: string; parents?: string[] }
export function DriveFolderPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (folder: DriveFolder) => void }) {
  const [trail, setTrail] = useState<DriveFolder[]>([])
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [shared, setShared] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [next, setNext] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = trail[trail.length - 1]
  useEffect(() => {
    if (!open) return
    let live = true
    setBusy(true); setError(''); setFolders([]); setNext(undefined)
    const params = { ...(current ? { parent: current.id } : {}), ...(search ? { search } : {}), shared: String(shared) }
    api.get<{ folders: DriveFolder[]; nextPageToken?: string }>('/drive/folders', { params }).then(({ data }) => {
      if (live) { setFolders(data.folders); setNext(data.nextPageToken) }
    }).catch(err => { if (live) setError(errorInfo(err).message) }).finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [open, current?.id, search, shared])
  async function more() {
    setBusy(true); setError('')
    try {
      const { data } = await api.get<{ folders: DriveFolder[]; nextPageToken?: string }>('/drive/folders', { params: { ...(current ? { parent: current.id } : {}), ...(search ? { search } : {}), shared: String(shared), pageToken: next } })
      setFolders(previous => [...previous, ...data.folders]); setNext(data.nextPageToken)
    } catch (err) { setError(errorInfo(err).message) }
    finally { setBusy(false) }
  }
  return <Modal open={open} title="Escolher pasta no Google Drive" onClose={onClose}>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={() => { setTrail([]); setShared(false); setSearch(''); setQuery('') }}>Meu Drive</Button>
      <Button type="button" disabled={busy} onClick={() => { setTrail([]); setShared(true); setSearch(''); setQuery('') }}>Compartilhadas comigo</Button>
    </div>
    <div className="mt-3 flex gap-2">
      <Input className="min-w-0" disabled={busy} aria-label="Buscar pasta pelo nome" type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setSearch(query.trim()) } }} placeholder="Buscar pasta pelo nome" />
      <Button type="button" aria-label="Buscar pastas" icon={<Search size={16} />} disabled={busy} onClick={() => setSearch(query.trim())}>Buscar</Button>
    </div>
    <div className="mt-4 flex items-center gap-2 text-sm">
      {trail.length > 0 && <Button type="button" aria-label="Voltar à pasta anterior" icon={<ChevronLeft size={16} />} disabled={busy} onClick={() => { setTrail(previous => previous.slice(0, -1)); setSearch(''); setQuery('') }}>Voltar</Button>}
      <p className="min-w-0 break-words font-medium">{search ? `Busca: ${search}` : current?.name ?? (shared ? 'Compartilhadas comigo' : 'Meu Drive')}</p>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
    <ul aria-label="Pastas do Google Drive" className="my-3 max-h-72 overflow-y-auto divide-y divide-border">
      {folders.map(folder => <li key={folder.id} className="flex items-center gap-2 py-2">
        <Folder size={18} className="shrink-0 text-muted" aria-hidden />
        <button type="button" disabled={busy} className="min-w-0 flex-1 break-words text-left text-sm hover:underline" onClick={() => { setTrail(previous => [...previous, folder]); setSearch(''); setQuery('') }}>{folder.name}</button>
        <Button type="button" disabled={busy} onClick={() => { onSelect(folder); onClose() }}>Escolher</Button>
        <button type="button" disabled={busy} aria-label={`Abrir ${folder.name}`} className="shrink-0 p-2 text-muted" onClick={() => { setTrail(previous => [...previous, folder]); setSearch(''); setQuery('') }}><ChevronRight size={16} /></button>
      </li>)}
    </ul>
    {busy && <p role="status" className="text-sm text-muted">Carregando pastas…</p>}
    {!busy && !error && folders.length === 0 && <p className="mb-3 text-sm text-muted">Nenhuma pasta encontrada. Tente buscar pelo nome ou abrir outra pasta.</p>}
    {next && <Button type="button" disabled={busy} onClick={() => void more()}>Carregar mais pastas</Button>}
    <div className="mt-4 flex flex-wrap gap-2">
      {current && !search && <Button type="button" variant="primary" disabled={busy} onClick={() => { onSelect(current); onClose() }}>Usar esta pasta</Button>}
      <Button type="button" onClick={onClose}>Cancelar</Button>
    </div>
  </Modal>
}
