import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import * as signalR from '@microsoft/signalr'

export function useTerminalSession(hostname: string, themeColor: string) {
  const terminalElement = useRef<HTMLDivElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep refs to avoid re-triggering effects on state changes
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const connRef = useRef<signalR.HubConnection | null>(null)

  const connect = useCallback(() => {
    if (!terminalElement.current) return
    if (connRef.current) return // Already connected

    // 1. Initialize Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      theme: {
        background: '#0d0d0d',
        foreground: themeColor,
        cursor: themeColor,
      }
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())

    // 2. Open in DOM
    term.open(terminalElement.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current) fitRef.current.fit()
    })
    resizeObserver.observe(terminalElement.current)

    // 3. Connect SignalR
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`http://localhost:5000/hubs/terminal?hostname=${hostname}`)
      .withAutomaticReconnect()
      .build()

    connRef.current = newConnection

    // 4. Bind Events
    newConnection.on("TerminalConnected", (message: string) => {
      setIsConnected(true)
      setError(null)
      term.write(message)
    })

    newConnection.on("TerminalOutput", (message: string) => {
      term.write(message)
    })

    newConnection.on("TerminalError", (message: string) => {
      term.write(`\x1b[31m${message}\x1b[0m`)
    })

    newConnection.start().catch(err => {
      setError(err.toString())
      term.write(`\x1b[31mConnection failed: ${err.toString()}\x1b[0m\r\n`)
    })

    // 5. User Input
    let commandBuffer = ''
    term.onData(data => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        // Simple echo for user typing experience locally before sending to hub
        if (data === '\r') {
           term.write('\r\n')
           newConnection.invoke("SendInput", commandBuffer)
           commandBuffer = ''
        } else if (data === '\u007f') { // Backspace
           if (commandBuffer.length > 0) {
             commandBuffer = commandBuffer.slice(0, -1)
             term.write('\b \b')
           }
        } else {
           commandBuffer += data
           term.write(data)
        }
      }
    })

    return () => {
      resizeObserver.disconnect()
    }
  }, [hostname, themeColor])

  const disconnect = useCallback(() => {
    if (connRef.current) {
      connRef.current.stop()
      connRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Provide ability to clear or copy externally
  const clear = useCallback(() => {
    if (termRef.current) termRef.current.clear()
  }, [])

  // Ensure theme syncs dynamically if toggled
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = {
        ...termRef.current.options.theme,
        foreground: themeColor,
        cursor: themeColor
      }
    }
  }, [themeColor])

  return { terminalElement, connect, disconnect, clear, isConnected, error }
}
