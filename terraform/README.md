# Octopus Controller - Hetzner Cloud Deployment

Deploy the Octopus Controller to Hetzner Cloud using Terraform. Uses GHCR for container storage and SSH for deployment.

## Cost

| Resource | Monthly Cost |
|----------|--------------|
| **CX22** (2 vCPU, 4GB RAM, 40GB SSD) | ~€3.99 |
| Volume (10GB) | ~€0.48 |
| GHCR | Free (public repo) |
| **Total** | **~€4.47/month** |

---

## How It Works

1. **Terraform** creates: Hetzner server, firewall, persistent volume
2. **GitHub Actions** builds AMD64 images and pushes to GHCR
3. **Server** pulls images from GHCR via SSH deploy
4. Every push to `main`/`master` triggers auto-deploy

---

## Step 1: Prerequisites

```powershell
# Generate two secrets (copy each output)
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY

# Generate SSH key pair for deployment (no passphrase)
ssh-keygen -t ed25519 -C "octopus-deploy" -f ~/.ssh/octopus_deploy -N ""
```

Get a Hetzner API token: [console.hetzner.cloud](https://console.hetzner.cloud) > Project > Security > API Tokens > Generate API Token (Read & Write).

---

## Step 2: Configure Terraform

```powershell
cd terraform
```

Edit `terraform.tfvars`:
```hcl
hcloud_token   = "your-hetzner-api-token"
ssh_public_key = "ssh-ed25519 AAAA... (paste contents of ~/.ssh/octopus_deploy.pub)"
```

---

## Step 3: Deploy Infrastructure

```powershell
terraform init
terraform apply
```

Type `yes` when prompted. Wait 3-5 minutes for cloud-init to complete.

**Save the outputs** - you'll need them for GitHub secrets:
```
server_ip = "49.12.xxx.xxx"
```

---

## Step 4: Configure GitHub Secrets

Go to your GitHub repo: **Settings > Secrets and variables > Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `HETZNER_SSH_PRIVATE_KEY` | Contents of `~/.ssh/octopus_deploy` (private key) |
| `SERVER_IP` | From terraform output |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `JWT_SECRET` | Generated in Step 1 |
| `ENCRYPTION_KEY` | Generated in Step 1 |
| `FRONTEND_URL` | `https://switchopus.com` or `http://SERVER_IP` |

---

## Step 5: Deploy Application

Push to `main` or `master` branch:
```powershell
git add .
git commit -m "Deploy to Hetzner"
git push
```

GitHub Actions will:
1. Build AMD64 Docker images
2. Push to GHCR
3. SSH into server and pull new images
4. Restart containers

**First deploy takes ~10 minutes** (subsequent deploys ~3 minutes).

---

## Step 6: Update Google OAuth

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Find your OAuth 2.0 Client ID
2. Add **Authorized JavaScript origins**: your FRONTEND_URL
3. Add **Authorized redirect URIs**: your FRONTEND_URL

---

## Step 7: Access Your App

```
http://YOUR_SERVER_IP
```

---

## Auto-Deploy Flow

```
Code Push → GitHub Actions → Build Images → Push to GHCR → SSH to Server → Pull & Restart
```

Every push to main/master automatically deploys. No manual SSH needed.

---

## Manual Commands

### Connect to Server
```powershell
ssh -i ~/.ssh/octopus_deploy root@YOUR_SERVER_IP
```

### View Logs
```bash
cd /opt/octopus-controller
docker compose logs -f
```

### Force Redeploy
```bash
cd /opt/octopus-controller
./deploy.sh
```

### Check Status
```bash
docker compose ps
```

---

## Destroying Everything

```powershell
terraform destroy
```

**Warning**: This deletes your server and database volume!

---

## Troubleshooting

### GitHub Actions failing?
- Check secrets are set correctly in repo settings
- Ensure GHCR packages are public (repo Settings > Packages)

### App not starting?
```bash
# On server
cat /var/log/user-data.log
docker compose logs backend
```

### Cloud-init not finished?
```bash
# Check if cloud-init is still running
cloud-init status
```
