#!/bin/bash
# Initial VM setup after cloud-init completes.
# Run once manually after first deployment.
set -e

CINDER_ROOT=/opt/cinder

echo "=== Cinder VM Setup ==="

# Clone the repo (first time only)
if [ ! -d "$CINDER_ROOT/.git" ]; then
  echo "Cloning repository..."
  cd /opt
  git clone https://github.com/YOUR_USER/cinder.git
  cd cinder
else
  echo "Repo already exists, pulling latest..."
  cd $CINDER_ROOT
  git pull origin main
fi

# Install backend deps
echo "Installing Python dependencies..."
source $CINDER_ROOT/.venv/bin/activate
pip install -r $CINDER_ROOT/backend/requirements.txt

# Install frontend deps and build
echo "Building dashboard..."
cd $CINDER_ROOT/dashboard
npm ci
npm run build

# Copy Caddyfile
echo "Configuring Caddy..."
sudo cp $CINDER_ROOT/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Setup PM2
echo "Starting services with PM2..."
cd $CINDER_ROOT
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash

# Create .env from template if not exists
if [ ! -f "$CINDER_ROOT/.env" ]; then
  cp $CINDER_ROOT/infra/.env.template $CINDER_ROOT/.env
  echo ">>> Edit /opt/cinder/.env with your Entra ID credentials"
fi

echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit /opt/cinder/.env"
echo "  2. Register your domain DNS to point to this VM"
echo "  3. pm2 restart all"
