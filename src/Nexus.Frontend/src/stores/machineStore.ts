import { create } from 'zustand'
import { api } from '@/lib/axios'

export interface MachineGroup {
  id: number
  name: string
}

export interface Machine {
  id: number
  hostname: string
  displayName: string
  description?: string
  tags: string
  role: string
  icon: string
  machineGroupId: number
  machineGroup?: MachineGroup
  lastSeenOnline?: string
  lastKnownStatus: string
}

interface MachineStatus {
  id: number
  hostname: string
  isOnline: boolean
  lastSeen?: string
}

interface MachineState {
  machines: Machine[]
  groups: MachineGroup[]
  isLoading: boolean
  fetchMachines: () => Promise<void>
  fetchGroups: () => Promise<void>
  pollStatus: () => Promise<void>
}

export const useMachineStore = create<MachineState>((set, get) => ({
  machines: [],
  groups: [],
  isLoading: false,
  fetchMachines: async () => {
    set({ isLoading: true })
    try {
      const res = await api.get<Machine[]>('/Machine')
      set({ machines: res.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
  fetchGroups: async () => {
    try {
      const res = await api.get<MachineGroup[]>('/MachineGroup')
      set({ groups: res.data })
    } catch {}
  },
  pollStatus: async () => {
    try {
      const res = await api.get<MachineStatus[]>('/Machine/status-all')
      const currentMachines = get().machines
      const updated = currentMachines.map(m => {
        const update = res.data.find(s => s.id === m.id)
        if (update) {
          return {
            ...m,
            lastSeenOnline: update.lastSeen || m.lastSeenOnline,
            lastKnownStatus: update.isOnline ? 'Online' : 'Offline'
          }
        }
        return m
      })
      set({ machines: updated })
    } catch (e) {
      console.error("Failed to poll status", e)
    }
  }
}))
