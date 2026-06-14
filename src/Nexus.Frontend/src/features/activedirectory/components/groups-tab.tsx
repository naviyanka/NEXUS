import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { ADGroup, ADGroupMember } from '@/types/activedirectory'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useState } from 'react'

export function GroupsTab() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ['ad-groups'],
    queryFn: async () => {
      const res = await api.get<ADGroup[]>('/ActiveDirectory/groups')
      return res.data
    }
  })

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />

  return (
    <div className="border rounded-md overflow-hidden bg-card p-4">
      <Accordion type="single" collapsible className="w-full">
        {groups?.map(g => (
          <AccordionItem key={g.name} value={g.name}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col text-left">
                <span className="font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{g.description || 'No description provided'}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GroupMembers name={g.name} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function GroupMembers({ name }: { name: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ad-group-members', name],
    queryFn: async () => {
      const res = await api.get<ADGroupMember[]>(`/ActiveDirectory/groups/${name}/members`)
      return res.data
    }
  })

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Loading members...</div>
  if (!data || data.length === 0) return <div className="p-4 text-muted-foreground text-sm">No members found.</div>

  return (
    <div className="bg-muted/30 p-4 rounded-md mt-2">
      <ul className="space-y-1 text-sm">
        {data.map(m => (
          <li key={m.samAccountName} className="flex justify-between border-b last:border-0 pb-1 last:pb-0">
            <span>{m.name}</span>
            <span className="text-muted-foreground font-mono text-xs">{m.samAccountName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
