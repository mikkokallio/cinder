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
    dev_command: str = ''
    preferred_port: Optional[int] = None
    icon: str = 'folder'


class ProjectInfo(BaseModel):
    id: str
    name: str
    path: str
    repo: Optional[str] = None
    dev_command: str = ''
    preferred_port: Optional[int] = None
    icon: str
    running: bool = False
    port: Optional[int] = None
    summary: Optional[dict] = None


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
    elif not project_path.exists():
        project_path.mkdir(parents=True, exist_ok=True)

    return entry


@router.delete('/{project_id}')
async def unregister_project(project_id: str, user=Depends(get_current_user)):
    projects = _load_projects()
    projects = [p for p in projects if p['id'] != project_id]
    _save_projects(projects)
    return {'deleted': project_id}


@router.post('/{project_id}/summarize')
async def summarize_project(project_id: str, user=Depends(get_current_user)):
    """Use GHCP CLI to generate a brief summary of the project."""
    import shutil
    import asyncio

    projects = _load_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')

    project_path = project['path']
    if not Path(project_path).exists():
        raise HTTPException(status_code=404, detail='Project path not found')

    copilot_bin = shutil.which('copilot') or '/usr/bin/copilot'
    if not os.path.exists(copilot_bin):
        raise HTTPException(status_code=500, detail='copilot binary not found')

    prompt = (
        'Analyze this project directory. Respond with ONLY a JSON object (no markdown, no explanation) '
        'containing: {"summary": "<1-2 sentence description>", "tech": ["<tech1>", "<tech2>", ...], '
        '"files": <number of source files>, "lines": <rough total lines of code>}. '
        'Keep tech list to max 5 items. Be concise.'
    )

    env = {**os.environ}
    copilot_token = os.environ.get('COPILOT_GITHUB_TOKEN', '')
    if copilot_token:
        env['COPILOT_GITHUB_TOKEN'] = copilot_token
        env['GITHUB_TOKEN'] = copilot_token
        env['GH_TOKEN'] = copilot_token

    try:
        proc = await asyncio.create_subprocess_exec(
            copilot_bin, '-p', prompt, '--allow-all-tools', '--mode', 'autopilot', '--no-ask-user',
            cwd=project_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode('utf-8', errors='replace').strip()

        # Try to extract JSON from output
        import re
        json_match = re.search(r'\{[^{}]*\}', output)
        if json_match:
            summary_data = json.loads(json_match.group())
        else:
            summary_data = {'summary': output[:200], 'tech': [], 'files': 0, 'lines': 0}

        # Store in project entry
        project['summary'] = summary_data
        _save_projects(projects)
        return summary_data

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='Summarization timed out')
    except Exception as e:
        logger.error(f'Summarize failed for {project_id}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
