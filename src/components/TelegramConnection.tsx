import { useState, type FormEvent } from 'react'
import { api, errorInfo } from '../lib/api'
import { Button, Card, Field, Input } from './ui'

type Login = { id: string; step: 'code' | 'password'; viaApp: boolean }
export function TelegramConnection() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [value, setValue] = useState('')
  const [login, setLogin] = useState<Login | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!login) {
        const { data } = await api.post<Login>('/telegram/login/start', { phone: phone.replace(/[\s()-]/g, '') })
        setLogin(data)
      } else {
        const { data } = await api.post<{ step: 'password' | 'connected' }>('/telegram/login/verify', { id: login.id, value })
        if (data.step === 'connected') {
          setConnected(true)
          setOpen(false)
          setLogin(null)
          setPhone('')
        } else setLogin({ ...login, step: 'password' })
      }
    } catch (err) {
      setError(errorInfo(err).message)
    } finally {
      setValue('')
      setBusy(false)
    }
  }
  async function cancel() {
    setBusy(true)
    setError('')
    try {
      if (login) await api.post('/telegram/login/cancel', { id: login.id })
    } catch {
      // A tentativa também expira no servidor; fechar não conserva código ou senha.
    } finally {
      setLogin(null)
      setValue('')
      setPhone('')
      setOpen(false)
      setBusy(false)
    }
  }
  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-semibold">Conexão com o Telegram</h2>
          <p className="mt-1 text-sm text-muted" role="status">
            {connected
              ? 'Telegram reconectado. As automações ativas retomam na próxima verificação.'
              : 'Se a sessão perdeu o acesso, reconecte sua conta aqui pelo celular.'}
          </p>
        </div>
        {!open && <Button onClick={() => { setOpen(true); setConnected(false); setError('') }}>Reconectar Telegram</Button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-5 grid max-w-lg gap-4">
          {!login ? (
            <Field label="Seu telefone do Telegram" hint="Inclua +55, DDD e número. Exemplo: +5511999999999.">
              {(id, desc) => <Input id={id} aria-describedby={desc} type="tel" autoComplete="tel" placeholder="+55" required maxLength={24} value={phone} disabled={busy} onChange={e => setPhone(e.target.value)} />}
            </Field>
          ) : login.step === 'code' ? (
            <Field label="Código de acesso" hint={login.viaApp ? 'Abra o aplicativo Telegram e procure a mensagem de serviço com o código. Depois volte a esta página.' : 'Confira o código enviado pelo Telegram para seu número e volte a esta página.'}>
              {(id, desc) => <Input key="code" id={id} aria-describedby={desc} type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={12} value={value} disabled={busy} onChange={e => setValue(e.target.value.replace(/\s/g, ''))} />}
            </Field>
          ) : (
            <Field label="Senha de verificação em duas etapas" hint="É a senha que você criou no Telegram. Ela é usada neste login e não fica salva.">
              {(id, desc) => <Input key="password" id={id} aria-describedby={desc} type="password" autoComplete="off" required autoFocus maxLength={256} value={value} disabled={busy} onChange={e => setValue(e.target.value)} />}
            </Field>
          )}
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy}>{!login ? 'Receber código' : login.step === 'code' ? 'Confirmar código' : 'Conectar Telegram'}</Button>
            <Button type="button" disabled={busy} onClick={() => void cancel()}>Cancelar</Button>
          </div>
          <p className="text-sm text-muted">Informe seus dados apenas neste formulário. Não envie código ou senha pelo chat. O login expira após cinco minutos.</p>
        </form>
      )}
    </Card>
  )
}
