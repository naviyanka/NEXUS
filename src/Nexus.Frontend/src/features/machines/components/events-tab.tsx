import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Info, AlertTriangle, ShieldAlert } from 'lucide-react'

interface LogEvent {
  timeGenerated: string
  entryType: string
  source: string
  eventID: number
  message: string
}

export function EventsTab({ hostname }: { hostname: string }) {
  const [logType, setLogType] = useState('System')

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['events', hostname, logType],
    queryFn: async () => {
      const res = await api.get<LogEvent[]>(`/Maintenance/events/${hostname}?log=${logType}&count=50`)
      return res.data
    }
  })

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />

  const getIcon = (type: string) => {
    if (type === 'Error') return <ShieldAlert className="h-4 w-4 text-red-500" />
    if (type === 'Warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return <Info className="h-4 w-4 text-blue-500" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <div className="flex space-x-2">
          <Button variant={logType === 'System' ? 'default' : 'outline'} size="sm" onClick={() => setLogType('System')}>System</Button>
          <Button variant={logType === 'Application' ? 'default' : 'outline'} size="sm" onClick={() => setLogType('Application')}>Application</Button>
          <Button variant={logType === 'Security' ? 'default' : 'outline'} size="sm" onClick={() => setLogType('Security')}>Security</Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium w-10"></th>
              <th className="px-4 py-3 font-medium w-[150px]">Time</th>
              <th className="px-4 py-3 font-medium w-24">Event ID</th>
              <th className="px-4 py-3 font-medium w-[150px]">Source</th>
              <th className="px-4 py-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events?.map((e, idx) => (
              <tr key={idx} className="hover:bg-muted/50">
                <td className="px-4 py-2">{getIcon(e.entryType)}</td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(e.timeGenerated).toLocaleString()}</td>
                <td className="px-4 py-2 font-mono">{e.eventID}</td>
                <td className="px-4 py-2 truncate max-w-[150px]" title={e.source}>{e.source}</td>
                <td className="px-4 py-2"><div className="line-clamp-2" title={e.message}>{e.message}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
