import { useEffect, useState } from 'react'
import { useTerminalSession } from '@/hooks/useTerminalSession'
import { Button } from '@/components/ui/button'
import { AlertCircle, TerminalSquare, Copy, Trash2, Maximize } from 'lucide-react'

interface Props {
  hostname: string
  isActive: boolean
  themeColor: string
}

export function TerminalTab({ hostname, isActive, themeColor }: Props) {
  const { terminalElement, connect, disconnect, clear, isConnected, error } = useTerminalSession(hostname, themeColor)
  const [isMaximized, setIsMaximized] = useState(false)

  // Only run logic when active
  useEffect(() => {
    if (isActive) {
      connect()
    }
    // Note: Deliberately NOT disconnecting on blur so session remains open in background
  }, [isActive, connect])

  return (
    <div className={`flex-col h-full ${isActive ? 'flex' : 'hidden'} ${isMaximized ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            <TerminalSquare className="h-4 w-4" />
            <span className="font-medium">{hostname}</span>
          </div>
          <div className="flex items-center text-xs">
            {isConnected ? (
              <span className="text-green-500 flex items-center"><div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" /> Connected</span>
            ) : error ? (
              <span className="text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> {error}</span>
            ) : (
              <span className="text-muted-foreground flex items-center"><div className="h-2 w-2 rounded-full bg-muted-foreground mr-2" /> Connecting...</span>
            )}
          </div>
        </div>
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} title="Clear Terminal">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMaximized(!isMaximized)} title="Toggle Maximize">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={disconnect} title="Disconnect">
            <AlertCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal Canvas */}
      <div className="flex-1 w-full bg-[#0d0d0d] overflow-hidden p-2">
        <div ref={terminalElement} className="h-full w-full" />
      </div>
    </div>
  )
}
