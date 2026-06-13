import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ServerIcon } from 'lucide-react'
import { SPFarm } from '@/types/sharepoint'

export function HealthTab({ farm }: { farm: SPFarm }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sp-health', farm.wfeHost], // Using WFE as the query hook for the farm context
    queryFn: async () => {
      const res = await api.get(`/SharePoint/health/${farm.wfeHost}`)
      return res.data
    },
    refetchInterval: 30000
  })

  if (isLoading) return <Skeleton className="h-[300px] w-full rounded-xl" />

  let healthStatus = 'Unknown'
  let badgeColor = 'bg-gray-500'

  if (error) {
    healthStatus = 'Critical'
    badgeColor = 'bg-red-500'
  } else if (data && data.Servers) {
    const isWfeOnline = data.Servers.some((s: any) => s.Role === 'WebFrontEnd' && s.Status === 'Online')
    const isAppOnline = data.Servers.some((s: any) => s.Role === 'Application' && s.Status === 'Online')
    if (isWfeOnline && isAppOnline) {
      healthStatus = 'Healthy'
      badgeColor = 'bg-green-500'
    } else if (isWfeOnline || isAppOnline) {
      healthStatus = 'Warning'
      badgeColor = 'bg-yellow-500'
    } else {
      healthStatus = 'Critical'
      badgeColor = 'bg-red-500'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Topology Overview</CardTitle>
          <Badge className={`${badgeColor} text-white`}>{healthStatus}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
             <div className="flex items-center p-4 border rounded-lg bg-muted/20">
               <ServerIcon className="h-8 w-8 text-blue-500 mr-4" />
               <div>
                 <div className="font-semibold text-lg">{farm.wfeHost}</div>
                 <div className="text-sm text-muted-foreground flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2" /> Web Front End
                 </div>
               </div>
             </div>
             <div className="flex items-center p-4 border rounded-lg bg-muted/20">
               <ServerIcon className="h-8 w-8 text-purple-500 mr-4" />
               <div>
                 <div className="font-semibold text-lg">{farm.appHost}</div>
                 <div className="text-sm text-muted-foreground flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2" /> Application Server
                 </div>
               </div>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
