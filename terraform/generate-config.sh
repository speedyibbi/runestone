#!/bin/bash
# Generate terraform.tfvars and backend.hcl from .env file or environment variables
# This script can be used locally (with .env file) or in CI/CD (with environment variables)

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Load .env file if it exists
if [ -f "$ENV_FILE" ]; then
  echo "Loading variables from .env file..."
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "No .env file found, using environment variables..."
fi

# Set variables (environment variables take precedence over .env file)
PROJECT_NAME="${PROJECT_NAME:-}"
ENVIRONMENT="${ENVIRONMENT:-${MODE:-}}"
AWS_REGION="${AWS_REGION:-}"
S3_BUCKET_NAME="${AWS_S3_BUCKET_NAME:-}"
S3_ENABLE_VERSIONING="${AWS_S3_ENABLE_VERSIONING:-false}"
LAMBDA_FUNCTION_NAME="${AWS_LAMBDA_FUNCTION_NAME:-server}"
LAMBDA_RUNTIME="${AWS_LAMBDA_RUNTIME:-nodejs22.x}"
LAMBDA_HANDLER="${AWS_LAMBDA_HANDLER:-lambda.handler}"
LAMBDA_MEMORY_SIZE="${AWS_LAMBDA_MEMORY_SIZE:-512}"
LAMBDA_TIMEOUT="${AWS_LAMBDA_TIMEOUT:-30}"
LAMBDA_EPHEMERAL_STORAGE_SIZE="${AWS_LAMBDA_EPHEMERAL_STORAGE_SIZE:-512}"
LAMBDA_FILE_UPLOAD_MAX_SIZE="${FILE_UPLOAD_MAX_SIZE:-10485760}"
LAMBDA_ZIP_PATH="${AWS_LAMBDA_ZIP_PATH:-../services/server/.lambda-build/function.zip}"
CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME="${AWS_CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME:-s3-oac}"
CLOUDFRONT_PRICE_CLASS="${AWS_CLOUDFRONT_PRICE_CLASS:-PriceClass_All}"
CLOUDFRONT_CORS_ALLOWED_ORIGINS="${AWS_CLOUDFRONT_CORS_ALLOWED_ORIGINS:-*}"

# Set backend variables
TF_STATE_BUCKET="${TF_STATE_BUCKET:-}"
TF_STATE_KEY="${TF_STATE_KEY:-}"
TF_STATE_REGION="${TF_STATE_REGION:-${AWS_REGION:-}}"
TF_STATE_LOCK_TABLE="${TF_STATE_LOCK_TABLE:-}"

# Auto-generate TF_STATE_KEY if not provided
if [ -z "$TF_STATE_KEY" ] && [ -n "$PROJECT_NAME" ] && [ -n "$ENVIRONMENT" ]; then
  TF_STATE_KEY="${PROJECT_NAME}/${ENVIRONMENT}/terraform.tfstate"
fi

# Validate required variables
if [ -z "$S3_BUCKET_NAME" ]; then
  echo "Warning: AWS_S3_BUCKET_NAME is not set"
  echo "You'll need to set s3_bucket_name manually in terraform.tfvars"
fi

# Generate terraform.tfvars
TFVARS_FILE="$SCRIPT_DIR/terraform.tfvars"

cat > "$TFVARS_FILE" <<EOF
project_name = "${PROJECT_NAME}"
environment  = "${ENVIRONMENT}"
aws_region   = "${AWS_REGION}"

# S3 Bucket Configuration
s3_bucket_name        = "${S3_BUCKET_NAME}"
s3_enable_versioning  = ${S3_ENABLE_VERSIONING}

# Lambda Configuration
lambda_function_name          = "${LAMBDA_FUNCTION_NAME}"
lambda_runtime                = "${LAMBDA_RUNTIME}"
lambda_handler                = "${LAMBDA_HANDLER}"
lambda_memory_size            = ${LAMBDA_MEMORY_SIZE}
lambda_timeout                = ${LAMBDA_TIMEOUT}
lambda_ephemeral_storage_size = ${LAMBDA_EPHEMERAL_STORAGE_SIZE}
lambda_file_upload_max_size   = ${LAMBDA_FILE_UPLOAD_MAX_SIZE}
lambda_zip_path               = "${LAMBDA_ZIP_PATH}"

# Lambda Environment Variables
# Note: MODE, SERVERLESS, AWS_S3_BUCKET, and FILE_UPLOAD_MAX_SIZE are set automatically
lambda_environment_variables = {
  AWS_ENDPOINT = "${AWS_ENDPOINT:-}"
EOF

cat >> "$TFVARS_FILE" <<EOF
}

# CloudFront Configuration
cloudfront_origin_access_control_name = "${CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME}"
cloudfront_price_class                = "${CLOUDFRONT_PRICE_CLASS}"
# For production, set this to your CloudFront URL after deployment
cloudfront_cors_allowed_origins = ["${CLOUDFRONT_CORS_ALLOWED_ORIGINS}"]

# Tags
tags = {
  project     = "${PROJECT_NAME}"
  environment = "${ENVIRONMENT}"
}
EOF

# Generate backend.hcl
BACKEND_FILE="$SCRIPT_DIR/backend.hcl"

cat > "$BACKEND_FILE" <<EOF
bucket         = "${TF_STATE_BUCKET}"
key            = "${TF_STATE_KEY}"
region         = "${TF_STATE_REGION}"
dynamodb_table = "${TF_STATE_LOCK_TABLE}"
EOF

echo "✓ Generated terraform.tfvars"
echo "  Location: $TFVARS_FILE"
echo "✓ Generated backend.hcl"
echo "  Location: $BACKEND_FILE"
if [ -z "$S3_BUCKET_NAME" ]; then
  echo ""
  echo "⚠ Warning: AWS_S3_BUCKET_NAME was not set"
  echo "  Please edit terraform.tfvars and set s3_bucket_name manually"
fi
