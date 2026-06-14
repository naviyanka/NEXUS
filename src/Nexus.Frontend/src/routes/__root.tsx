import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return <Outlet />
}
