import { useEffect, useState } from 'react'
import { Folder, X } from 'lucide-react'
import { api } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { Button } from './ui'
import type { DriveStatus } from './DriveMusicLibrary'
import { DriveFolderPicker, type DriveFolder } from './DriveFolderPicker'
export function DriveFolderField({ values, onChange, single = false }: { values: string[]; onChange: (values: string[]) => void; single?: boolean }) {
  const connection = useFetch<DriveStatus>('/drive/status')
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const ids = values.join(',')
  useEffect(() => {
    if (!connection.data?.connected) return
    let live = true
    void Promise.all(values.map(async id => {
      try { const { data } = await api.get<DriveFolder>(`/drive/folders/${encodeURIComponent(id)}`); return [id, data.name] as const }
      catch { return [id, 'Pasta indisponível nesta conta'] as const }
    })).then(entries => { if (live) setNames(Object.fromEntries(entries)) })
    return () => { live = false }
  }, [ids, connection.data?.connected])
  return <div>
    {values.length > 0 && <ul className="mb-2 space-y-2">{values.map(id => <li key={id} className="flex items-center gap-2 rounded-control bg-surface-2 p-2 text-sm">
      <Folder size={16} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 break-words">{names[id] ?? 'Pasta selecionada'}</span>
      <button type="button" aria-label={`Remover ${names[id] ?? 'pasta'}`} className="p-1 text-muted" onClick={() => onChange(values.filter(value => value !== id))}><X size={16} /></button>
    </li>)}</ul>}
    <Button type="button" disabled={!connection.data?.connected || (!single && values.length >= 10)} icon={<Folder size={16} />} onClick={() => setOpen(true)}>{single && values.length ? 'Trocar pasta no Drive' : 'Escolher pasta no Drive'}</Button>
    {!connection.loading && !connection.data?.connected && <p className="mt-2 text-sm text-muted">Conecte o Google Drive acima para escolher uma pasta.</p>}
    <DriveFolderPicker open={open} onClose={() => setOpen(false)} onSelect={folder => { setNames(previous => ({ ...previous, [folder.id]: folder.name })); onChange(single ? [folder.id] : [...new Set([...values, folder.id])]) }} />
  </div>
}
