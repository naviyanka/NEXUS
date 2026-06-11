# Phase 11 — Theme Engine (CSS Tokens + Live Switch)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the complete theming system. Backend serves theme definitions. Frontend injects CSS custom properties (tokens) at runtime so changing a theme is instant without page reload. Non-technical users can create custom themes by copying `_template/theme.json` and editing color values.  
  
---  
  
## Context  
NEXUS themes are JSON files in `themes/` directory. Each theme defines a token system: colors, fonts, spacing, radius, shadows, effects. The frontend reads the active theme and injects all tokens as CSS `--variable` values on the `:root` element. All components reference only CSS variables — never hardcoded colors.  
  
---  
  
## Scope  
**In scope:**  
- Backend: `ThemeLoader.cs` — scans `themes/`, loads `theme.json` files  
- Backend: `GET /api/themes`, `GET /api/themes/{id}`, `PUT /api/themes/active`  
- Backend: serves theme assets (preview images, custom fonts)  
- Frontend: `ThemeProvider.tsx` — injects CSS tokens on active theme change  
- Frontend: `themeStore.ts` (Zustand) — active theme state  
- 4 built-in themes: `dark-default`, `light`, `cyberpunk`, `midnight-blue`  
- Live theme switching (no page reload)  
- Theme validation (required token keys must be present)  
  
**Out of scope:**  
- Theme Manager UI (Phase 40)  
- Per-user theme preference persistence (Phase 40)  
  
---  
  
## Prerequisites  
- Phase 1 (backend), Phase 10 (frontend shell)  
  
---  
  
## Built-in Theme Token Spec  
  
Every theme MUST define these token groups:  
  
```json  
{  
  "id": "dark-default",  
  "name": "Dark (Default)",  
  "base": "dark",  
  "tokens": {  
    "color": {  
      "bg-primary":       "#0f1117",  
      "bg-secondary":     "#161b22",  
      "bg-elevated":      "#1c2128",  
      "bg-hover":         "#21262d",  
      "border":           "#30363d",  
      "border-hover":     "#484f58",  
      "accent-1":         "#58a6ff",  
      "accent-2":         "#3fb950",  
      "text-primary":     "#e6edf3",  
      "text-secondary":   "#8b949e",  
      "text-muted":       "#484f58",  
      "status-online":    "#3fb950",  
      "status-offline":   "#f85149",  
      "status-warning":   "#d29922",  
      "status-unknown":   "#6e7681",  
      "danger":           "#f85149",  
      "success":          "#3fb950",  
      "info":             "#58a6ff"  
    },  
    "font": {  
      "family-ui":   "Inter, system-ui, -apple-system, sans-serif",  
      "family-mono": "JetBrains Mono, 'Fira Code', Consolas, monospace",  
      "size-xs":     "11px",  
      "size-sm":     "13px",  
      "size-base":   "14px",  
      "size-lg":     "16px",  
      "size-xl":     "20px",  
      "weight-normal": "400",  
      "weight-medium": "500",  
      "weight-bold":   "600"  
    },  
    "space": { "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px" },  
    "radius": { "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "full": "9999px" },  
    "transition": { "fast": "100ms ease", "normal": "200ms ease", "slow": "400ms ease" }  
  },  
  "effects": {  
    "glow": false,  
    "blur_backdrop": false,  
    "glassmorphism": false,  
    "animated_borders": false  
  },  
  "layout": {  
    "sidebar_width": "240px",  
    "sidebar_collapsed": "60px",  
    "topbar_height": "52px",  
    "card_gap": "16px",  
    "card_radius": "var(--radius-md)"  
  }  
}  
```  
  
## ThemeProvider.tsx — Token Injection  
  
```tsx  
// src/Nexus.Frontend/src/shell/ThemeProvider.tsx  
function injectThemeTokens(theme: ThemeDefinition) {  
  const root = document.documentElement;  
  // Inject color tokens  
  Object.entries(theme.tokens.color).forEach(([key, value]) =>  
    root.style.setProperty(`--color-${key}`, value)  
  );  
  // Inject font tokens  
  Object.entries(theme.tokens.font).forEach(([key, value]) =>  
    root.style.setProperty(`--font-${key}`, value)  
  );  
  // Inject space, radius, transition tokens...  
  // Apply body class for effects: 'theme-glow', 'theme-blur', etc.  
  document.body.className = `theme-${theme.id} ${buildEffectClasses(theme.effects)}`;  
}  
```  
  
## ThemeLoader.cs (Backend)  
  
```csharp  
// src/Nexus.Gateway/Core/ThemeLoader.cs  
public class ThemeLoader : IThemeRegistry  
{  
    // Scans themes/ directory, loads theme.json files  
    // Validates required token keys  
    // Supports hot-reload (FileSystemWatcher like PluginLoader)  
    // Serves theme assets at /api/themes/{id}/assets/{filename}  
}  
```  
  
## Tailwind CSS Variable Integration  
  
In `tailwind.config.ts`, reference CSS variables so Tailwind classes use theme tokens:  
  
```typescript  
theme: {  
  extend: {  
    colors: {  
      'bg-primary':   'var(--color-bg-primary)',  
      'bg-secondary': 'var(--color-bg-secondary)',  
      'accent':       'var(--color-accent-1)',  
      'text-primary': 'var(--color-text-primary)',  
      // etc.  
    },  
    fontFamily: {  
      'ui':   ['var(--font-family-ui)'],  
      'mono': ['var(--font-family-mono)'],  
    }  
  }  
}  
```  
  
## API Endpoints  
  
| Method | Endpoint | Description |  
|--------|----------|-------------|  
| GET | `/api/themes` | List all themes with preview URL |  
| GET | `/api/themes/{id}` | Full theme definition |  
| GET | `/api/themes/active` | Currently active theme |  
| PUT | `/api/themes/active` | Set active theme `{ themeId: "cyberpunk" }` |  
| GET | `/api/themes/{id}/assets/{file}` | Serve preview.png or font files |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Core/ThemeLoader.cs` | Create |  
| `src/Nexus.Gateway/Controllers/ThemesController.cs` | Create |  
| `src/Nexus.Frontend/src/shell/ThemeProvider.tsx` | Create |  
| `src/Nexus.Frontend/src/store/themeStore.ts` | Create |  
| `src/Nexus.Frontend/tailwind.config.ts` | Modify |  
| `themes/dark-default/theme.json` | Create |  
| `themes/light/theme.json` | Create |  
| `themes/cyberpunk/theme.json` | Create |  
| `themes/midnight-blue/theme.json` | Create |  
  
---  
  
## Test Criteria  
- [ ] `GET /api/themes` returns 4 built-in themes  
- [ ] `PUT /api/themes/active` with `"cyberpunk"` changes active theme persisted in nexus.yaml  
- [ ] Frontend instantly reflects theme change (no page reload)  
- [ ] All 4 themes load without validation errors  
- [ ] Missing required token in a theme.json logs error, other themes unaffected  
- [ ] Cyberpunk theme applies neon green accents and glow effect class on body  
- [ ] Light theme produces white backgrounds with dark text  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **11-0:** Token schema definition + `dark-default` theme  
- **11-1:** ThemeLoader backend + ThemesController  
- **11-2:** ThemeProvider.tsx (CSS injection logic)  
- **11-3:** Remaining 3 built-in themes  
- **11-4:** Tailwind config integration + live switch test  
  
---  
  
## Notes for Coding Agent  
- CSS injection uses `document.documentElement.style.setProperty()` — no stylesheet re-render needed  
- Every component must use only CSS variables, NEVER hardcoded hex colors  
- Tailwind classes that reference CSS variables work at dev time but test in production build  
- Cyberpunk theme effects: add CSS classes like `effects-glow` to `<body>` — actual glow CSS in `themes/cyberpunk/overrides.css`  
- Theme active state persists in nexus.yaml (backend), not frontend storage