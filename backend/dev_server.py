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

    # Parse command
    parts = dev_command.split()

    proc = await asyncio.create_subprocess_exec(
        *parts,
        cwd=project_path,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    _processes[project_id] = proc
    logger.info(f'Dev server started for {project_id}: pid={proc.pid}, port={port}, cmd="{dev_command}"')

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
    """Drain stdout to prevent buffer deadlock. Could be extended to log files."""
    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
    except Exception:
        pass
    finally:
        _processes.pop(project_id, None)
