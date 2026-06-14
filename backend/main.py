"""
Cinder API - Development Server Control Plane
"""
import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from auth import get_current_user, verify_session_cookie, verify_bearer_token, create_session, SESSION_COOKIE_NAME
from projects import router as projects_router
from files import router as files_router
from port_master import PortMaster
from dev_server import start_dev_server, stop_dev_server, is_running, get_pid

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger('cinder')

CINDER_ROOT = Path(os.getenv('CINDER_ROOT', '/opt/cinder'))
load_dotenv(CINDER_ROOT / '.env')

port_master = PortMaster(state_file=CINDER_ROOT / 'ports.json')


def _load_projects() -> list[dict]:
    projects_file = CINDER_ROOT / 'projects.json'
    if projects_file.exists():
        return json.loads(projects_file.read_text())
    return []


@asynccontextmanager
async def lifespan(app: FastAPI):
    port_master.load()
    port_master.cleanup_stale()
    yield
    port_master.save()


app = FastAPI(title='Cinder API', lifespan=lifespan)

_domain = os.getenv('CINDER_DOMAIN', 'localhost')
_origin = os.getenv('CINDER_ORIGIN', f'https://{_domain}')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_origin],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(projects_router, prefix='/api/projects', tags=['projects'])
app.include_router(files_router, prefix='/api/projects', tags=['files'])


@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'cinder'}


@app.post('/api/auth/login')
async def login(response: Response, user=Depends(verify_bearer_token)):
    """Exchange a bearer token for a session cookie."""
    session_id = create_session(user)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite='strict',
        max_age=86400,
    )
    return {'authenticated': True, 'user': user.get('preferred_username', '')}


@app.get('/api/auth/check')
async def auth_check(user=Depends(verify_session_cookie)):
    """Used by Caddy forward_auth to gate app routes."""
    return JSONResponse({'authenticated': True, 'user': user['preferred_username']})


@app.get('/api/ports')
async def list_ports(user=Depends(get_current_user)):
    return port_master.get_registry()


@app.post('/api/ports/allocate')
async def allocate_port(project_id: str, preferred: int | None = None, user=Depends(get_current_user)):
    port = port_master.allocate(project_id, preferred)
    return {'project_id': project_id, 'port': port}


@app.delete('/api/ports/{port}')
async def release_port(port: int, user=Depends(get_current_user)):
    port_master.release(port)
    return {'released': port}


@app.post('/api/projects/{project_id}/start')
async def start_project_server(project_id: str, user=Depends(get_current_user)):
    """Start the dev server for a project."""
    projects = _load_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')

    if is_running(project_id):
        pid = get_pid(project_id)
        return {'status': 'already_running', 'pid': pid}

    preferred = project.get('preferred_port')
    port = port_master.allocate(project_id, preferred)

    pid = await start_dev_server(
        project_id=project_id,
        project_path=project['path'],
        dev_command=project.get('dev_command', 'npm run dev'),
        port=port,
        backend_command=project.get('backend_command'),
        backend_port=project.get('backend_port'),
    )
    return {'status': 'started', 'port': port, 'pid': pid}


@app.post('/api/projects/{project_id}/stop')
async def stop_project_server(project_id: str, user=Depends(get_current_user)):
    """Stop the dev server for a project."""
    was_running = await stop_dev_server(project_id)
    # Release port
    for entry in port_master.get_registry():
        if entry['project_id'] == project_id:
            port_master.release(entry['port'])
            break
    return {'status': 'stopped' if was_running else 'not_running'}


@app.get('/api/projects/{project_id}/status')
async def project_status(project_id: str, user=Depends(get_current_user)):
    """Get running status of a project's dev server."""
    running = is_running(project_id)
    port = None
    for entry in port_master.get_registry():
        if entry['project_id'] == project_id:
            port = entry['port']
            break
    return {'project_id': project_id, 'running': running, 'port': port, 'pid': get_pid(project_id)}


# --- Dev server proxy ---

@app.websocket('/ws/{path:path}')
async def proxy_bare_websocket(path: str, websocket):
    """Proxy bare /ws/* connections to the running project's backend.
    Used when iframe apps connect via window.location.host without base path.
    """
    import websockets

    # Find a project with a backend_port configured
    projects = _load_projects()
    backend_port = None
    for project in projects:
        if project.get('backend_port'):
            backend_port = project['backend_port']
            break

    if not backend_port:
        await websocket.close(code=1002)
        return

    await websocket.accept()
    target_url = f'ws://127.0.0.1:{backend_port}/ws/{path}'

    try:
        async with websockets.connect(target_url) as backend_ws:
            import asyncio

            async def client_to_backend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await backend_ws.send(data)
                except Exception:
                    pass

            async def backend_to_client():
                try:
                    async for msg in backend_ws:
                        await websocket.send_text(msg)
                except Exception:
                    pass

            done, pending = await asyncio.wait(
                [asyncio.create_task(client_to_backend()), asyncio.create_task(backend_to_client())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.websocket('/app/{project_id}/ws/{path:path}')
async def proxy_app_websocket(project_id: str, path: str, websocket):
    """Proxy WebSocket connections to a project's backend."""
    import websockets

    projects = _load_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    backend_port = project.get('backend_port') if project else None

    if not backend_port or not is_running(project_id):
        await websocket.close(code=1002)
        return

    await websocket.accept()
    target_url = f'ws://127.0.0.1:{backend_port}/ws/{path}'

    try:
        async with websockets.connect(target_url) as backend_ws:
            import asyncio

            async def client_to_backend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await backend_ws.send(data)
                except Exception:
                    pass

            async def backend_to_client():
                try:
                    async for msg in backend_ws:
                        await websocket.send_text(msg)
                except Exception:
                    pass

            done, pending = await asyncio.wait(
                [asyncio.create_task(client_to_backend()), asyncio.create_task(backend_to_client())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.api_route('/app/{project_id}/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
async def proxy_app(project_id: str, path: str, request: Request):
    """Reverse-proxy requests to the running dev server for a project."""
    import httpx

    port = None
    for entry in port_master.get_registry():
        if entry['project_id'] == project_id:
            port = entry['port']
            break

    if port is None or not is_running(project_id):
        raise HTTPException(status_code=502, detail=f'Dev server not running for {project_id}')

    # Forward full path including /app/{project_id}/ prefix (Vite uses it as base)
    target_url = f'http://127.0.0.1:{port}/app/{project_id}/{path}'
    if request.url.query:
        target_url += f'?{request.url.query}'

    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'connection')}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail='Dev server not responding')

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={k: v for k, v in resp.headers.items() if k.lower() not in ('transfer-encoding', 'connection')},
    )


# --- Catch-all: proxy unmatched /api/* to running app backend ---

@app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
async def proxy_api_to_app_backend(path: str, request: Request):
    """Forward unmatched /api/* requests to the running project's backend."""
    import httpx

    projects = _load_projects()
    backend_port = None
    for project in projects:
        if project.get('backend_port'):
            backend_port = project['backend_port']
            break

    if not backend_port:
        raise HTTPException(status_code=404, detail='Not found')

    target_url = f'http://127.0.0.1:{backend_port}/api/{path}'
    if request.url.query:
        target_url += f'?{request.url.query}'

    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'connection')}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail='App backend not responding')

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={k: v for k, v in resp.headers.items() if k.lower() not in ('transfer-encoding', 'connection')},
    )
