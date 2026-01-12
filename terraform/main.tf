terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "octopus-controller"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data source to get the latest Amazon Linux 2023 ARM64 AMI
data "aws_ami" "amazon_linux_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# Get available AZs
data "aws_availability_zones" "available" {
  state = "available"
}
