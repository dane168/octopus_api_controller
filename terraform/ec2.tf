# IAM Role for EC2 (for SSM access and CloudWatch)
resource "aws_iam_role" "ec2_role" {
  name = "octopus-controller-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Attach SSM policy for remote access without SSH
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ECR read-only policy for pulling images
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "octopus-controller-instance-profile"
  role = aws_iam_role.ec2_role.name
}

# EC2 Instance (ARM/Graviton)
resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_arm.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name != "" ? var.key_pair_name : null

  # Root volume (30GB minimum for Amazon Linux 2023 ARM AMI)
  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  # User data script to set up Docker (images pulled from ECR, no builds on EC2)
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    google_client_id = var.google_client_id
    jwt_secret       = var.jwt_secret
    encryption_key   = var.encryption_key
    log_level        = var.log_level
    ecr_backend_url  = aws_ecr_repository.backend.repository_url
    ecr_frontend_url = aws_ecr_repository.frontend.repository_url
    aws_region       = var.aws_region
  }))

  # Enable detailed monitoring (optional, costs extra)
  monitoring = false

  tags = {
    Name = "octopus-controller"
  }

  # Wait for instance to be ready
  lifecycle {
    create_before_destroy = true
  }
}

# EBS Volume for persistent SQLite data
resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_availability_zones.available.names[0]
  size              = var.ebs_volume_size
  type              = "gp3"
  encrypted         = true

  tags = {
    Name = "octopus-controller-data"
  }
}

# Attach EBS volume to EC2 instance
resource "aws_volume_attachment" "data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.app.id

  # Don't force detach - allows graceful shutdown
  force_detach = false
}

# Elastic IP for static public address
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "octopus-controller-eip"
  }

  depends_on = [aws_internet_gateway.main]
}
