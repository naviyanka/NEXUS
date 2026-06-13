import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { SPFarm, SPUlsLog } from '@/types/sharepoint'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Play, Pause } from 'lucide-react'

export function UlsTab({ farm }: { farm: SPFarm }) {
  const [targetHost, setTargetHost] = useState(farm.wfeHost)
  const [filter, setFilter] = useState('')
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['uls-logs', targetHost],
    queryFn: async () => {
      const res = await api.get<SPUlsLog[]>(`/SharePoint/uls/${targetHost}`)
      return res.data
    },
    refetchInterval: isAutoRefresh ? 10000 : false
  })

  const getRowClass = (level: string) => {
    if (level === 'Unexpected' || level === 'Critical') return 'bg-red-500/10 text-red-500'
    if (level === 'High' || level === 'Warning') return 'bg-yellow-500/10 text-yellow-500'
    return 'hover:bg-muted/50 text-muted-foreground'
  }

  const filteredLogs = logs?.filter(l =>
    l.Message?.toLowerCase().includes(filter.toLowerCase()) ||
    l.Category?.toLowerCase().includes(filter.toLowerCase()) ||
    l.Area?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shrink-0">
        <div className="flex space-x-2">
          <Button variant={targetHost === farm.wfeHost ? 'default' : 'outline'} onClick={() => setTargetHost(farm.wfeHost)}>{farm.wfeHost}</Button>
          <Button variant={targetHost === farm.appHost ? 'default' : 'outline'} onClick={() => setTargetHost(farm.appHost)}>{farm.appHost}</Button>
        </div>
        <div className="flex space-x-2">
          <Input
            placeholder="Search message or category..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-[300px]"
          />
          <Button variant="outline" onClick={() => setIsAutoRefresh(!isAutoRefresh)}>
            {isAutoRefresh ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Auto
          </Button>
          <Button variant="secondary" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card flex-1 flex flex-col max-h-[600px]">
        {isLoading ? <Skeleton className="h-full w-full" /> : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium w-[140px]">Time</th>
                  <th className="px-3 py-2 font-medium w-[100px]">Level</th>
                  <th className="px-3 py-2 font-medium w-[120px]">Area</th>
                  <th className="px-3 py-2 font-medium w-[120px]">Category</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {filteredLogs?.map((l, i) => (
                  <tr key={i} className={getRowClass(l.Level)}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.Timestamp).toLocaleTimeString()}</td>
                    <td className="px-3 py-2">{l.Level}</td>
                    <td className="px-3 py-2 truncate max-w-[120px]" title={l.Area}>{l.Area}</td>
                    <td className="px-3 py-2 truncate max-w-[120px]" title={l.Category}>{l.Category}</td>
                    <td className="px-3 py-2 break-all">{l.Message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
