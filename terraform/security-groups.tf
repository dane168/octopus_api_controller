# Security Group for EC2 instance
resource "aws_security_group" "app" {
  name        = "octopus-controller-sg"
  description = "Security group for Octopus Controller application"
  vpc_id      = aws_vpc.main.id

  # HTTP access from anywhere
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH access (only if allowed_ssh_cidrs is set)
  dynamic "ingress" {
    for_each = length(var.allowed_ssh_cidrs) > 0 ? [1] : []
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidrs
    }
  }

  # All outbound traffic
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "octopus-controller-sg"
  }
}
