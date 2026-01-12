output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Public IP address (Elastic IP)"
  value       = aws_eip.app.public_ip
}

output "public_dns" {
  description = "Public DNS name"
  value       = aws_eip.app.public_dns
}

output "app_url" {
  description = "Application URL"
  value       = "http://${aws_eip.app.public_ip}"
}

output "ssh_command" {
  description = "SSH command (if SSH is enabled)"
  value       = var.key_pair_name != "" ? "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_eip.app.public_ip}" : "SSH not enabled (no key pair specified)"
}

output "ssm_command" {
  description = "SSM Session Manager command (no SSH needed)"
  value       = "aws ssm start-session --target ${aws_instance.app.id}"
}

output "instance_type" {
  description = "EC2 instance type"
  value       = var.instance_type
}

output "ami_id" {
  description = "AMI ID used"
  value       = data.aws_ami.amazon_linux_arm.id
}

output "ebs_volume_id" {
  description = "EBS data volume ID"
  value       = aws_ebs_volume.data.id
}

# ECR Outputs - needed for GitHub Actions secrets
output "ecr_backend_url" {
  description = "ECR Backend repository URL (add to GitHub secrets as ECR_BACKEND_URL)"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "ECR Frontend repository URL (add to GitHub secrets as ECR_FRONTEND_URL)"
  value       = aws_ecr_repository.frontend.repository_url
}

# GitHub Secrets Summary
output "github_secrets_needed" {
  description = "GitHub Actions secrets you need to configure"
  value       = <<-EOT

    ============================================
    Add these secrets to GitHub Repository:
    Settings > Secrets and variables > Actions
    ============================================

    AWS_ACCESS_KEY_ID     = (your AWS access key)
    AWS_SECRET_ACCESS_KEY = (your AWS secret key)
    EC2_INSTANCE_ID       = ${aws_instance.app.id}
    ECR_BACKEND_URL       = ${aws_ecr_repository.backend.repository_url}
    ECR_FRONTEND_URL      = ${aws_ecr_repository.frontend.repository_url}

    ============================================
  EOT
}
