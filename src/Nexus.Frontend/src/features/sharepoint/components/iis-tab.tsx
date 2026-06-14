import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { SPFarm, SPIisSite, SPAppPool } from '@/types/sharepoint'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'

export function IisTab({ farm }: { farm: SPFarm }) {
  const [targetHost, setTargetHost] = useState(farm.wfeHost)

  const { data: sites, isLoading: sitesLoading, refetch: refetchSites } = useQuery({
    queryKey: ['iis-sites', targetHost],
    queryFn: async () => {
      const res = await api.get<SPIisSite[]>(`/SharePoint/iis/${targetHost}`)
      return res.data
    },
    refetchInterval: 60000
  })

  const { data: pools, isLoading: poolsLoading, refetch: refetchPools } = useQuery({
    queryKey: ['iis-pools', targetHost],
    queryFn: async () => {
      const res = await api.get<SPAppPool[]>(`/SharePoint/apppools/${targetHost}`)
      return res.data
    },
    refetchInterval: 60000
  })

  const handleRecycle = async (poolName: string) => {
    try {
      await api.post(`/SharePoint/apppools/${targetHost}/${poolName}/recycle`)
      refetchPools()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        <Button variant={targetHost === farm.wfeHost ? 'default' : 'outline'} onClick={() => setTargetHost(farm.wfeHost)}>{farm.wfeHost}</Button>
        <Button variant={targetHost === farm.appHost ? 'default' : 'outline'} onClick={() => setTargetHost(farm.appHost)}>{farm.appHost}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Sites */}
        <div className="border rounded-md bg-card">
          <div className="flex justify-between items-center p-3 border-b bg-muted/50">
            <span className="font-semibold">IIS Sites</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchSites()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          {sitesLoading ? <Skeleton className="h-[200px]" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {sites?.map(s => (
                  <tr key={s.Name} className="hover:bg-muted/50">
                    <td className="p-3">{s.Name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={s.State === 'Started' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>{s.State}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* App Pools */}
        <div className="border rounded-md bg-card">
          <div className="flex justify-between items-center p-3 border-b bg-muted/50">
            <span className="font-semibold">App Pools</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchPools()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          {poolsLoading ? <Skeleton className="h-[200px]" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {pools?.map(p => (
                  <tr key={p.name} className="hover:bg-muted/50">
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={p.state === 'Started' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>{p.state}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleRecycle(p.name)}>Recycle</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
