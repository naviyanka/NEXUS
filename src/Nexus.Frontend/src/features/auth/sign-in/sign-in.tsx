import { UserAuthForm } from './components/user-auth-form'

export default function SignIn() {
  return (
    <div className='flex items-center justify-center min-h-screen bg-background'>
      <div className='w-full max-w-sm p-8 space-y-8 rounded-lg shadow-lg bg-card border'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold tracking-tight'>NEXUS</h1>
          <p className='text-sm text-muted-foreground'>Sign in using your Windows credentials.</p>
        </div>
        <UserAuthForm />
      </div>
    </div>
  )
}
