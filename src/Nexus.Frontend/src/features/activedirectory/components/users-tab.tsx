import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { ADUser } from '@/types/activedirectory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { MoreHorizontal, RefreshCw } from 'lucide-react'

export function UsersTab() {
  const [filter, setFilter] = useState('')

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['ad-users'],
    queryFn: async () => {
      const res = await api.get<ADUser[]>('/ActiveDirectory/users')
      return res.data
    }
  })

  const handleAction = async (username: string, action: string) => {
    try {
      await api.post(`/ActiveDirectory/users/${username}/${action}`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-xl" />
  if (!users) return <div className="p-4 text-muted-foreground">Unable to fetch AD users.</div>

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(filter.toLowerCase()) ||
    u.displayName.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <Input
          placeholder="Search by username or display name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Last Logon</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(u => (
              <tr key={u.username} className="hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2">{u.displayName}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email || '-'}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.lastLogon ? new Date(u.lastLogon).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className={u.isAccountLockedOut ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : u.isEnabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}>
                    {u.isAccountLockedOut ? 'Locked' : u.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {u.isEnabled ? (
                        <DropdownMenuItem onClick={() => handleAction(u.username, 'disable')}>Disable Account</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleAction(u.username, 'enable')}>Enable Account</DropdownMenuItem>
                      )}
                      {u.isAccountLockedOut && (
                        <DropdownMenuItem onClick={() => handleAction(u.username, 'unlock')}>Unlock Account</DropdownMenuItem>
                      )}
                      <DropdownMenuItem>Reset Password...</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
