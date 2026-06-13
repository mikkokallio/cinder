# Cinder - Persistent Vibe Coding Server

## Overview

Cinder is an always-on development server with a polished web dashboard for managing and running projects via persistent GitHub Copilot CLI sessions. Built for mobile-first access with a dark, ember-themed UI.

The core idea: open a browser on any device, pick a project, and start (or resume) a Copilot CLI session that never dies -- even if the browser closes, the phone locks, or you switch devices. Multiple sessions can run simultaneously.

---

## Core Capabilities

### 1. Persistent Copilot CLI Sessions
- WebSocket-based PTY sessions that survive browser disconnects
- Ring buffer replay on reconnect (see recent output immediately)
- Multiple concurrent sessions per user (named/tagged)
- Session lifecycle: create, attach, detach, reattach, terminate
- xterm.js terminal in browser with full color/resize support

### 2. Project Dashboard
- List of registered projects (git repos cloned on the VM)
- Per-project status: running dev server (y/n), port, last activity, active CLI sessions
- One-tap launch into project's Copilot CLI or terminal
- One-tap open running dev server UI (proxied through Caddy)

### 3. General Terminal
- Standard shell PTY (bash) sessions alongside Copilot CLI
- Same persistence model -- survives disconnects

### 4. File Viewer / Editor
- Monaco-based code editor (VS Code look) for quick file inspection and edits
- File tree navigation per project
- Syntax highlighting, search, basic editing
- Smooth transition between terminal and editor views

### 5. Port Master (Dynamic Port Allocation)
- Central service that allocates ports for dev servers
- Projects request a port on startup; Port Master assigns from a managed range (4000-4999)
- Prevents conflicts when multiple apps run simultaneously
- Maintains a registry: `{project_id, port, pid, started_at}`
- Projects can declare a preferred port but Port Master overrules on conflict
- API: `POST /ports/allocate`, `DELETE /ports/{port}`, `GET /ports`

### 6. Dev Server Proxy
- Caddy routes `/app/{project_slug}/*` to the allocated port for that project
- WebSocket pass-through for HMR
- Auth gate on all app routes (Entra ID session cookie)

---

## Architecture

```
Browser (any device)
    |
    | HTTPS (Caddy TLS)
    v
+-------------------+
|      Caddy        |  Reverse proxy, TLS termination, auth gate
+-------------------+
    |         |         |
    v         v         v
 /api/*    /ws/*     /app/{slug}/*
    |         |         |
    v         v         v
+--------+ +--------+ +-------------+
| FastAPI| | PTY WS | | Dev Servers |
| (8000) | | (8002) | | (4000-4999) |
+--------+ +--------+ +-------------+
    |
    v
Port Master (in-process or sidecar)
```

### Components

| Component | Tech | Port | Purpose |
|-----------|------|------|---------|
| Dashboard frontend | React + Vite + Tailwind | 3000 | Main UI |
| API backend | FastAPI (Python) | 8000 | REST API, auth, project management |
| Terminal service | FastAPI/Starlette (Python) | 8002 | Persistent PTY sessions (Copilot CLI + shell) |
| Reverse proxy | Caddy | 443/80 | TLS, routing, auth forwarding |
| Port Master | Python module (in API) | -- | Port allocation registry |
| Dev servers | Various (Vite, etc.) | 4000-4999 | Running project dev servers |

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend framework | React 18+ | Familiar, fast, good mobile support |
| Build tool | Vite | Fast HMR, simple config |
| Styling | Tailwind CSS | Utility-first, easy dark theme |
| Terminal rendering | xterm.js + xterm-addon-fit | Industry standard web terminal |
| Code editor | Monaco Editor | VS Code engine, feature-rich |
| Backend framework | FastAPI | Async, fast, proven in dreamwild |
| Process management | PM2 | Proven in dreamwild, process persistence |
| Reverse proxy | Caddy | Automatic TLS, simple config |
| Auth | Microsoft Entra ID (MSAL) | Existing tenant, SSO |
| VM OS | Ubuntu 24.04 LTS | Standard, well-supported |
| IaC | Bicep | Azure-native, existing pattern from dreamwild |

---

## Authentication

### Entra ID Flow
1. Frontend uses MSAL.js to acquire an ID token (implicit/PKCE flow)
2. Token sent as Bearer header on API calls
3. Token sent as query param on WebSocket connect (WS doesn't support headers)
4. Backend validates JWT signature via Entra JWKS endpoint
5. Caddy `forward_auth` directive gates `/app/*` routes through the API's `/api/auth/check`

### Session Cookies
- After initial token validation, backend issues a session cookie
- Cookie used for subsequent requests (avoids re-validating JWT on every call)
- Cookie is HttpOnly, Secure, SameSite=Strict

---

## VM Infrastructure

### Size
- **Standard_B2s** (2 vCPU, 4 GB RAM) -- baseline for 1-3 concurrent dev servers
- Upgrade path: B2ms (8 GB) or B4ms (16 GB) if more headroom needed
- No auto-shutdown policy. Runs 24/7 (burstable cost: ~EUR 30/month)

### Connectivity (Replacing Bastion)

**Problem**: Azure Bastion is expensive (~EUR 130/month) and unreliable for tunneling SSH/SCP.

**Solution**: Direct SSH over public IP with defense in depth:

1. **SSH key-only auth** (password disabled)
2. **NSG rules**: Port 22 restricted to known IP ranges (home IP, GitHub Actions runners)
3. **fail2ban** on the VM for brute-force protection
4. **GitHub Actions CD**: Auto-deploy on push to `main` -- eliminates most manual SSH need

**Deployment workflow**:
```
Local edit -> git push -> GitHub Actions -> SSH to VM -> git pull + pm2 restart
```

For ad-hoc access (debugging, logs):
```
ssh -i ~/.ssh/cinder_key cinder@<vm-public-ip>
```

No Bastion. No tunnel scripts. No port scanning. Just direct SSH.

### DNS & TLS
- Custom domain (CNAME to VM public IP DNS label)
- Caddy handles Let's Encrypt TLS automatically

---

## UI Design

### Theme: Dark Ember
- **Background**: Deep charcoal (#0a0a0a to #1a1a1a gradients)
- **Primary accent**: Ember orange (#ff6b35)
- **Secondary accent**: Molten red (#dc2626)
- **Tertiary**: Warm amber glow (#f59e0b)
- **Text**: Warm white (#fafaf9) on dark
- **Surfaces**: Glassmorphic panels with subtle ember glow borders
- **Icons**: Custom SVG icons only. Crisp, thematic, clear purpose. Never emojis.

### Animations
- **Page transitions**: Burning ember particle effect -- current view dissolves into floating ember particles that drift upward and scatter, revealing the new view underneath
- **Idle state**: Subtle pulsing glow on active session indicators
- **Loading**: Ember particles coalescing from edges toward center
- **Hover states**: Gentle glow intensification on interactive elements

### Mobile-First
- Touch-optimized tap targets (min 44px)
- Swipe gestures for navigation between sessions
- Responsive terminal that adapts to viewport
- Bottom navigation bar on mobile
- Full-screen terminal mode with minimal chrome

### Layout
- **Home**: Project grid with status badges (running/idle)
- **Project view**: Tabbed interface -- Terminal | Editor | Dev Server
- **Sessions panel**: Slide-out drawer showing all active PTY sessions across projects
- **Settings**: Port registry view, session management, theme tweaks

---

## Port Master Design

```python
# Port allocation registry (in-memory + file persistence)
class PortMaster:
    RANGE_START = 4000
    RANGE_END = 4999

    def allocate(self, project_id: str, preferred: int | None = None) -> int:
        """Allocate a port. Honors preferred if available, else picks next free."""

    def release(self, port: int) -> None:
        """Free a port when a dev server stops."""

    def get_registry(self) -> list[PortEntry]:
        """Return all active allocations."""
```

Persisted to `~/.cinder/ports.json`. On startup, validates that registered ports are actually in use (cleans stale entries).

---

## Project Registration

Projects are git repositories cloned into `/opt/cinder/projects/`. Registration:

```json
{
  "id": "globe-tripper",
  "name": "Globe Tripper",
  "path": "/opt/cinder/projects/globe-tripper",
  "repo": "https://github.com/user/globe-tripper",
  "dev_command": "npm run dev",
  "preferred_port": 5173,
  "icon": "globe"
}
```

API: `GET /api/projects`, `POST /api/projects`, `DELETE /api/projects/{id}`

---

## Test Case: Globe Tripper

The `globe_tripper` project from this workspace will be used as the initial test app:
- Small Vite + vanilla JS app (3D globe visualization using globe.gl)
- Simple `npm run dev` to start
- Visual output perfect for verifying the proxy routing works
- Port Master will assign it a port from the 4000-4999 range

---

## Directory Structure

```
cinder/
  dashboard/              # React + Vite frontend
    src/
      components/
        Terminal.tsx       # xterm.js wrapper
        Editor.tsx        # Monaco wrapper
        ProjectCard.tsx   # Project grid card
        EmberTransition.tsx  # Particle transition effect
        SessionDrawer.tsx
        PortRegistry.tsx
      pages/
        Home.tsx
        ProjectView.tsx
      hooks/
        useWebSocket.ts
        useTerminal.ts
      lib/
        auth.ts           # MSAL config
        api.ts            # API client
      styles/
        ember.css         # Custom animations, glow effects
      assets/
        icons/            # Custom SVG icons
      App.tsx
      main.tsx
    index.html
    vite.config.ts
    tailwind.config.ts
    package.json
  backend/                # FastAPI backend
    main.py               # API server
    auth.py               # Entra ID validation
    port_master.py        # Port allocation
    projects.py           # Project CRUD
    terminal_service.py   # Persistent PTY management
    dev_server.py         # Dev server lifecycle
    requirements.txt
  infra/                  # Azure infrastructure
    main.bicep            # VM + networking
    main.bicepparam
    cloud-init.yaml       # VM bootstrap script
  scripts/
    deploy.sh             # Manual deploy script
    setup-vm.sh           # Initial VM setup (Node, Python, Caddy, PM2, etc.)
  .github/
    workflows/
      deploy.yml          # Auto-deploy on push to main
  Caddyfile               # Reverse proxy config
  ecosystem.config.js     # PM2 process config
  .gitignore
  README.md
```

---

## Deployment Pipeline

### GitHub Actions (`.github/workflows/deploy.yml`)
```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VM_HOST }}
          username: cinder
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/cinder
            git pull origin main
            cd dashboard && npm ci && npm run build
            cd ../backend && pip install -r requirements.txt
            pm2 restart ecosystem.config.js
```

---

## Security Considerations

- All traffic over HTTPS (Caddy auto-TLS)
- Entra ID authentication on all routes (no anonymous access)
- SSH key-only, no password auth
- NSG restricts port 22 to known IPs
- fail2ban for SSH brute-force mitigation
- CSP headers via Caddy
- WebSocket auth via token verification on connect
- No secrets in git (use `.env` on VM, GitHub secrets for CI)
- Session cookies: HttpOnly, Secure, SameSite=Strict

---

## Phase 1 Deliverables (MVP)

1. Infrastructure Bicep (VM, NSG, public IP, VNet)
2. VM setup script (Node 20, Python 3.12, Caddy, PM2, fail2ban)
3. Backend API with auth + project management + Port Master
4. Terminal service with persistent PTY sessions (Copilot CLI + bash)
5. Dashboard frontend with project list, terminal view, ember theme
6. Caddy config with auth gate and dev server proxy
7. GitHub Actions deploy pipeline
8. Globe Tripper as test project

## Phase 2 (Post-MVP)

- Monaco editor integration
- Ember particle page transition animations
- Multi-session management UI with swipe gestures
- Project auto-detection (scan for package.json, requirements.txt, etc.)
- Resource monitoring (CPU, RAM, disk on dashboard)
- Session sharing (read-only spectator mode)
