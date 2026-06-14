import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Service {
  name: string
  displayName: string
  status: string
  startType: string
}

export function ServicesTab({ hostname }: { hostname: string }) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Running' | 'Stopped'>('All')

  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ['services', hostname],
    queryFn: async () => {
      const res = await api.get<Service[]>(`/Services/${hostname}`)
      return res.data
    },
    refetchInterval: 30000
  })

  const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    if (action === 'stop' && !confirm(`Are you sure you want to stop ${serviceName}?`)) return
    try {
      await api.post(`/Services/${hostname}/${serviceName}/${action}`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />
  if (!services) return <div className="text-muted-foreground p-4">Could not fetch services.</div>

  const filtered = services.filter(s => {
    const matchesText = s.name.toLowerCase().includes(filter.toLowerCase()) ||
                        s.displayName.toLowerCase().includes(filter.toLowerCase())
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter
    return matchesText && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <Input
          placeholder="Filter services..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex space-x-2">
          <Button variant={statusFilter === 'All' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('All')}>All</Button>
          <Button variant={statusFilter === 'Running' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('Running')}>Running</Button>
          <Button variant={statusFilter === 'Stopped' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('Stopped')}>Stopped</Button>
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Start Type</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(s => (
              <tr key={s.name} className="hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{s.displayName}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.name}</td>
                <td className="px-4 py-2">
                  <Badge variant={s.status === 'Running' ? 'default' : 'secondary'} className={s.status === 'Running' ? 'bg-green-600' : ''}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-4 py-2">{s.startType}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  {s.status === 'Running' ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleAction(s.name, 'restart')}>Restart</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleAction(s.name, 'stop')}>Stop</Button>
                    </>
                  ) : (
                    <Button variant="default" size="sm" onClick={() => handleAction(s.name, 'start')}>Start</Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No services matched criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
