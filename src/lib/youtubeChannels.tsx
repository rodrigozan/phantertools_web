import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, apiUrl } from './api'
import { useAuth } from './auth'
import type { YoutubeChannel } from './types'

type State = { channels: YoutubeChannel[]; loading: boolean; error: boolean; reload: () => Promise<void> }

const Ctx = createContext<State>({ channels: [], loading: true, error: false, reload: async () => {} })

export function useYoutubeChannels() {
  return useContext(Ctx)
}

export function YoutubeChannelsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [channels, setChannels] = useState<YoutubeChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    try {
      const r = await api.get<YoutubeChannel[]>('/youtube/channels')
      setChannels(r.data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (user) reload()
  }, [user, reload])
  return <Ctx.Provider value={{ channels, loading, error, reload }}>{children}</Ctx.Provider>
}

export const youtubeConnectUrl = apiUrl('/youtube/connect')
