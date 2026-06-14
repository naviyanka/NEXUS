import { useRouter } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { UsersTab } from './components/users-tab'
import { GroupsTab } from './components/groups-tab'
import { ComputersTab } from './components/computers-tab'
import { DomainInfoTab } from './components/domain-info-tab'

export default function ActiveDirectoryPage() {
  const searchParams = useRouter().state.location.search as any
  const activeTab = searchParams?.tab || 'users'

  return (
    <>
      <Header>
        <h1 className='text-xl font-bold'>Active Directory Management</h1>
      </Header>
      <Main>
        <div className="flex flex-col space-y-6">
          <Tabs defaultValue={activeTab} className="w-full">
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="computers">Computers</TabsTrigger>
              <TabsTrigger value="domain">Domain Info</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
            <TabsContent value="groups" className="mt-4"><GroupsTab /></TabsContent>
            <TabsContent value="computers" className="mt-4"><ComputersTab /></TabsContent>
            <TabsContent value="domain" className="mt-4"><DomainInfoTab /></TabsContent>
          </Tabs>
        </div>
      </Main>
    </>
  )
}
