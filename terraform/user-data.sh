#!/bin/bash
set -e

# Log everything to a file for debugging
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user-data script at $(date)"

# Variables from Terraform
AWS_REGION="${aws_region}"
ECR_BACKEND_URL="${ecr_backend_url}"
ECR_FRONTEND_URL="${ecr_frontend_url}"
GOOGLE_CLIENT_ID="${google_client_id}"
JWT_SECRET="${jwt_secret}"
ENCRYPTION_KEY="${encryption_key}"
LOG_LEVEL="${log_level}"

# Update system
dnf update -y

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

# Install AWS CLI (for ECR login)
dnf install -y aws-cli

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

# Get public IP for FRONTEND_URL
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Create environment file
cat > .env << EOF
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
LOG_LEVEL=$LOG_LEVEL
FRONTEND_URL=http://$PUBLIC_IP
EOF

# Create docker-compose.yml with ECR image URLs
cat > docker-compose.yml << EOF
version: '3.8'

services:
  backend:
    image: $ECR_BACKEND_URL:latest
    container_name: octopus-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8000
      - DATABASE_PATH=/data/octopus-controller.db
      - GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
      - JWT_SECRET=$JWT_SECRET
      - ENCRYPTION_KEY=$ENCRYPTION_KEY
      - FRONTEND_URL=http://$PUBLIC_IP
      - LOG_LEVEL=$LOG_LEVEL
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

  frontend:
    image: $ECR_FRONTEND_URL:latest
    container_name: octopus-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - octopus-network

networks:
  octopus-network:
    driver: bridge
EOF

# Create ECR login and update script
cat > /opt/octopus-controller/update.sh << 'SCRIPT'
#!/bin/bash
set -e
cd /opt/octopus-controller

# Login to ECR
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $(echo ${ecr_backend_url} | cut -d'/' -f1)

# Pull latest images and restart
docker compose pull
docker compose up -d
docker system prune -f

echo "Update completed at $(date)"
SCRIPT
chmod +x /opt/octopus-controller/update.sh

# Create systemd service for auto-start
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
ExecStartPre=/bin/bash -c 'aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $(echo ${ecr_backend_url} | cut -d"/" -f1)'
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose down

[Install]
WantedBy=multi-user.target
SERVICE

# Replace variables in systemd service
sed -i "s|\${aws_region}|$AWS_REGION|g" /etc/systemd/system/octopus-controller.service
sed -i "s|\${ecr_backend_url}|$ECR_BACKEND_URL|g" /etc/systemd/system/octopus-controller.service

# Also fix the update script
sed -i "s|\${aws_region}|$AWS_REGION|g" /opt/octopus-controller/update.sh
sed -i "s|\${ecr_backend_url}|$ECR_BACKEND_URL|g" /opt/octopus-controller/update.sh

systemctl daemon-reload
systemctl enable octopus-controller.service

# Try to start the app (will fail if images don't exist yet, that's OK)
echo "Attempting to start application..."
/opt/octopus-controller/update.sh || echo "Images not yet pushed to ECR - run GitHub Actions to deploy"

echo "User-data script completed at $(date)"
echo "EC2 instance is ready!"
echo "Push images to ECR and they will be automatically pulled."
