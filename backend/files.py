"""
File browser and editor API for Cinder projects.
Provides directory listing and file read/write within project boundaries.
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel

from auth import get_current_user

router = APIRouter()

PROJECTS_ROOT = Path(os.getenv('CINDER_ROOT', '/opt/cinder')) / 'projects'


def _safe_path(project_id: str, rel_path: str) -> Path:
    """Resolve and validate path is within project boundary."""
    project_dir = PROJECTS_ROOT / project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail='Project not found')
    resolved = (project_dir / rel_path).resolve()
    if not str(resolved).startswith(str(project_dir.resolve())):
        raise HTTPException(status_code=403, detail='Path traversal denied')
    return resolved


@router.get('/{project_id}/files')
async def list_directory(project_id: str, path: str = '.', user=Depends(get_current_user)):
    """List files and directories at the given path within a project."""
    target = _safe_path(project_id, path)
    if not target.exists():
        raise HTTPException(status_code=404, detail='Path not found')
    if not target.is_dir():
        raise HTTPException(status_code=400, detail='Not a directory')

    entries = []
    try:
        for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            # Skip hidden files and node_modules
            if entry.name.startswith('.') or entry.name == 'node_modules' or entry.name == '__pycache__':
                continue
            entries.append({
                'name': entry.name,
                'type': 'dir' if entry.is_dir() else 'file',
                'size': entry.stat().st_size if entry.is_file() else None,
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail='Permission denied')

    return {'path': path, 'entries': entries}


@router.get('/{project_id}/file')
async def read_file(project_id: str, path: str, user=Depends(get_current_user)):
    """Read a file's contents."""
    target = _safe_path(project_id, path)
    if not target.exists():
        raise HTTPException(status_code=404, detail='File not found')
    if not target.is_file():
        raise HTTPException(status_code=400, detail='Not a file')
    if target.stat().st_size > 1_000_000:
        raise HTTPException(status_code=413, detail='File too large (>1MB)')

    try:
        content = target.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail='Binary file')

    return {'path': path, 'content': content}


class FileWrite(BaseModel):
    content: str


@router.put('/{project_id}/file')
async def write_file(project_id: str, path: str, body: FileWrite, user=Depends(get_current_user)):
    """Write content to a file (create or overwrite)."""
    target = _safe_path(project_id, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding='utf-8')
    return {'path': path, 'size': len(body.content)}
