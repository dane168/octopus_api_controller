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
ECR_BACKEND_URL="${ecr_backend_url}"
ECR_FRONTEND_URL="${ecr_frontend_url}"
AWS_REGION="${aws_region}"
CUSTOM_DOMAIN="${custom_domain}"

# Update system
dnf update -y

# Install SSM Agent (required for AWS Systems Manager)
dnf install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent

# Install Docker
dnf install -y docker

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Install Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

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

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Use custom domain if provided, otherwise fall back to nip.io
if [ -n "$CUSTOM_DOMAIN" ]; then
  FRONTEND_URL="https://$CUSTOM_DOMAIN"
  echo "Using custom domain: $CUSTOM_DOMAIN"
else
  FRONTEND_URL="http://$(echo $PUBLIC_IP | tr '.' '-').nip.io"
  echo "Using nip.io URL: $FRONTEND_URL"
fi

echo "Public IP: $PUBLIC_IP"
echo "Frontend URL: $FRONTEND_URL"

# Create environment file
cat > .env << EOF
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
LOG_LEVEL=$LOG_LEVEL
FRONTEND_URL=$FRONTEND_URL
EOF

# Store ECR URLs for deploy script
cat > .ecr_config << EOF
ECR_BACKEND_URL=$ECR_BACKEND_URL
ECR_FRONTEND_URL=$ECR_FRONTEND_URL
AWS_REGION=$AWS_REGION
EOF

# Create docker-compose file that uses ECR images
cat > docker-compose.yml << COMPOSE
services:
  backend:
    image: $ECR_BACKEND_URL:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - /data/octopus:/data
    networks:
      - app-network

  frontend:
    image: $ECR_FRONTEND_URL:latest
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
COMPOSE

# Create deploy script (used by GitHub Actions via SSM)
# This script just pulls latest images and restarts - no building required!
cat > /opt/octopus-controller/deploy.sh << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
cd /opt/octopus-controller

# Load ECR config
source .ecr_config

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BACKEND_URL

# Pull latest images
echo "Pulling latest images from ECR..."
docker compose pull

# Restart containers with new images
echo "Restarting containers..."
docker compose down || true
docker compose up -d

# Cleanup old images
docker system prune -f

echo "Deploy completed at $(date)"
docker ps
DEPLOYSCRIPT

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
WorkingDirectory=/opt/octopus-controller
ExecStartPre=/bin/bash -c 'source /opt/octopus-controller/.ecr_config && aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BACKEND_URL'
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose down

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable octopus-controller.service

echo "============================================"
echo "User-data script completed at $(date)"
echo "EC2 instance is ready!"
echo ""
echo "FRONTEND_URL: $FRONTEND_URL"
echo ""
echo "Add this to Google OAuth:"
echo "  Authorized JavaScript origins: $FRONTEND_URL"
echo "  Authorized redirect URIs: $FRONTEND_URL"
echo ""
echo "Push code to trigger GitHub Actions build and deploy"
echo "============================================"
