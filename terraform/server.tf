# Firewall
resource "hcloud_firewall" "app" {
  name = "octopus-controller-fw"

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "SSH"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "HTTP"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "HTTPS"
  }

  rule {
    direction       = "out"
    protocol        = "tcp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
    description     = "All TCP out"
  }

  rule {
    direction       = "out"
    protocol        = "udp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
    description     = "All UDP out"
  }

  rule {
    direction       = "out"
    protocol        = "icmp"
    destination_ips = ["0.0.0.0/0", "::/0"]
    description     = "ICMP out"
  }

  labels = {
    project     = "octopus-controller"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Persistent volume for SQLite database
resource "hcloud_volume" "data" {
  name     = "octopus-controller-data"
  size     = var.volume_size
  location = var.location
  format   = "ext4"

  labels = {
    project     = "octopus-controller"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Server
resource "hcloud_server" "app" {
  name        = "octopus-controller"
  server_type = var.server_type
  location    = var.location
  image       = "ubuntu-24.04"
  ssh_keys    = [hcloud_ssh_key.deploy.id]

  firewall_ids = [hcloud_firewall.app.id]

  user_data = templatefile("${path.module}/user-data.sh", {
    ghcr_owner    = var.ghcr_owner
    custom_domain = var.custom_domain
    volume_device = "/dev/disk/by-id/scsi-0HC_Volume_${hcloud_volume.data.id}"
  })

  labels = {
    project     = "octopus-controller"
    environment = var.environment
    managed_by  = "terraform"
  }

  depends_on = [hcloud_volume.data]
}

# Attach volume to server
resource "hcloud_volume_attachment" "data" {
  volume_id = hcloud_volume.data.id
  server_id = hcloud_server.app.id
  automount = false
}
