import React from 'react'
import ReactDOM from 'react-ui-dom/client' // Oops, React DOM
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { ThemeProvider } from './context/theme-context'
import './index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="system" storageKey="nexus-ui-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </React.StrictMode>,
  )
}
