import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { SPFarm } from '@/types/sharepoint'
import { Skeleton } from '@/components/ui/skeleton'

export function UpgradeCheckerTab({ farm }: { farm: SPFarm }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sp-upgrade', farm.wfeHost],
    queryFn: async () => {
      const res = await api.get(`/SharePoint/upgrade-status/${farm.wfeHost}`)
      return res.data
    }
  })

  if (isLoading) return <Skeleton className="h-[400px] w-full" />
  if (!data) return <div className="p-4 text-muted-foreground">Unable to fetch farm upgrade state.</div>

  const farmVersion = data.FarmBuildVersion?.Version || 'Unknown'

  return (
    <div className="space-y-4">
      <div className="bg-card p-4 border rounded-md">
        <h3 className="font-semibold text-lg">Farm Build Version</h3>
        <p className="text-2xl font-mono mt-2">{farmVersion}</p>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <div className="p-3 border-b bg-muted/50 font-semibold">Installed Products & Patches</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Product Display Name</th>
              <th className="px-4 py-3 font-medium">Patched Version</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.LocalProducts?.map((p: any, i: number) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{p.DisplayName}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.PatchedVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
