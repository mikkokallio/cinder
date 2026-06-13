"""
Persistent Terminal Service for Cinder.

Standalone Starlette app serving WebSocket-based PTY sessions.
Sessions survive browser disconnects -- PTY processes keep running.
Supports both Copilot CLI and standard bash shells.
Multiple sessions per user.
"""
import asyncio
import collections
import json
import logging
import os
import pty
import struct
import fcntl
import termios
import signal
import time
from typing import Optional
from pathlib import Path

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
import uvicorn

from auth import verify_bearer_token

CINDER_ROOT = Path(os.getenv('CINDER_ROOT', '/opt/cinder'))
load_dotenv(CINDER_ROOT / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger('cinder-terminal')

REPLAY_BUFFER_SIZE = 65536

# Sessions keyed by "{user_id}:{session_name}"
_sessions: dict[str, 'PtySession'] = {}


class PtySession:
    """Persistent PTY session that survives WebSocket disconnects."""

    def __init__(self, owner: str, name: str, shell: str = '/bin/bash'):
        self.owner = owner
        self.name = name
        self.shell = shell
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self._closed = False
        self._replay_buf = collections.deque(maxlen=REPLAY_BUFFER_SIZE)
        self._ws: Optional[WebSocket] = None
        self._reader_task: Optional[asyncio.Task] = None
        self.created_at = time.time()
        self.last_activity = time.time()

    @property
    def key(self) -> str:
        return f'{self.owner}:{self.name}'

    @property
    def alive(self) -> bool:
        if self._closed or self.pid is None:
            return False
        try:
            pid, _ = os.waitpid(self.pid, os.WNOHANG)
            if pid != 0:
                self._closed = True
                return False
            return True
        except (OSError, ChildProcessError):
            self._closed = True
            return False

    def spawn(self, cols: int = 120, rows: int = 30, cwd: str = '/opt/cinder'):
        pid, fd = pty.fork()
        if pid == 0:
            os.chdir(cwd)
            env = {
                'TERM': 'xterm-256color',
                'LANG': 'en_US.UTF-8',
                'HOME': os.environ.get('HOME', '/root'),
                'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
            }
            # Inherit GitHub tokens for Copilot CLI
            for key in ('GITHUB_TOKEN', 'COPILOT_GITHUB_TOKEN'):
                val = os.environ.get(key)
                if val:
                    env[key] = val
            os.execve(self.shell, [self.shell], env)
        else:
            self.master_fd = fd
            self.pid = pid
            self.resize(cols, rows)
            logger.info(f'PTY spawned: pid={pid}, owner={self.owner}, name={self.name}, shell={self.shell}')

    def resize(self, cols: int, rows: int):
        if self.master_fd is not None and not self._closed:
            winsize = struct.pack('HHHH', rows, cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)

    def write(self, data: bytes):
        if self.master_fd is not None and not self._closed:
            os.write(self.master_fd, data)
            self.last_activity = time.time()

    def read(self, size: int = 4096) -> bytes:
        if self.master_fd is None or self._closed:
            return b''
        try:
            return os.read(self.master_fd, size)
        except OSError:
            return b''

    def get_replay(self) -> str:
        return bytes(self._replay_buf).decode('utf-8', errors='replace')

    def attach(self, ws: WebSocket):
        self._ws = ws
        self.last_activity = time.time()

    def detach(self):
        self._ws = None

    def close(self):
        if self._closed:
            return
        self._closed = True
        self._ws = None
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGTERM)
                os.waitpid(self.pid, os.WNOHANG)
            except (OSError, ChildProcessError):
                pass
        if self.key in _sessions:
            del _sessions[self.key]
        logger.info(f'PTY closed: pid={self.pid}, owner={self.owner}, name={self.name}')

    async def start_reader(self):
        loop = asyncio.get_event_loop()

        async def _read_loop():
            while not self._closed and self.alive:
                try:
                    data = await loop.run_in_executor(None, self.read)
                    if data:
                        self._replay_buf.extend(data)
                        self.last_activity = time.time()
                        ws = self._ws
                        if ws:
                            try:
                                await ws.send_json({'type': 'output', 'data': data.decode('utf-8', errors='replace')})
                            except Exception:
                                self._ws = None
                    else:
                        await asyncio.sleep(0.02)
                except (OSError, asyncio.CancelledError):
                    break
            if not self._closed:
                ws = self._ws
                if ws:
                    try:
                        await ws.send_json({'type': 'exit', 'code': 0})
                    except Exception:
                        pass
                self.close()

        self._reader_task = asyncio.create_task(_read_loop())


def _verify_ws_token(token: str) -> dict:
    """Synchronous token verification for WebSocket connect."""
    import jwt as pyjwt
    from jwt import PyJWKClient
    tenant_id = os.getenv('ENTRA_TENANT_ID', 'common')
    client_id = os.getenv('ENTRA_CLIENT_ID')
    jwks_uri = f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys'
    jwks_client = PyJWKClient(jwks_uri)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    issuers = [
        f'https://sts.windows.net/{tenant_id}/',
        f'https://login.microsoftonline.com/{tenant_id}/v2.0',
    ]
    audiences = [client_id, f'api://{client_id}']
    claims = pyjwt.decode(token, signing_key.key, algorithms=['RS256'], audience=audiences, issuer=issuers)
    return claims


# --- WebSocket Handler ---

async def terminal_ws(websocket: WebSocket):
    """
    WebSocket endpoint for terminal sessions.

    Query params:
      - token: Entra ID bearer token
      - session: session name (default: 'default')
      - shell: 'bash' or 'copilot' (default: 'bash')
      - cwd: working directory (default: /opt/cinder)
    """
    token = websocket.query_params.get('token')
    if not token:
        await websocket.close(code=4001, reason='Missing token')
        return

    try:
        claims = _verify_ws_token(token)
    except Exception as e:
        logger.warning(f'WS auth failed: {e}')
        await websocket.close(code=4003, reason='Authentication failed')
        return

    user_id = claims.get('oid', claims.get('sub', 'unknown'))
    session_name = websocket.query_params.get('session', 'default')
    shell_type = websocket.query_params.get('shell', 'bash')
    cwd = websocket.query_params.get('cwd', '/opt/cinder')

    shell_bin = '/bin/bash'
    if shell_type == 'copilot':
        copilot_bin = '/usr/local/bin/copilot'
        if os.path.exists(copilot_bin):
            shell_bin = copilot_bin

    await websocket.accept()

    session_key = f'{user_id}:{session_name}'
    session = _sessions.get(session_key)

    try:
        # Wait for initial resize
        init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        init_data = json.loads(init_msg)
        cols = init_data.get('cols', 120)
        rows = init_data.get('rows', 30)

        if session and session.alive:
            session.resize(cols, rows)
            session.attach(websocket)
            replay = session.get_replay()
            if replay:
                await websocket.send_json({'type': 'resumed', 'replay': replay})
            logger.info(f'Session reattached: {session_key}')
        else:
            if session:
                session.close()
            session = PtySession(owner=user_id, name=session_name, shell=shell_bin)
            session.spawn(cols, rows, cwd)
            _sessions[session_key] = session
            session.attach(websocket)
            await session.start_reader()

        # Input loop
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get('type')
            if msg_type == 'input':
                session.write(msg.get('data', '').encode('utf-8'))
            elif msg_type == 'resize':
                session.resize(msg.get('cols', 120), msg.get('rows', 30))
            elif msg_type == 'close':
                session.close()
                await websocket.send_json({'type': 'exit', 'code': 0})
                break

    except WebSocketDisconnect:
        if session:
            session.detach()
            logger.info(f'Client disconnected, session persists: {session_key}')
    except Exception as e:
        logger.error(f'Terminal WS error: {e}')
        if session:
            session.detach()


# --- REST endpoints ---

async def list_sessions(request):
    """List all active sessions."""
    # Simple auth check via header
    auth = request.headers.get('authorization', '')
    if not auth.startswith('Bearer '):
        return JSONResponse({'error': 'Unauthorized'}, status_code=401)
    try:
        claims = _verify_ws_token(auth[7:])
    except Exception:
        return JSONResponse({'error': 'Unauthorized'}, status_code=401)

    user_id = claims.get('oid', claims.get('sub', 'unknown'))
    user_sessions = []
    for key, session in _sessions.items():
        if session.owner == user_id and session.alive:
            user_sessions.append({
                'name': session.name,
                'shell': session.shell,
                'created_at': session.created_at,
                'last_activity': session.last_activity,
                'attached': session._ws is not None,
            })
    return JSONResponse(user_sessions)


async def health(request):
    return JSONResponse({'status': 'ok', 'service': 'cinder-terminal', 'active_sessions': len(_sessions)})


app = Starlette(
    routes=[
        WebSocketRoute('/ws/terminal/{session_name}', terminal_ws),
        Route('/api/sessions', list_sessions),
        Route('/health', health),
    ],
)

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8002)
