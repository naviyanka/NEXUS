import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMachineStore } from '@/stores/machineStore'
import { api } from '@/lib/axios'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMachineDialog({ open, onOpenChange }: Props) {
  const { groups, fetchMachines } = useMachineStore()
  const [hostname, setHostname] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!hostname) return
    setLoading(true)
    try {
      await api.post('/Machine', {
        hostname,
        displayName,
        role,
        machineGroupId: parseInt(groupId) || 1, // Defaulting for simple fallback
        tags: '',
        icon: 'server',
        lastKnownStatus: 'Unknown'
      })
      await fetchMachines()
      onOpenChange(false)
      setHostname('')
      setDisplayName('')
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Machine</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Hostname</span>
            <Input className="col-span-3" value={hostname} onChange={e => setHostname(e.target.value)} placeholder="SRV-01" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Display</span>
            <Input className="col-span-3" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="File Server" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Role</span>
            <Input className="col-span-3" value={role} onChange={e => setRole(e.target.value)} placeholder="WFE / APP / DC" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Group ID</span>
            <select className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">Select Group...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={loading}>{loading ? 'Adding...' : 'Add Machine'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
