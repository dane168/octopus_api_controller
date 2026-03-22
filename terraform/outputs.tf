output "server_ip" {
  description = "Server public IPv4 address"
  value       = hcloud_server.app.ipv4_address
}

output "server_status" {
  description = "Server status"
  value       = hcloud_server.app.status
}

output "app_url" {
  description = "Application URL"
  value       = "http://${hcloud_server.app.ipv4_address}"
}

output "ssh_command" {
  description = "SSH command to connect to server"
  value       = "ssh root@${hcloud_server.app.ipv4_address}"
}

output "volume_id" {
  description = "Persistent data volume ID"
  value       = hcloud_volume.data.id
}

output "github_secrets_needed" {
  description = "GitHub Actions secrets to configure"
  value       = <<-EOT

    ============================================
    Add these secrets to GitHub Repository:
    Settings > Secrets and variables > Actions
    ============================================

    HETZNER_SSH_PRIVATE_KEY = (private key matching your deploy key)
    SERVER_IP               = ${hcloud_server.app.ipv4_address}
    GOOGLE_CLIENT_ID        = (your Google OAuth Client ID)
    JWT_SECRET              = (generate with: openssl rand -hex 32)
    ENCRYPTION_KEY          = (generate with: openssl rand -hex 32)
    FRONTEND_URL            = https://${var.custom_domain}

    ============================================
  EOT
}
