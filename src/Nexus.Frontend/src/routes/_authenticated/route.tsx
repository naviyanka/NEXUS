import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { SearchProvider } from '@/context/search-context'
import { AppShell } from '@/components/layout/app-shell'
import { useAuthStore } from '@/stores/authStore'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      throw redirect({
        to: '/sign-in',
      })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <SearchProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </SearchProvider>
  )
}
