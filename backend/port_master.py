"""
Port Master - Dynamic port allocation for dev servers.
Prevents conflicts when multiple projects run simultaneously.
"""
import json
import os
import logging
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)

RANGE_START = 4000
RANGE_END = 4999


@dataclass
class PortEntry:
    project_id: str
    port: int
    pid: Optional[int] = None
    started_at: Optional[str] = None


class PortMaster:
    def __init__(self, state_file: Path):
        self._state_file = state_file
        self._registry: dict[int, PortEntry] = {}

    def load(self):
        """Load port registry from disk."""
        if self._state_file.exists():
            try:
                data = json.loads(self._state_file.read_text())
                self._registry = {
                    int(port): PortEntry(**entry) for port, entry in data.items()
                }
                logger.info(f'Loaded {len(self._registry)} port allocations')
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f'Failed to load port state: {e}')
                self._registry = {}

    def save(self):
        """Persist port registry to disk."""
        data = {str(port): asdict(entry) for port, entry in self._registry.items()}
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(json.dumps(data, indent=2))

    def cleanup_stale(self):
        """Remove entries whose processes are no longer running."""
        stale = []
        for port, entry in self._registry.items():
            if entry.pid and not self._process_alive(entry.pid):
                stale.append(port)
        for port in stale:
            logger.info(f'Cleaning stale port {port} (project: {self._registry[port].project_id})')
            del self._registry[port]
        if stale:
            self.save()

    def allocate(self, project_id: str, preferred: Optional[int] = None) -> int:
        """Allocate a port for a project. Honors preferred if free."""
        # Check if project already has an allocation
        for port, entry in self._registry.items():
            if entry.project_id == project_id:
                return port

        # Try preferred port
        if preferred and RANGE_START <= preferred <= RANGE_END:
            if preferred not in self._registry:
                self._registry[preferred] = PortEntry(project_id=project_id, port=preferred)
                self.save()
                return preferred

        # Find next free port
        for port in range(RANGE_START, RANGE_END + 1):
            if port not in self._registry:
                self._registry[port] = PortEntry(project_id=project_id, port=port)
                self.save()
                return port

        raise RuntimeError('No free ports available in range')

    def release(self, port: int):
        """Free a port."""
        if port in self._registry:
            del self._registry[port]
            self.save()

    def get_registry(self) -> list[dict]:
        """Return all allocations."""
        return [asdict(entry) for entry in self._registry.values()]

    @staticmethod
    def _process_alive(pid: int) -> bool:
        """Check if a process is running."""
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False
