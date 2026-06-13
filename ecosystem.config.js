module.exports = {
  apps: [
    {
      name: 'cinder-api',
      cwd: '/opt/cinder/backend',
      script: 'uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8000 --workers 2',
      interpreter: '/opt/cinder/.venv/bin/python',
      env: {
        PYTHONPATH: '/opt/cinder/backend',
      },
    },
    {
      name: 'cinder-terminal',
      cwd: '/opt/cinder/backend',
      script: 'uvicorn',
      args: 'terminal_service:app --host 127.0.0.1 --port 8002 --workers 1',
      interpreter: '/opt/cinder/.venv/bin/python',
      env: {
        PYTHONPATH: '/opt/cinder/backend',
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
