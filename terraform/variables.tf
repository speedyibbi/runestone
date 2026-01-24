variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "runestone"
}

variable "environment" {
  description = "Environment name (e.g., prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "runestone-api"
}

variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs22.x"
}

variable "lambda_handler" {
  description = "Lambda handler function"
  type        = string
  default     = "lambda.handler"
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_ephemeral_storage_size" {
  description = "Lambda ephemeral storage size in MB"
  type        = number
  default     = 512
}

variable "lambda_file_upload_max_size" {
  description = "Maximum file upload size in bytes"
  type        = number
  default     = 10485760 # 10MB
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket (must be globally unique)"
  type        = string
}

variable "s3_enable_versioning" {
  description = "Enable versioning on S3 bucket"
  type        = bool
  default     = false
}

variable "cloudfront_origin_access_control_name" {
  description = "Name for CloudFront Origin Access Control"
  type        = string
  default     = "runestone-s3-oac"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_All"
}

variable "cloudfront_cors_allowed_origins" {
  description = "Allowed origins for CORS (use '*' for all or CloudFront URL for production)"
  type        = list(string)
  default     = ["*"]
}

variable "lambda_environment_variables" {
  description = "Environment variables for Lambda function"
  type        = map(string)
  default     = {}
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment zip file"
  type        = string
  default     = "../services/server/.lambda-build/function.zip"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
