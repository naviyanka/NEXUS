import { create } from 'zustand'
import { api } from '@/lib/axios'

interface AuthState {
  isAuthenticated: boolean
  username: string | null
  isLoading: boolean
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  isLoading: true,
  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me')
      set({ isAuthenticated: true, username: response.data.username, isLoading: false })
    } catch {
      set({ isAuthenticated: false, username: null, isLoading: false })
    }
  }
}))
