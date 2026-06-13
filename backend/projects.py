"""
Project management for Cinder.
"""
import json
import logging
import subprocess
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user

logger = logging.getLogger(__name__)

PROJECTS_DIR = Path(os.getenv('CINDER_ROOT', '/opt/cinder')) / 'projects'
PROJECTS_FILE = Path(os.getenv('CINDER_ROOT', '/opt/cinder')) / 'projects.json'

router = APIRouter()


class ProjectCreate(BaseModel):
    id: str
    name: str
    repo: Optional[str] = None
    dev_command: str = 'npm run dev'
    preferred_port: Optional[int] = None
    icon: str = 'folder'


class ProjectInfo(BaseModel):
    id: str
    name: str
    path: str
    repo: Optional[str] = None
    dev_command: str
    preferred_port: Optional[int] = None
    icon: str
    running: bool = False
    port: Optional[int] = None


def _load_projects() -> list[dict]:
    if PROJECTS_FILE.exists():
        return json.loads(PROJECTS_FILE.read_text())
    return []


def _save_projects(projects: list[dict]):
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROJECTS_FILE.write_text(json.dumps(projects, indent=2))


@router.get('')
async def list_projects(user=Depends(get_current_user)) -> list[ProjectInfo]:
    projects = _load_projects()
    result = []
    for p in projects:
        info = ProjectInfo(**p, running=False)
        result.append(info)
    return result


@router.post('')
async def register_project(project: ProjectCreate, user=Depends(get_current_user)):
    projects = _load_projects()
    if any(p['id'] == project.id for p in projects):
        raise HTTPException(status_code=409, detail=f'Project {project.id} already exists')

    project_path = PROJECTS_DIR / project.id
    entry = {
        'id': project.id,
        'name': project.name,
        'path': str(project_path),
        'repo': project.repo,
        'dev_command': project.dev_command,
        'preferred_port': project.preferred_port,
        'icon': project.icon,
    }
    projects.append(entry)
    _save_projects(projects)

    # Clone repo if provided and path doesn't exist
    if project.repo and not project_path.exists():
        project_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['git', 'clone', project.repo, str(project_path)], check=True)

    return entry


@router.delete('/{project_id}')
async def unregister_project(project_id: str, user=Depends(get_current_user)):
    projects = _load_projects()
    projects = [p for p in projects if p['id'] != project_id]
    _save_projects(projects)
    return {'deleted': project_id}
