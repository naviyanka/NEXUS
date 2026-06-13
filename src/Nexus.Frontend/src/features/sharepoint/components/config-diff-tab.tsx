import { useState } from 'react'
import { api } from '@/lib/axios'
import { SPFarm } from '@/types/sharepoint'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ConfigDiffTab({ farm }: { farm: SPFarm }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const runDiff = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/SharePoint/configdiff?wfe=${farm.wfeHost}&app=${farm.appHost}`)
      setData(res.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Simplified diff logic based off mock topology
  const getDiffs = () => {
    if (!data || !data.WfeConfig || !data.AppConfig) return []
    // This is mocked heavily since real execution generates large nested objects.
    // We demonstrate UI capability here.
    return [
      { component: 'Application Pool', wfe: data.WfeConfig.ApplicationPool || 'Missing', app: data.AppConfig.ApplicationPool || 'Missing' },
      { component: 'Default Zone', wfe: data.WfeConfig.DefaultZone || 'Missing', app: data.AppConfig.DefaultZone || 'Missing' },
      { component: 'Web Application URL', wfe: data.WfeConfig.Url || 'Missing', app: data.AppConfig.Url || 'Missing' }
    ]
  }

  const diffs = getDiffs()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <div>
          <span className="font-semibold block">Configuration Drift Analysis</span>
          <span className="text-sm text-muted-foreground">Comparing {farm.wfeHost} against {farm.appHost}</span>
        </div>
        <Button onClick={runDiff} disabled={loading}>{loading ? 'Analyzing...' : 'Run Diff Check'}</Button>
      </div>

      {loading && <Skeleton className="h-[300px] w-full" />}

      {!loading && data && (
        <div className="border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium w-1/3">Component</th>
                <th className="px-4 py-3 font-medium w-1/3">{farm.wfeHost} (WFE)</th>
                <th className="px-4 py-3 font-medium w-1/3">{farm.appHost} (APP)</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {diffs.map((d, i) => {
                const isMatch = d.wfe === d.app
                return (
                  <tr key={i} className="hover:bg-muted/50">
                    <td className="px-4 py-2 font-medium">{d.component}</td>
                    <td className="px-4 py-2 font-mono text-xs">{JSON.stringify(d.wfe)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{JSON.stringify(d.app)}</td>
                    <td className="px-4 py-2">
                       <span className={`px-2 py-1 rounded-full text-xs ${isMatch ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                         {isMatch ? 'Match' : 'Mismatch'}
                       </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
