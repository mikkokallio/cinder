"""
Dev Server lifecycle management.
Starts/stops dev servers for projects using Port Master.
"""
import asyncio
import logging
import os
import signal
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Active dev server processes keyed by project_id
_processes: dict[str, asyncio.subprocess.Process] = {}


async def start_dev_server(
    project_id: str,
    project_path: str,
    dev_command: str,
    port: int,
) -> int:
    """Start a dev server for a project on the given port.
    Returns the PID of the launched process.
    """
    if project_id in _processes:
        proc = _processes[project_id]
        if proc.returncode is None:
            logger.info(f'Dev server already running for {project_id} (pid={proc.pid})')
            return proc.pid

    env = {**os.environ, 'PORT': str(port)}

    # Auto-detect working directory: prefer frontend/ subfolder if it has package.json
    cwd = project_path
    root_pkg = Path(project_path) / 'package.json'
    frontend_pkg = Path(project_path) / 'frontend' / 'package.json'
    if not root_pkg.exists() and frontend_pkg.exists():
        cwd = str(Path(project_path) / 'frontend')
        logger.info(f'Using frontend/ subfolder for {project_id}')

    # For vite projects, inject --port flag and override base to /
    cmd = dev_command
    if 'vite' in cmd or cmd == 'npm run dev':
        # Check if vite.config exists in cwd to confirm it's a vite project
        vite_config = Path(cwd) / 'vite.config.ts'
        vite_config_js = Path(cwd) / 'vite.config.js'
        if vite_config.exists() or vite_config_js.exists():
            cmd = f'npx vite --port {port} --host 127.0.0.1 --base /'

    # Parse command
    parts = cmd.split()

    proc = await asyncio.create_subprocess_exec(
        *parts,
        cwd=cwd,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    _processes[project_id] = proc
    logger.info(f'Dev server started for {project_id}: pid={proc.pid}, port={port}, cmd="{cmd}", cwd={cwd}')

    # Background log drain (prevents buffer overflow)
    asyncio.create_task(_drain_output(project_id, proc))

    return proc.pid


async def stop_dev_server(project_id: str) -> bool:
    """Stop a running dev server. Returns True if it was running."""
    proc = _processes.pop(project_id, None)
    if proc is None or proc.returncode is not None:
        return False

    try:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
    except ProcessLookupError:
        pass

    logger.info(f'Dev server stopped for {project_id}')
    return True


def is_running(project_id: str) -> bool:
    """Check if a dev server is running for a project."""
    proc = _processes.get(project_id)
    return proc is not None and proc.returncode is None


def get_pid(project_id: str) -> Optional[int]:
    """Get PID of running dev server."""
    proc = _processes.get(project_id)
    if proc and proc.returncode is None:
        return proc.pid
    return None


async def _drain_output(project_id: str, proc: asyncio.subprocess.Process):
    """Drain stdout to prevent buffer deadlock. Logs output on exit."""
    lines = []
    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            lines.append(line.decode(errors='replace').rstrip())
    except Exception:
        pass
    finally:
        rc = proc.returncode
        if rc is not None and rc != 0:
            logger.warning(f'Dev server {project_id} exited with code {rc}. Last output: {lines[-10:] if lines else "none"}')
        _processes.pop(project_id, None)
