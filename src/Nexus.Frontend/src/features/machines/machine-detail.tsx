import { useEffect, useState } from 'react'
import { useParams, useRouter } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/axios'
import { Machine } from '@/stores/machineStore'
import { OverviewTab } from './components/overview-tab'
import { ServicesTab } from './components/services-tab'
import { ProcessesTab } from './components/processes-tab'
import { EventsTab } from './components/events-tab'

export default function MachineDetailPage() {
  const { machineId } = useParams({ strict: false })
  const searchParams = useRouter().state.location.search as any
  const [machine, setMachine] = useState<Machine | null>(null)

  const activeTab = searchParams?.tab || 'overview'

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const res = await api.get<Machine>(`/Machine/${machineId}`)
        setMachine(res.data)
      } catch (e) {
        console.error(e)
      }
    }
    if (machineId) fetchMachine()
  }, [machineId])

  if (!machine) return <div className="p-8">Loading machine details...</div>

  return (
    <>
      <Header>
        <div className="flex flex-col">
          <h1 className='text-2xl font-bold'>{machine.hostname}</h1>
          <span className="text-sm text-muted-foreground">{machine.displayName} • {machine.machineGroup?.name}</span>
        </div>
      </Header>
      <Main>
        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="processes">Processes</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab machine={machine} />
          </TabsContent>
          <TabsContent value="services" className="mt-0">
            <ServicesTab hostname={machine.hostname} />
          </TabsContent>
          <TabsContent value="processes" className="mt-0">
            <ProcessesTab hostname={machine.hostname} />
          </TabsContent>
          <TabsContent value="events" className="mt-0">
            <EventsTab hostname={machine.hostname} />
          </TabsContent>
          <TabsContent value="updates" className="mt-0">
            <div className="p-4 border rounded bg-card text-muted-foreground">Updates management...</div>
          </TabsContent>
          <TabsContent value="storage" className="mt-0">
            <div className="p-4 border rounded bg-card text-muted-foreground">Storage metrics...</div>
          </TabsContent>
          <TabsContent value="network" className="mt-0">
            <div className="p-4 border rounded bg-card text-muted-foreground">Network adapters...</div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
