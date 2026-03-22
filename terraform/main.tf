terraform {
  required_version = ">= 1.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# SSH key for server access and CI/CD deployment
resource "hcloud_ssh_key" "deploy" {
  name       = "octopus-controller-deploy"
  public_key = var.ssh_public_key
}
