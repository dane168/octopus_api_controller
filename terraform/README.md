# Octopus Controller - AWS EC2 Deployment

Deploy the Octopus Controller to AWS EC2 using Terraform. Uses ARM/Graviton instances and ECR for container storage.

## Cost

| Resource | Monthly Cost |
|----------|--------------|
| **t4g.small** (2 vCPU, 2 GB) | **FREE** until Dec 2026 |
| EBS Root (30GB) | ~$2.40 |
| EBS Data (8GB) | ~$0.64 |
| ECR Storage | ~$0.10/GB |
| **Total** | **~$3-4/month** |

---

## How It Works

1. **Terraform** creates: EC2, VPC, ECR repos, EBS volumes
2. **GitHub Actions** builds ARM64 images and pushes to ECR
3. **EC2** automatically pulls images from ECR and runs them
4. Every push to `main`/`master` triggers auto-deploy

---

## Step 1: Generate Secrets

```powershell
# Generate two secrets (copy each output)
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
```

---

## Step 2: Configure Terraform

```powershell
cd c:\Users\danie\Documents\github\octopus_api_controller\terraform
copy terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
jwt_secret     = "paste-your-first-secret-here"
encryption_key = "paste-your-second-secret-here"
```

---

## Step 3: Deploy Infrastructure

```powershell
terraform init
terraform apply
```

Type `yes` when prompted. Wait 3-5 minutes.

**Save the outputs** - you'll need them for GitHub secrets:
```
public_ip        = "54.xxx.xxx.xxx"
instance_id      = "i-0abc123..."
ecr_backend_url  = "123456789.dkr.ecr.us-east-1.amazonaws.com/octopus-controller/backend"
ecr_frontend_url = "123456789.dkr.ecr.us-east-1.amazonaws.com/octopus-controller/frontend"
```

---

## Step 4: Configure GitHub Secrets

Go to your GitHub repo: **Settings > Secrets and variables > Actions**

Add these 5 secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `EC2_INSTANCE_ID` | From terraform output (e.g., `i-0abc123...`) |
| `ECR_BACKEND_URL` | From terraform output |
| `ECR_FRONTEND_URL` | From terraform output |

---

## Step 5: Deploy Application

Push to `main` or `master` branch:
```powershell
git add .
git commit -m "Deploy to AWS"
git push
```

GitHub Actions will:
1. Build ARM64 Docker images
2. Push to ECR
3. SSH into EC2 and pull new images
4. Restart containers

**First deploy takes ~10 minutes** (subsequent deploys ~3 minutes).

---

## Step 6: Update Google OAuth

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Find your OAuth 2.0 Client ID
2. Add **Authorized JavaScript origins**: `http://YOUR_PUBLIC_IP`
3. Add **Authorized redirect URIs**: `http://YOUR_PUBLIC_IP`

---

## Step 7: Access Your App

```
http://YOUR_PUBLIC_IP
```

---

## Auto-Deploy Flow

```
Code Push → GitHub Actions → Build ARM64 Images → Push to ECR → SSM to EC2 → Pull & Restart
```

Every push to main/master automatically deploys. No manual SSH needed.

---

## Manual Commands

### Connect to EC2 (if needed)
```powershell
aws ssm start-session --target i-0abc123...
```

### View Logs
```bash
sudo su -
cd /opt/octopus-controller
docker compose logs -f
```

### Force Update
```bash
./update.sh
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

**Warning**: This deletes your database!

---

## Troubleshooting

### GitHub Actions failing?
- Check secrets are set correctly
- Check AWS credentials have ECR and SSM permissions

### App not starting?
```bash
# On EC2
sudo cat /var/log/user-data.log
docker compose logs backend
```

### Images not pulling?
```bash
# Check ECR login works
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
```
