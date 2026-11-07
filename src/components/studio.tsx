import { useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2, Upload } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useToast } from './toast'
import { Banner, Button, Tag } from './ui'
import { Link } from 'react-router-dom'

const labels: Record<string, string> = {
  generating: 'Gerando',
  queued: 'Na fila',
  processing: 'Processando',
  rendering: 'Renderizando',
  done: 'Pronto',
  failed: 'Falhou',
  planning: 'Planejando',
  writing: 'Escrevendo',
  review: 'Precisa de revisão',
  visual_prompts: 'Criando cenas',
  images: 'Gerando imagens',
  narration: 'Narrando',
  metadata: 'Título e descrição',
  ready: 'Pronta para montar',
  assembling: 'Montando',
  completed: 'Concluída',
}

// Estado nunca só por cor: ícone e texto em todas as situações.
export function StatusTag({ status }: { status: string }) {
  const text = labels[status] ?? status
  if (status === 'done' || status === 'completed') return <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>{text}</Tag>
  if (status === 'failed') return <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>{text}</Tag>
  if (status === 'review' || status === 'ready') return <Tag tone="brand" icon={<Clock size={12} aria-hidden />}>{text}</Tag>
  return <Tag tone="warning" icon={<Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />}>{text}</Tag>
}

export function UploadButton({ url, accept, label, onDone }: { url: string; accept: string; label: string; onDone: () => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function send(files: FileList | null) {
    if (!files?.length) return
    const form = new FormData()
    Array.from(files).forEach((f) => form.append('files', f))
    setBusy(true)
    try {
      await api.post(url, form)
      toast({ tone: 'success', text: files.length > 1 ? `${files.length} arquivos enviados.` : 'Arquivo enviado.' })
      onDone()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input ref={input} type="file" multiple accept={accept} className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => send(e.target.files)} />
      <Button loading={busy} loadingText="Enviando..." icon={<Upload size={16} aria-hidden />} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  )
}

export function MissingKeys({ children }: { children: ReactNode }) {
  return (
    <Banner tone="warning" action={<Link to="/integracoes/chaves" className="font-medium underline">Abrir chaves</Link>}>
      {children}
    </Banner>
  )
}

export function Section({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
