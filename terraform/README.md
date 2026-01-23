# Runestone Infrastructure as Code

This directory contains Terraform configuration files for deploying the Runestone infrastructure on AWS.

## Architecture

The infrastructure consists of:

- **S3 Bucket**: Storage
- **Lambda Function**: Serverless backend API
- **API Gateway**: HTTP API that routes requests to Lambda
- **CloudFront**: CDN that serves the web app and proxies API requests

## Prerequisites

1. **AWS Account**: You need an AWS account with appropriate permissions
2. **Terraform**: Install Terraform >= 1.0
3. **AWS CLI**: Install and configure AWS CLI (optional, but helpful)
4. **Lambda Package**: Build the Lambda deployment package:
   ```bash
   npm run build
   ```
   This creates `services/server/.lambda-build/function.zip`
5. **Web App Build**: Build the web app:
   ```bash
   npm run build
   ```
   This creates `services/web_app/dist/` directory

## Setup

1. **Copy the example variables file**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit `terraform.tfvars`** with your values:
   - Set `s3_bucket_name` to a globally unique bucket name
   - Set `aws_region` to your preferred region
   - Configure other variables as needed

3. **Initialize Terraform**:
   ```bash
   cd terraform
   terraform init
   ```

4. **Review the plan**:
   ```bash
   terraform plan
   ```

5. **Apply the configuration**:
   ```bash
   terraform apply
   ```

6. **After deployment**, update `cloudfront_cors_allowed_origins` in `terraform.tfvars`:
   - Get the CloudFront URL from the outputs
   - Update the variable to use the CloudFront URL instead of `*`
   - Run `terraform apply` again

## Deployment

### Deploy Lambda Function

1. Build the Lambda package:
   ```bash
   npm run build
   ```

2. Update the Lambda function:
   ```bash
   cd terraform
   terraform apply -target=aws_lambda_function.server
   ```

### Deploy Web App

1. Build the web app:
   ```bash
   npm run build
   ```

2. Upload files to S3:
   ```bash
   aws s3 sync services/web_app/dist/ s3://BUCKET_NAME/static/ --delete
   ```

3. Invalidate CloudFront cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
   ```

## Outputs

After running `terraform apply`, you'll get outputs with:
- S3 bucket name
- Lambda function ARN
- API Gateway endpoint
- CloudFront distribution ID and URL

View outputs with:
```bash
terraform output
```

## Variables

See `variables.tf` for all available variables and their descriptions.

Key variables:
- `s3_bucket_name`: Must be globally unique
- `lambda_environment_variables`: Environment variables for Lambda
- `cloudfront_cors_allowed_origins`: CORS allowed origins (use CloudFront URL for production)

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

**Warning**: This will delete all resources including the S3 bucket and all its contents!
