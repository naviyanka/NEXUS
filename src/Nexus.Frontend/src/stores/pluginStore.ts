import { create } from 'zustand'
import { api } from '@/lib/axios'

interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  entryPoint: string
}

interface PluginState {
  plugins: PluginManifest[]
  isLoading: boolean
  fetchPlugins: () => Promise<void>
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  isLoading: false,
  fetchPlugins: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get<PluginManifest[]>('/plugins')
      set({ plugins: response.data, isLoading: false })
    } catch {
      set({ plugins: [], isLoading: false })
    }
  }
}))
