#!/bin/bash
cat << 'INNER_EOF' > src/Nexus.Frontend/src/features/security/components/local-groups-tab.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useMachineStore } from '@/stores/machineStore'
import { LocalGroup } from '@/types/security'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, ChevronDown, ChevronRight, Users } from 'lucide-react'

export function LocalGroupsTab() {
  const selectedMachine = useMachineStore(s => s.selectedMachine)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['local-groups', selectedMachine?.hostname],
    queryFn: async () => {
      const res = await api.get<LocalGroup[]>(\`/Security/local-groups/\${selectedMachine?.hostname}\`)
      return res.data
    },
    enabled: !!selectedMachine
  })

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  if (!selectedMachine) return <div className="p-4 text-muted-foreground">Select a machine to view local groups.</div>
  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />
  if (!groups) return <div className="p-4 text-muted-foreground">Unable to fetch local groups.</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold tracking-tight">Local Groups</h2>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium w-10"></th>
              <th className="px-4 py-3 font-medium">Group Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Member Count</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {groups.map(g => (
              <React.Fragment key={g.name}>
                <tr className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleGroup(g.name)}>
                  <td className="px-4 py-2">
                    {expandedGroups[g.name] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-4 py-2 font-medium">{g.name}</td>
                  <td className="px-4 py-2">{g.description}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {Array.isArray(g.members) ? g.members.length : (g.members ? 1 : 0)}
                    </div>
                  </td>
                </tr>
                {expandedGroups[g.name] && (
                  <tr className="bg-muted/20">
                    <td colSpan={4} className="p-4">
                      <div className="pl-8">
                        <h4 className="text-sm font-semibold mb-2">Group Members:</h4>
                        {g.members ? (
                          <ul className="list-disc pl-4 space-y-1">
                            {Array.isArray(g.members) ? (
                              g.members.map((m, i) => (
                                <li key={i} className="text-sm text-muted-foreground">{m}</li>
                              ))
                            ) : (
                              <li className="text-sm text-muted-foreground">{g.members}</li>
                            )}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No members in this group.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
INNER_EOF
