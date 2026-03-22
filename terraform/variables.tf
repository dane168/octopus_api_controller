variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Hetzner datacenter location (nbg1=Nuremberg, fsn1=Falkenstein, hel1=Helsinki)"
  type        = string
  default     = "nbg1"
}

variable "server_type" {
  description = "Hetzner server type (cx22 = 2 vCPU AMD, 4GB RAM, 40GB SSD)"
  type        = string
  default     = "cx22"
}

variable "volume_size" {
  description = "Size of persistent volume for SQLite database (GB)"
  type        = number
  default     = 10
}

variable "ssh_public_key" {
  description = "SSH public key for server access and CI/CD deployment"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain for the application (e.g., switchopus.com)"
  type        = string
  default     = "switchopus.com"
}

variable "ghcr_owner" {
  description = "GitHub username/org for GHCR image paths"
  type        = string
  default     = "dane168"
}
