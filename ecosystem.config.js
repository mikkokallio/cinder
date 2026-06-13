module.exports = {
  apps: [
    {
      name: 'cinder-api',
      cwd: '/opt/cinder/backend',
      script: '/opt/cinder/.venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8000 --workers 2',
      interpreter: 'none',
      env: {
        PYTHONPATH: '/opt/cinder/backend',
        VIRTUAL_ENV: '/opt/cinder/.venv',
        PATH: '/opt/cinder/.venv/bin:/usr/local/bin:/usr/bin:/bin',
      },
    },
    {
      name: 'cinder-terminal',
      cwd: '/opt/cinder/backend',
      script: '/opt/cinder/.venv/bin/uvicorn',
      args: 'terminal_service:app --host 127.0.0.1 --port 8002 --workers 1',
      interpreter: 'none',
      env: {
        PYTHONPATH: '/opt/cinder/backend',
        VIRTUAL_ENV: '/opt/cinder/.venv',
        PATH: '/opt/cinder/.venv/bin:/usr/local/bin:/usr/bin:/bin',
      },
    },
    {
      name: 'cinder-dashboard',
      cwd: '/opt/cinder/dashboard',
      script: 'npx',
      args: 'vite --host 127.0.0.1 --port 3000',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
