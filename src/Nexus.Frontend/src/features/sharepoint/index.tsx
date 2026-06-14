import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Server } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SPFarm } from '@/types/sharepoint'

import { HealthTab } from './components/health-tab'
import { ServicesTab } from './components/services-tab'
import { IisTab } from './components/iis-tab'
import { UlsTab } from './components/uls-tab'
import { ConfigDiffTab } from './components/config-diff-tab'
import { UpgradeCheckerTab } from './components/upgrade-checker-tab'

// Mocking available farms directly based on MachineGroups mapping "SharePoint"
const AVAILABLE_FARMS: SPFarm[] = [
  { name: 'SharePoint SE', wfeHost: 'SPSE-WFE01', appHost: 'SPSE-APP01' },
  { name: 'SharePoint 2019', wfeHost: 'SP2019-WFE01', appHost: 'SP2019-APP01' },
  { name: 'SharePoint 2016', wfeHost: 'SP2016-WFE01', appHost: 'SP2016-APP01' },
]

export default function SharePointManagerPage() {
  const searchParams = useRouter().state.location.search as any
  const [activeFarm, setActiveFarm] = useState<SPFarm>(AVAILABLE_FARMS[0])
  const activeTab = searchParams?.tab || 'health'

  return (
    <>
      <Header>
        <h1 className='text-xl font-bold'>SharePoint Management</h1>
      </Header>
      <Main className="p-0 overflow-hidden flex h-[calc(100vh-[var(--header-height)])]">

        {/* Left Panel: Farm Selector */}
        <div className="w-[260px] border-r bg-muted/20 flex flex-col shrink-0">
          <div className="p-3 border-b bg-card">
            <h2 className="font-semibold text-sm flex items-center">
              <Server className="h-4 w-4 mr-2" /> Connected Farms
            </h2>
          </div>
          <ScrollArea className="flex-1 p-2 space-y-1">
            {AVAILABLE_FARMS.map(farm => (
              <button
                key={farm.name}
                onClick={() => setActiveFarm(farm)}
                className={`w-full text-left flex flex-col p-3 rounded mb-2 transition-colors ${
                  activeFarm.name === farm.name ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent bg-card border border-transparent'
                }`}
              >
                <span className="font-semibold text-sm">{farm.name}</span>
                <span className="text-xs text-muted-foreground mt-1 line-clamp-1">{farm.wfeHost} / {farm.appHost}</span>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Right Panel: Content */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-background p-6">
          <Tabs defaultValue={activeTab} className="w-full">
            <TabsList className="mb-6 w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="health" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Health</TabsTrigger>
              <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Services</TabsTrigger>
              <TabsTrigger value="iis" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">IIS & App Pools</TabsTrigger>
              <TabsTrigger value="uls" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">ULS Logs</TabsTrigger>
              <TabsTrigger value="configdiff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Config Diff</TabsTrigger>
              <TabsTrigger value="upgrade" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Upgrade Checker</TabsTrigger>
            </TabsList>

            <div className="mt-2">
              <TabsContent value="health" className="m-0"><HealthTab farm={activeFarm} /></TabsContent>
              <TabsContent value="services" className="m-0"><ServicesTab farm={activeFarm} /></TabsContent>
              <TabsContent value="iis" className="m-0"><IisTab farm={activeFarm} /></TabsContent>
              <TabsContent value="uls" className="m-0"><UlsTab farm={activeFarm} /></TabsContent>
              <TabsContent value="configdiff" className="m-0"><ConfigDiffTab farm={activeFarm} /></TabsContent>
              <TabsContent value="upgrade" className="m-0"><UpgradeCheckerTab farm={activeFarm} /></TabsContent>
            </div>
          </Tabs>
        </div>

      </Main>
    </>
  )
}
