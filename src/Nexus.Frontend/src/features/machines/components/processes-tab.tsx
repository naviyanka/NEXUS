import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Trash2 } from 'lucide-react'

interface Process {
  name: string
  id: number
  cpu: number
  workingSet: number
  path: string
}

export function ProcessesTab({ hostname }: { hostname: string }) {
  const { data: processes, isLoading, refetch } = useQuery({
    queryKey: ['processes', hostname],
    queryFn: async () => {
      const res = await api.get<Process[]>(`/Maintenance/processes/${hostname}`)
      return res.data
    },
    refetchInterval: 10000
  })

  const handleKill = async (pid: number, name: string) => {
    if (!confirm(`Are you sure you want to forcefully terminate ${name} (PID: ${pid})?`)) return
    try {
      await api.post(`/Maintenance/processes/${hostname}/${pid}/kill`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />
  if (!processes) return <div className="text-muted-foreground p-4">Could not fetch processes.</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <h3 className="font-medium">Top 30 Processes by CPU</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">PID</th>
              <th className="px-4 py-3 font-medium">CPU %</th>
              <th className="px-4 py-3 font-medium">Memory (MB)</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {processes.map(p => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.id}</td>
                <td className="px-4 py-2">{p.cpu}</td>
                <td className="px-4 py-2">{Math.round(p.workingSet / 1024 / 1024)} MB</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleKill(p.id, p.name)} title="Kill Process">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
