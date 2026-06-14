import { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useMachineStore } from '@/stores/machineStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Server, TerminalSquare, Plus, X } from 'lucide-react'
import { TerminalTab } from './TerminalTab'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Session {
  id: string
  hostname: string
}

export default function TerminalManagerPage() {
  const searchParams = useRouter().state.location.search as any
  const initialHostname = searchParams?.hostname

  const { machines, fetchMachines, pollStatus } = useMachineStore()

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState('#00ff41') // Default green

  useEffect(() => {
    fetchMachines()
    pollStatus()
  }, [fetchMachines, pollStatus])

  // Handle auto-open if query param exists
  useEffect(() => {
    if (initialHostname && sessions.length === 0) {
      handleNewSession(initialHostname)
    }
  }, [initialHostname])

  const handleNewSession = (hostname: string) => {
    const newId = `${hostname}-${Date.now()}`
    setSessions(prev => [...prev, { id: newId, hostname }])
    setActiveSessionId(newId)
  }

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id)
      if (activeSessionId === id) {
        setActiveSessionId(updated.length > 0 ? updated[updated.length - 1].id : null)
      }
      return updated
    })
  }

  return (
    <>
      <Header>
        <div className="flex justify-between items-center w-full">
          <h1 className='text-xl font-bold'>Remote Terminal</h1>
          <div className="flex space-x-2 items-center">
            <span className="text-xs text-muted-foreground mr-2">Theme:</span>
            <div className="flex space-x-1">
              <button onClick={() => setThemeColor('#00ff41')} className={`w-4 h-4 rounded-full bg-[#00ff41] ${themeColor === '#00ff41' ? 'ring-2 ring-offset-1 ring-offset-background' : ''}`} />
              <button onClick={() => setThemeColor('#ffffff')} className={`w-4 h-4 rounded-full bg-[#ffffff] border ${themeColor === '#ffffff' ? 'ring-2 ring-offset-1 ring-offset-background' : ''}`} />
              <button onClick={() => setThemeColor('#3b82f6')} className={`w-4 h-4 rounded-full bg-[#3b82f6] ${themeColor === '#3b82f6' ? 'ring-2 ring-offset-1 ring-offset-background' : ''}`} />
            </div>
          </div>
        </div>
      </Header>
      <Main className="p-0 overflow-hidden flex h-[calc(100vh-[var(--header-height)])]">

        {/* Left Panel: Machine Selector */}
        <div className="w-[260px] border-r bg-muted/20 flex flex-col">
          <div className="p-3 border-b bg-card">
            <h2 className="font-semibold text-sm flex items-center">
              <Server className="h-4 w-4 mr-2" /> Target Machines
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {machines.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleNewSession(m.hostname)}
                  className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center truncate">
                    <div className={`h-2 w-2 rounded-full mr-2 shrink-0 ${m.lastKnownStatus === 'Online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm truncate">{m.hostname}</span>
                  </div>
                  <TerminalSquare className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                </button>
              ))}
              {machines.length === 0 && (
                <div className="text-xs text-muted-foreground p-2 text-center">No machines available.</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: Terminal Area */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden relative">

          {/* Tabs Bar */}
          <div className="flex bg-muted border-b overflow-x-auto">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`flex items-center min-w-[150px] max-w-[200px] h-9 px-3 border-r cursor-pointer text-sm transition-colors ${
                  activeSessionId === s.id ? 'bg-background font-medium border-b-2 border-b-primary' : 'hover:bg-background/50 text-muted-foreground'
                }`}
              >
                <TerminalSquare className="h-3 w-3 mr-2 shrink-0" />
                <span className="truncate flex-1">{s.hostname}</span>
                <button
                  onClick={(e) => handleCloseSession(s.id, e)}
                  className="ml-2 hover:bg-muted-foreground/20 rounded p-0.5 shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                 {machines.map(m => (
                   <DropdownMenuItem key={m.id} onClick={() => handleNewSession(m.hostname)}>
                     Connect to {m.hostname}
                   </DropdownMenuItem>
                 ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Terminal Render Area */}
          <div className="flex-1 relative">
            {sessions.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <TerminalSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>No active terminal sessions.</p>
                <p className="text-sm">Select a machine from the left panel to begin.</p>
              </div>
            ) : (
              sessions.map(s => (
                <TerminalTab
                  key={s.id}
                  hostname={s.hostname}
                  isActive={activeSessionId === s.id}
                  themeColor={themeColor}
                />
              ))
            )}
          </div>

        </div>
      </Main>
    </>
  )
}
