#!/bin/bash
# Initial VM setup after cloud-init completes.
# Run via: az vm run-command invoke --resource-group cinder-rg --name cinder-vm --command-id RunShellScript --scripts @scripts/setup-vm.sh
set -e

CINDER_ROOT=/opt/cinder
GITHUB_REPO="https://github.com/mikkokallio/cinder.git"

echo "=== Cinder VM Setup ==="

# Create venv if missing
if [ ! -d "$CINDER_ROOT/.venv" ]; then
  python3 -m venv $CINDER_ROOT/.venv
fi

# Clone the repo (first time only)
if [ ! -d "$CINDER_ROOT/.git" ]; then
  echo "Cloning repository..."
  cd /opt
  rm -rf cinder  # remove cloud-init placeholder if any
  git clone $GITHUB_REPO cinder
  cd cinder
else
  echo "Repo already exists, pulling latest..."
  cd $CINDER_ROOT
  git pull origin main
fi

# Set ownership
chown -R cinder:cinder $CINDER_ROOT

# Install backend deps
echo "Installing Python dependencies..."
source $CINDER_ROOT/.venv/bin/activate
pip install -r $CINDER_ROOT/backend/requirements.txt --quiet

# Install frontend deps and build
echo "Building dashboard..."
cd $CINDER_ROOT/dashboard
npm ci
npm run build

# Copy Caddyfile
echo "Configuring Caddy..."
cp $CINDER_ROOT/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy

# Setup PM2 (run as cinder user)
echo "Starting services with PM2..."
cd $CINDER_ROOT
sudo -u cinder bash -c "cd $CINDER_ROOT && pm2 start ecosystem.config.js && pm2 save"

# Create .env if not exists
if [ ! -f "$CINDER_ROOT/.env" ]; then
  cat > $CINDER_ROOT/.env << 'ENVEOF'
ENTRA_TENANT_ID=822e1525-06a0-418c-9fab-ffc6a51aaac5
ENTRA_CLIENT_ID=64b1054a-2bc0-426c-a928-04aa037497ca
CINDER_DOMAIN=cinder-xpgzstv4tq47s.swedencentral.cloudapp.azure.com
ENVEOF
  chown cinder:cinder $CINDER_ROOT/.env
fi

echo "=== Setup complete ==="
