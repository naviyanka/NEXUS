import { create } from 'zustand'
import { api } from '@/lib/axios'

export interface MachineGroup {
  id: number
  name: string
}

export interface Machine {
  id: number
  hostname: string
  description?: string
  machineGroupId: number
  machineGroup?: MachineGroup
}

interface MachineState {
  machines: Machine[]
  groups: MachineGroup[]
  isLoading: boolean
  fetchMachines: () => Promise<void>
  fetchGroups: () => Promise<void>
}

export const useMachineStore = create<MachineState>((set) => ({
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
  }
}))
