import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { TopStatusBar } from './components/top-status-bar'
import { MachineGrid } from './components/machine-grid'
import { SharePointHealthPanels } from './components/sharepoint-health-panels'
import { MetricsRow } from './components/metrics-row'
import { RecentAlertsAudit } from './components/recent-alerts-audit'

export default function Dashboard() {
  return (
    <>
      <Header>
        <TopNav links={[]} />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <TopStatusBar />
        <MachineGrid />
        <SharePointHealthPanels />
        <MetricsRow />
        <RecentAlertsAudit />
      </Main>
    </>
  )
}
