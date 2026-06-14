import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SearchProvider } from '@/context/search-context'
import { AppShell } from '@/components/layout/app-shell'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated')({
  component: AuthLayout,
})

function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
        <h1 className="text-4xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access NEXUS.</p>
        <p className="text-sm">Please ensure you are accessing this application via an authorized Windows session.</p>
      </div>
    )
  }

  return (
    <SearchProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </SearchProvider>
  )
}
