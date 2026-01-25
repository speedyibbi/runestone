# Infrastructure as Code

This directory contains Terraform configuration files for deploying infrastructure on AWS.

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

### Option 1: Generate from .env file (Recommended)

1. **Create a `.env` file** in the project root (based on `sample.env`):
   - Set `AWS_REGION` to your preferred region
   - Set `AWS_S3_BUCKET_NAME` to a globally unique bucket name
   - Set `AWS_ENDPOINT` if using LocalStack or custom endpoint
   - Set Terraform backend variables:
     - `TF_STATE_BUCKET`: S3 bucket for Terraform state
     - `TF_STATE_KEY`: Path to state file in bucket (defaults to `PROJECT_NAME/ENVIRONMENT/terraform.tfstate}`)
     - `TF_STATE_REGION`: AWS region for state bucket (defaults to `AWS_REGION` if not set)
     - `TF_STATE_LOCK_TABLE`: DynamoDB table for state locking
   - Configure other variables as needed

2. **Generate `terraform.tfvars` and `backend.hcl` from `.env`**:
   ```bash
   cd terraform
   ./generate-tfvars.sh
   ```
   This script reads your `.env` file and generates:
   - `terraform.tfvars` with all the appropriate mappings
   - `backend.hcl` with backend configuration

3. **Initialize Terraform**:
   ```bash
   terraform init -backend-config=backend.hcl
   ```

4. **Review the plan**:
   ```bash
   terraform plan
   ```

5. **Apply the configuration**:
   ```bash
   terraform apply
   ```

6. **After deployment**, update `cloudfront_cors_allowed_origins`:
   - Get the CloudFront URL from the outputs
   - Update `CLOUDFRONT_CORS_ALLOWED_ORIGINS` in your `.env` file (or edit `terraform.tfvars` directly)
   - Run `./generate-tfvars.sh` again (if using .env), then `terraform apply`

### Option 2: Manual Configuration

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

### Variable Mappings (.env → terraform.tfvars)

When using `generate-tfvars.sh`, the following `.env` variables are automatically mapped:

| .env Variable | Terraform Variable | Notes |
|--------------|-------------------|-------|
| `AWS_REGION` | `aws_region` | AWS region for resources |
| `AWS_S3_BUCKET_NAME` | `s3_bucket_name` | Must be globally unique |
| `AWS_ENDPOINT` | `lambda_environment_variables.AWS_ENDPOINT` | For LocalStack or custom endpoints |
| `FILE_UPLOAD_MAX_SIZE` | `lambda_file_upload_max_size` | Max file upload size in bytes |
| `MODE` | `environment` | Environment name (prod, staging, dev) |

### Backend Configuration (.env → backend.hcl)

The following `.env` variables are used to generate `backend.hcl` (gitignored):

| .env Variable | Backend Config | Notes |
|--------------|----------------|-------|
| `TF_STATE_BUCKET` | `bucket` | S3 bucket for Terraform state storage |
| `TF_STATE_KEY` | `key` | Path to state file in bucket |
| `TF_STATE_REGION` | `region` | AWS region for state bucket |
| `TF_STATE_LOCK_TABLE` | `dynamodb_table` | DynamoDB table for state locking |

### Key Variables

- `s3_bucket_name`: Must be globally unique
- `lambda_environment_variables`: Environment variables for Lambda
- `cloudfront_cors_allowed_origins`: CORS allowed origins (use CloudFront URL for production)

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

**Warning**: This will delete all resources including the S3 bucket and all its contents!
