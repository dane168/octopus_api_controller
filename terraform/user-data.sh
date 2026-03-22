#!/bin/bash
set -e

# Log everything for debugging
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting cloud-init at $(date)"

# Variables from Terraform templatefile()
GHCR_OWNER="${ghcr_owner}"
CUSTOM_DOMAIN="${custom_domain}"
VOLUME_DEVICE="${volume_device}"

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# Mount persistent volume for SQLite
echo "Mounting data volume..."
mkdir -p /data/octopus

# Wait for volume device to appear
for i in $(seq 1 30); do
  if [ -b "$VOLUME_DEVICE" ]; then
    break
  fi
  echo "Waiting for volume device ($i/30)..."
  sleep 2
done

# Only format if no filesystem exists (preserve data on redeploy)
if ! blkid "$VOLUME_DEVICE" | grep -q ext4; then
  echo "Creating ext4 filesystem on $VOLUME_DEVICE"
  mkfs.ext4 "$VOLUME_DEVICE"
fi

mount "$VOLUME_DEVICE" /data/octopus
echo "$VOLUME_DEVICE /data/octopus ext4 defaults,nofail 0 2" >> /etc/fstab

# Set permissions for Node.js container (runs as uid 1000)
chown -R 1000:1000 /data/octopus

# Create app directory
mkdir -p /opt/octopus-controller
cd /opt/octopus-controller

# Determine frontend URL
if [ -n "$CUSTOM_DOMAIN" ]; then
  FRONTEND_URL="https://$CUSTOM_DOMAIN"
else
  PUBLIC_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4 || hostname -I | awk '{print $1}')
  FRONTEND_URL="http://$PUBLIC_IP"
fi

# Create placeholder .env (GitHub Actions will overwrite with real secrets at deploy time)
cat > .env << EOF
GOOGLE_CLIENT_ID=placeholder
JWT_SECRET=placeholder
ENCRYPTION_KEY=placeholder
LOG_LEVEL=info
FRONTEND_URL=$FRONTEND_URL
EOF

# Create docker-compose.yml using GHCR images
cat > docker-compose.yml << COMPOSE
services:
  backend:
    image: ghcr.io/$GHCR_OWNER/octopus-controller-backend:latest
    container_name: octopus-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8000
      - DATABASE_PATH=/data/octopus-controller.db
    env_file:
      - .env
    volumes:
      - /data/octopus:/data
    expose:
      - "8000"
    networks:
      - octopus-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 384M
        reservations:
          memory: 256M

  frontend:
    image: ghcr.io/$GHCR_OWNER/octopus-controller-frontend:latest
    container_name: octopus-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - octopus-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    deploy:
      resources:
        limits:
          memory: 64M
        reservations:
          memory: 32M

networks:
  octopus-network:
    driver: bridge
COMPOSE

# Create deploy script (called via SSH by GitHub Actions)
cat > deploy.sh << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
cd /opt/octopus-controller

echo "Pulling latest images from GHCR..."
docker compose pull

echo "Restarting containers..."
docker compose down || true
docker compose up -d

# Cleanup old images
docker system prune -f

echo "Deploy completed at $(date)"
docker ps
DEPLOYSCRIPT

chmod +x deploy.sh

# Create systemd service for auto-start on reboot
cat > /etc/systemd/system/octopus-controller.service << 'SERVICE'
[Unit]
Description=Octopus Controller Docker Compose
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/octopus-controller
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable octopus-controller.service

echo "============================================"
echo "Cloud-init completed at $(date)"
echo "Server is ready for deployment via GitHub Actions"
echo "FRONTEND_URL: $FRONTEND_URL"
echo "============================================"
