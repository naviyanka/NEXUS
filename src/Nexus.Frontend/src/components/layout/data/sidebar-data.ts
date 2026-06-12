import {
  IconLayoutDashboard,
  IconServer,
  IconPlug,
  IconSettings,
  IconTerminal,
  IconDeviceDesktop,
  IconTool
} from '@tabler/icons-react'
import { Command } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Administrator',
    email: 'admin@nexus.local',
    avatar: '/avatars/admin.png',
  },
  teams: [
    {
      name: 'NEXUS Gateway',
      logo: Command,
      plan: 'System',
    }
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: IconLayoutDashboard,
        },
        {
          title: 'Machines',
          url: '/machines',
          icon: IconServer,
        },
        {
          title: 'Terminal',
          url: '/terminal',
          icon: IconTerminal,
        },
        {
          title: 'Remote Desktop',
          url: '/desktop',
          icon: IconDeviceDesktop,
        },
        {
          title: 'Core Tools',
          url: '/tools',
          icon: IconTool,
        },
        {
          title: 'Plugins',
          url: '/plugins',
          icon: IconPlug,
        },
        {
          title: 'Settings',
          url: '/settings',
          icon: IconSettings,
        }
      ],
    }
  ],
}
