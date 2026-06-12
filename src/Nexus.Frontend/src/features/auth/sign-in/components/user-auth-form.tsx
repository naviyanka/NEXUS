import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from '@tanstack/react-router'

export function UserAuthForm() {
  const { checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await checkAuth() // this triggers the Negotiate auth endpoint
    setIsLoading(false)
    navigate({ to: '/' })
  }

  return (
    <form onSubmit={handleLogin} className='space-y-4'>
      <Button type='submit' className='w-full' disabled={isLoading}>
        {isLoading ? 'Connecting...' : 'Login with Windows Session'}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or local fallback</span>
        </div>
      </div>

      <div className='space-y-2'>
        <Input type='text' placeholder='Local Username' disabled={isLoading} />
        <Input type='password' placeholder='Password' disabled={isLoading} />
        <Button type='button' variant='outline' className='w-full' disabled={isLoading}>
          Local Login
        </Button>
      </div>
    </form>
  )
}
