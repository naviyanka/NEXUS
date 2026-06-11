# Phase 10 — React Frontend Shell (Layout, Routing, State)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the complete React frontend shell: the persistent layout (topbar + collapsible sidebar + main content area), client-side routing, global Zustand state, Axios API client, SignalR connection manager, TypeScript type definitions, and authentication flow. This is the skeleton that all plugin UIs plug into.  
  
---  
  
## Context  
NEXUS's frontend is a React 18 + TypeScript SPA served by the .NET gateway. The shell provides the permanent chrome (topbar, sidebar) with plugin components rendered in the content area. The theme system injects CSS variables. Plugins contribute sidebar items, toolbar widgets, and dashboard panels — all rendered through the PluginRenderer (Phase 12).  
  
---  
  
## Scope  
**In scope:**  
- `Layout.tsx` — topbar + sidebar + content area  
- `App.tsx` — routing setup (React Router v6)  
- Zustand stores: `authStore`, `machineStore`, `pluginStore`, `themeStore`  
- `api.ts` — Axios client with JWT interceptor + base URL config  
- `signalr.ts` — SignalR connection manager for terminal + metrics hubs  
- Login page component (supports Windows auth redirect + local login form)  
- Protected route wrapper  
- TypeScript interfaces for all backend models  
- Tailwind CSS baseline + CSS variable integration point  
- Responsive layout (sidebar collapses to icons on narrow screens)  
  
**Out of scope:**  
- Theme CSS variables injection (Phase 11)  
- Plugin rendering (Phase 12)  
- Dashboard grid (Phase 13)  
- Any actual plugin components (Phase 15+)  
- The content area just shows placeholder "select a plugin" for now  
  
---  
  
## Prerequisites  
- Phase 1 (backend running, static files serving)  
- Phase 4 (auth endpoints)  
- Phase 6 (plugins list endpoint)  
  
---  
  
## Tech Stack  
| Component | Package |  
|-----------|---------|  
| Framework | React 18 + TypeScript |  
| Routing | react-router-dom v6 |  
| State | zustand |  
| HTTP | axios |  
| WebSocket | @microsoft/signalr |  
| Build | Vite |  
| Styling | Tailwind CSS + CSS custom properties |  
| Icons | lucide-react |  
  
---  
  
## Key Files  
  
### App.tsx — Routes  
```tsx  
// Routes structure:  
// /                → Dashboard (Phase 13)  
// /machines        → Machine list  
// /machines/:host  → Machine detail  
// /plugins/:id     → Plugin tool view  
// /settings        → Settings pages  
// /login           → Auth page  
// * redirect to /  
```  
  
### Layout.tsx — Shell Structure  
```tsx  
// Structure:  
// ┌──────────────────────────────────────────┐  
// │  Topbar: Logo | breadcrumb | widgets area │  
// ├──────────┬───────────────────────────────┤  
// │ Sidebar  │  <Outlet /> (plugin content)   │  
// │ 240px    │                               │  
// └──────────┴───────────────────────────────┘  
//  
// Sidebar sections: (populated dynamically from pluginStore in Phase 12)  
// - Dashboard link  
// - Machine list link    
// - Plugin tool groups  
// - Settings link  
```  
  
### Zustand Stores  
```typescript  
// src/Nexus.Frontend/src/store/authStore.ts  
interface AuthState {  
  user: NexusUser | null;  
  token: string | null;           // In-memory only, NOT localStorage  
  isAuthenticated: boolean;  
  login: (credentials: LoginRequest) => Promise<void>;  
  loginWindows: () => Promise<void>;  
  logout: () => void;  
}  
  
// src/Nexus.Frontend/src/store/machineStore.ts  
interface MachineState {  
  machines: MachineStatus[];  
  groups: MachineGroup[];  
  selectedMachine: string | null;  
  isLoading: boolean;  
  fetchAll: () => Promise<void>;  
  selectMachine: (hostname: string) => void;  
}  
  
// src/Nexus.Frontend/src/store/pluginStore.ts  
interface PluginState {  
  plugins: PluginManifest[];  
  fetchPlugins: () => Promise<void>;  
  getByCategory: (cat: string) => PluginManifest[];  
}  
```  
  
### API Client  
```typescript  
// src/Nexus.Frontend/src/lib/api.ts  
const api = axios.create({ baseURL: '/api' });  
api.interceptors.request.use(config => {  
  const token = useAuthStore.getState().token;  
  if (token) config.headers.Authorization = `Bearer ${token}`;  
  return config;  
});  
api.interceptors.response.use(  
  res => res,  
  err => { if (err.response?.status === 401) useAuthStore.getState().logout(); return Promise.reject(err); }  
);  
```  
  
### SignalR Manager  
```typescript  
// src/Nexus.Frontend/src/lib/signalr.ts  
// Manages connections to /hubs/terminal and /hubs/metrics  
// Auto-reconnect on disconnect  
// Exposes subscribe/unsubscribe for components  
```  
  
### TypeScript Types  
```typescript  
// src/Nexus.Frontend/src/types/index.ts  
interface MachineStatus { hostname: string; displayName: string; isOnline: boolean; cpuPercent?: number; ... }  
interface PluginManifest { id: string; name: string; category: string; contributes: PluginContributions; ... }  
interface NexusUser { username: string; displayName: string; role: string; isWindowsAuth: boolean; }  
// ... (mirror all backend C# models)  
```  
  
---  
  
## Files to Create  
  
| File | Notes |  
|------|-------|  
| `src/Nexus.Frontend/src/App.tsx` | Routes + protected route |  
| `src/Nexus.Frontend/src/shell/Layout.tsx` | Topbar + sidebar + outlet |  
| `src/Nexus.Frontend/src/shell/Sidebar.tsx` | Nav links + plugin items |  
| `src/Nexus.Frontend/src/shell/Topbar.tsx` | Logo + widgets area |  
| `src/Nexus.Frontend/src/store/*.ts` | All Zustand stores |  
| `src/Nexus.Frontend/src/lib/api.ts` | Axios client |  
| `src/Nexus.Frontend/src/lib/signalr.ts` | SignalR manager |  
| `src/Nexus.Frontend/src/types/index.ts` | All TypeScript interfaces |  
| `src/Nexus.Frontend/src/pages/LoginPage.tsx` | Auth form |  
| `src/Nexus.Frontend/tailwind.config.ts` | Tailwind + CSS vars |  
| `src/Nexus.Frontend/vite.config.ts` | Proxy to backend in dev |  
  
---  
  
## Test Criteria  
- [ ] `npm run dev` starts without errors  
- [ ] Browser shows layout with sidebar + topbar (placeholder content)  
- [ ] Unauthenticated user is redirected to `/login`  
- [ ] Local login form submits to `POST /api/auth/login` and stores JWT in memory  
- [ ] After login, sidebar shows and `/api/machines` is called automatically  
- [ ] Machine count badge appears in topbar  
- [ ] Browser refresh does NOT log out user (handle JWT in memory but re-check session)  
- [ ] `npm run build` produces production build in `dist/`  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **10-0:** Vite config + Tailwind + TypeScript types  
- **10-1:** Zustand stores (auth, machine, plugin)  
- **10-2:** API client + SignalR manager  
- **10-3:** Layout shell (topbar + sidebar + routing)  
- **10-4:** Login page + protected routes + auth flow  
  
---  
  
## Notes for Coding Agent  
- JWT must be stored in React memory (Zustand store) ONLY — never `localStorage` or `sessionStorage` (XSS risk)  
- Windows auth flow: redirect to `/api/auth/windows` which returns 302 or JSON depending on header  
- Vite dev proxy: configure `proxy: { '/api': 'https://localhost:5001', '/hubs': 'wss://localhost:5001' }` in `vite.config.ts`  
- Tailwind config must extend theme with CSS variable references: `colors: { accent: 'var(--color-accent-1)' }`  
- Sidebar must be collapsible to 60px icon-only mode for smaller screens  
- Route `/plugins/:id` will be used by all sidebar tool plugins — shell renders `<PluginRenderer>` there 