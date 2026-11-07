import { useState } from 'react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useToast } from '../components/toast'
import { Banner, Button, Card, ErrorCard, Field, Input, PageHeader, Select, SkeletonList, Tag } from '../components/ui'

type Setting = {
  key: string
  label: string
  group: string
  secret: boolean
  hint: string | null
  set: boolean
  last4: string | null
  value: string | null
  fallback: string | null
  options: string[] | null
  fromEnv: boolean
}

const groupHelp: Record<string, string> = {
  Voz: 'Reels e vídeos Phanterai: ElevenLabs, voz Rod. Histórias: você escolhe quem narra primeiro e o outro vira reserva. Quizzes: OpenRouter, com reserva no ElevenLabs (voz narrador).',
  Imagens: 'Capas e cenas geradas pelo Gemini.',
  Música: 'Suno é o principal; o Replicate entra quando o Suno falha.',
  Narrativas: 'Roteiro, voz e imagens das narrativas longas, tudo pelo OpenRouter.',
}

export default function StudioKeysPage() {
  const toast = useToast()
  const list = useFetch<{ settings: Setting[] }>('/studio/settings')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [cleared, setCleared] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const settings = list.data?.settings ?? []
  const groups = [...new Set(settings.map((s) => s.group))]
  const dirty = Object.values(draft).some((v) => v.trim()) || cleared.length > 0

  async function save() {
    setSaving(true)
    setErrors({})
    try {
      const values: Record<string, string> = {}
      for (const [k, v] of Object.entries(draft)) if (v.trim()) values[k] = v
      for (const k of cleared) values[k] = ''
      const r = await api.put<{ settings: Setting[] }>('/studio/settings', { values })
      list.setData(r.data)
      setDraft({})
      setCleared([])
      toast({ tone: 'success', text: 'Chaves salvas.' })
    } catch (err) {
      const info = errorInfo(err)
      setErrors(info.fields)
      if (!Object.keys(info.fields).length) toast({ tone: 'error', text: info.message })
    } finally {
      setSaving(false)
    }
  }

  const edit = (s: Setting, value: string) => {
    setCleared((c) => c.filter((k) => k !== s.key))
    setDraft((d) => ({ ...d, [s.key]: value }))
  }
  const toggleClear = (s: Setting) => {
    setDraft((d) => {
      const { [s.key]: _drop, ...rest } = d
      return rest
    })
    setCleared((c) => (c.includes(s.key) ? c.filter((k) => k !== s.key) : [...c, s.key]))
  }

  return (
    <div>
      <PageHeader
        title="Chaves do Estúdio"
        description="Chaves e modelos usados para gerar imagens, músicas, vídeos e narrativas. Ficam no banco, criptografadas, e nunca voltam para esta tela."
        actions={
          <Button variant="primary" loading={saving} loadingText="Salvando..." disabled={!dirty} onClick={save}>
            Salvar alterações
          </Button>
        }
      />
      <Banner tone="warning">Campos em branco não mudam nada. Para remover uma chave ou voltar um modelo ao padrão, use Apagar e salve.</Banner>
      {list.loading && !list.data ? (
        <SkeletonList rows={5} />
      ) : list.error ? (
        <ErrorCard message={list.error} onRetry={list.reload} />
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g} className="p-5">
              <h2 className="text-lg font-semibold">{g}</h2>
              <p className="mt-1 text-sm text-muted">{groupHelp[g]}</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {settings
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <Field key={s.key} label={s.label} error={errors[s.key]} hint={s.hint ?? undefined}>
                      {(id, desc) => (
                        <div className="flex flex-col gap-1.5">
                          {s.options ? (
                            <Select
                              id={id}
                              aria-describedby={desc}
                              disabled={cleared.includes(s.key)}
                              value={draft[s.key] ?? s.value ?? s.fallback ?? ''}
                              onChange={(e) => edit(s, e.target.value)}
                            >
                              {s.options.map((o) => (
                                <option key={o} value={o}>{o === 'openrouter' ? 'OpenRouter' : o === 'elevenlabs' ? 'ElevenLabs' : o}</option>
                              ))}
                            </Select>
                          ) : (
                          <Input
                              id={id}
                              aria-describedby={desc}
                              aria-invalid={Boolean(errors[s.key]) || undefined}
                              type={s.secret ? 'password' : 'text'}
                              autoComplete="off"
                              spellCheck={false}
                              placeholder={s.secret ? (s.set ? 'Colar para trocar' : 'Colar a chave') : (s.fallback ?? '')}
                              disabled={cleared.includes(s.key)}
                              value={cleared.includes(s.key) ? '' : (draft[s.key] ?? (s.secret ? '' : (s.value ?? '')))}
                              onChange={(e) => edit(s, e.target.value)}
                            />
                          )}
                          <span className="flex flex-wrap items-center gap-1.5">
                            {cleared.includes(s.key) ? (
                              <Tag tone="error">Será apagada ao salvar</Tag>
                            ) : s.secret ? (
                              s.set ? (
                                <Tag tone="success">Cadastrada · termina em {s.last4}</Tag>
                              ) : s.fromEnv ? (
                                <Tag tone="warning">Só no .env do servidor</Tag>
                              ) : (
                                <Tag tone="neutral">Não cadastrada</Tag>
                              )
                            ) : s.set ? (
                              <Tag tone="brand">Personalizado</Tag>
                            ) : (
                              <Tag tone="neutral">Padrão</Tag>
                            )}
                            {s.set && (
                              <button type="button" onClick={() => toggleClear(s)} className="text-xs text-muted underline hover:text-ink">
                                {cleared.includes(s.key) ? 'Desfazer' : 'Apagar'}
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                    </Field>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
