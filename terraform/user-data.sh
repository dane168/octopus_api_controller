#!/bin/bash
set -e

# Log everything to a file for debugging
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user-data script at $(date)"

# Variables from Terraform
GOOGLE_CLIENT_ID="${google_client_id}"
JWT_SECRET="${jwt_secret}"
ENCRYPTION_KEY="${encryption_key}"
LOG_LEVEL="${log_level}"
GITHUB_REPO="${github_repo}"

# Update system
dnf update -y

# Install Docker and Git
dnf install -y docker git

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Install Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Docker Buildx (required for compose build)
# Note: Don't fail if buildx install fails - compose can still work
BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
echo "Installing buildx version: $BUILDX_VERSION"
curl -SL -o /usr/local/lib/docker/cli-plugins/docker-buildx \
  "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-arm64"
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# Verify buildx works
docker buildx version || echo "Warning: buildx not working, continuing anyway"

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Wait for EBS volume to be attached
echo "Waiting for EBS volume..."
while [ ! -b /dev/xvdf ] && [ ! -b /dev/nvme1n1 ]; do
  sleep 5
done

# Determine the actual device name (can be xvdf or nvme1n1 depending on instance type)
if [ -b /dev/nvme1n1 ]; then
  DEVICE=/dev/nvme1n1
else
  DEVICE=/dev/xvdf
fi

# Check if volume has a filesystem, if not create one
if ! blkid $DEVICE; then
  echo "Creating filesystem on $DEVICE"
  mkfs.ext4 $DEVICE
fi

# Create mount point and mount the volume
mkdir -p /data/octopus
mount $DEVICE /data/octopus

# Add to fstab for persistence across reboots
echo "$DEVICE /data/octopus ext4 defaults,nofail 0 2" >> /etc/fstab

# Set permissions
chown -R 1000:1000 /data/octopus

# Create app directory
mkdir -p /opt/octopus-controller
cd /opt/octopus-controller

# Get public IP and create nip.io URL (works with Google OAuth)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
NIP_IO_URL="http://$(echo $PUBLIC_IP | tr '.' '-').nip.io"

echo "Public IP: $PUBLIC_IP"
echo "nip.io URL: $NIP_IO_URL"

# Create environment file
cat > .env << EOF
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
LOG_LEVEL=$LOG_LEVEL
FRONTEND_URL=$NIP_IO_URL
EOF

# Create deploy script (used by GitHub Actions via SSM)
# Note: GITHUB_TOKEN is passed as env var from GitHub Actions
cat > /opt/octopus-controller/deploy.sh << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
cd /opt/octopus-controller

# Read repo from config file
GITHUB_REPO=$(cat /opt/octopus-controller/.github_repo)

# Check for GitHub token (required for private repos)
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN not provided. Cannot clone private repo."
  exit 1
fi

# Configure git to use token
REPO_URL="https://x-access-token:$GITHUB_TOKEN@github.com/$GITHUB_REPO.git"

# Pull latest code
if [ -d repo ]; then
  cd repo
  git remote set-url origin "$REPO_URL"
  git pull
else
  git clone "$REPO_URL" repo
  cd repo
fi

# Build and deploy
docker compose -f docker/docker-compose.prod.yml --env-file /opt/octopus-controller/.env build
docker compose -f docker/docker-compose.prod.yml --env-file /opt/octopus-controller/.env down || true
docker compose -f docker/docker-compose.prod.yml --env-file /opt/octopus-controller/.env up -d

# Cleanup old images
docker system prune -f

echo "Deploy completed at $(date)"
DEPLOYSCRIPT

# Store github repo in a file for the deploy script to read
echo "${github_repo}" > /opt/octopus-controller/.github_repo
chmod +x /opt/octopus-controller/deploy.sh

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
WorkingDirectory=/opt/octopus-controller/repo
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f docker/docker-compose.prod.yml --env-file /opt/octopus-controller/.env up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f docker/docker-compose.prod.yml --env-file /opt/octopus-controller/.env down

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable octopus-controller.service

echo "============================================"
echo "User-data script completed at $(date)"
echo "EC2 instance is ready!"
echo ""
echo "FRONTEND_URL: $NIP_IO_URL"
echo ""
echo "Add this to Google OAuth:"
echo "  Authorized JavaScript origins: $NIP_IO_URL"
echo "  Authorized redirect URIs: $NIP_IO_URL"
echo ""
echo "Run 'git push' to trigger deployment via GitHub Actions"
echo "============================================"
