variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type (t4g = ARM/Graviton)"
  type        = string
  default     = "t4g.small" # 2 vCPU, 2 GB RAM - FREE TIER until Dec 2026 (750 hrs/month)
  # Alternative: "t4g.nano" = 2 vCPU, 0.5 GB RAM (~$3/month) - smallest paid option
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access (optional, leave empty to skip)"
  type        = string
  default     = ""
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into the instance (set to your IP for security)"
  type        = list(string)
  default     = [] # Empty = no SSH access, set to ["your.ip.address/32"] to enable
}

variable "ebs_volume_size" {
  description = "Size of the EBS volume for persistent data (GB)"
  type        = number
  default     = 30
}

# Application environment variables
variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (generate with: openssl rand -hex 32)"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for Tuya credentials (generate with: openssl rand -hex 32)"
  type        = string
  sensitive   = true
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "custom_domain" {
  description = "Custom domain for the application (e.g., switchopus.com). Leave empty to use nip.io"
  type        = string
  default     = "switchopus.com"
}
