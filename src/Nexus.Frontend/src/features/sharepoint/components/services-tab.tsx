import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { SPFarm, SPServiceInstance } from '@/types/sharepoint'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function ServicesTab({ farm }: { farm: SPFarm }) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline'>('All')

  // We query the WFE, but SP cmdlets return the whole farm usually.
  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ['sp-services', farm.name],
    queryFn: async () => {
      const res = await api.get<SPServiceInstance[]>(`/SharePoint/services/${farm.wfeHost}`)
      return res.data
    },
    refetchInterval: 30000
  })

  const handleAction = async (typeName: string, action: 'start' | 'stop') => {
    if (action === 'stop' && !confirm(`Stop SharePoint service instance ${typeName}?`)) return
    try {
      await api.post(`/SharePoint/services/${farm.wfeHost}/${encodeURIComponent(typeName)}/${action}`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />
  if (!services) return <div className="p-4 text-muted-foreground">Unable to query SharePoint Services.</div>

  const filtered = services.filter(s => {
    const matchesText = s.TypeName.toLowerCase().includes(filter.toLowerCase())
    const matchesStatus = statusFilter === 'All' ||
                         (statusFilter === 'Online' && s.Status === 'Online') ||
                         (statusFilter === 'Offline' && s.Status !== 'Online')
    return matchesText && matchesStatus
  })

  const wfeServices = filtered.filter(s => s.Server.includes(farm.wfeHost))
  const appServices = filtered.filter(s => s.Server.includes(farm.appHost))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <Input
          placeholder="Filter by service name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex space-x-2">
          <Button variant={statusFilter === 'All' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('All')}>All</Button>
          <Button variant={statusFilter === 'Online' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('Online')}>Online</Button>
          <Button variant={statusFilter === 'Offline' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('Offline')}>Offline</Button>
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* WFE Panel */}
        <div className="border rounded-md bg-card">
          <div className="p-3 border-b bg-muted/50 font-semibold">{farm.wfeHost} Services</div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {wfeServices.map((s, i) => (
                <tr key={i} className="hover:bg-muted/50">
                  <td className="p-2 w-full truncate max-w-[200px]" title={s.TypeName}>{s.TypeName}</td>
                  <td className="p-2"><Badge className={s.Status === 'Online' ? 'bg-green-600' : 'bg-red-600'}>{s.Status}</Badge></td>
                  <td className="p-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleAction(s.TypeName, s.Status === 'Online' ? 'stop' : 'start')}>
                      {s.Status === 'Online' ? 'Stop' : 'Start'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* APP Panel */}
        <div className="border rounded-md bg-card">
          <div className="p-3 border-b bg-muted/50 font-semibold">{farm.appHost} Services</div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {appServices.map((s, i) => (
                <tr key={i} className="hover:bg-muted/50">
                  <td className="p-2 w-full truncate max-w-[200px]" title={s.TypeName}>{s.TypeName}</td>
                  <td className="p-2"><Badge className={s.Status === 'Online' ? 'bg-green-600' : 'bg-red-600'}>{s.Status}</Badge></td>
                  <td className="p-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleAction(s.TypeName, s.Status === 'Online' ? 'stop' : 'start')}>
                      {s.Status === 'Online' ? 'Stop' : 'Start'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
