import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/axios'
import { Machine } from '@/stores/machineStore'

export function OverviewTab({ machine }: { machine: Machine }) {
  const { data, isLoading } = useQuery({
    queryKey: ['machine-overview', machine.id],
    queryFn: async () => {
      const res = await api.get(`/Machine/${machine.id}/overview`)
      return res.data
    },
    refetchInterval: 30000 // Poll every 30s
  })

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />

  if (!data) return <div className="text-muted-foreground p-4">Could not fetch overview data.</div>

  const cpuLoad = data.processorInfo?.LoadPercentage || 0
  const cpuName = data.processorInfo?.Name || 'Unknown CPU'
  const cpuCores = data.processorInfo?.NumberOfCores || 0

  const osName = data.computerInfo?.WindowsProductName || 'Unknown OS'
  const arch = data.computerInfo?.OsArchitecture || ''

  const totalRamBytes = data.computerInfo?.TotalPhysicalMemory || 0
  // Simplification for UI since mock raw doesn't supply used directly in this step
  const totalRamGb = (totalRamBytes / 1024 / 1024 / 1024).toFixed(1)

  const drive = data.driveInfo || {}
  const driveTotalGb = ((drive.Used + drive.Free) / 1024 / 1024 / 1024).toFixed(1)
  const driveUsedGb = (drive.Used / 1024 / 1024 / 1024).toFixed(1)
  const drivePct = Math.round((drive.Used / (drive.Used + drive.Free)) * 100) || 0

  const uptime = data.uptimeHours ? Math.round(data.uptimeHours) + ' hours' : 'Unknown'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>System Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Operating System</div>
            <div className="text-lg">{osName} {arch}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Uptime</div>
            <div className="text-lg">{uptime}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Processor</div>
            <div className="text-lg">{cpuName} ({cpuCores} Cores)</div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>CPU Load</span>
                <span>{cpuLoad}%</span>
              </div>
              <Progress value={cpuLoad} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resources</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-muted-foreground">Physical Memory</span>
              <span>Total: {totalRamGb} GB</span>
            </div>
            <Progress value={0} className="bg-muted" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-muted-foreground">Local Disk (C:)</span>
              <span>{driveUsedGb} GB / {driveTotalGb} GB ({drivePct}%)</span>
            </div>
            <Progress value={drivePct} className={drivePct > 90 ? 'text-red-500' : ''} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
