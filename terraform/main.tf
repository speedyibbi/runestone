provider "aws" {
  region = var.aws_region
}

locals {
  common_tags = merge(
    {
    },
    var.tags
  )
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# S3 Bucket
# ============================================================================

resource "aws_s3_bucket" "storage" {
  bucket = var.s3_bucket_name

  force_destroy = true

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = var.s3_enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "storage" {
  bucket = aws_s3_bucket.storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cloudfront_cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ============================================================================
# Lambda Function
# ============================================================================

resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-${var.environment}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "lambda_s3_access" {
  name = "${var.project_name}-${var.environment}-lambda-s3-access"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectAttributes"
        ]
        Resource = "${aws_s3_bucket.storage.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.storage.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "server" {
  filename         = var.lambda_zip_path
  function_name    = "${var.lambda_function_name}-${var.environment}"
  role             = aws_iam_role.lambda_execution.arn
  handler          = var.lambda_handler
  runtime          = var.lambda_runtime
  memory_size      = var.lambda_memory_size
  timeout          = var.lambda_timeout
  ephemeral_storage {
    size = var.lambda_ephemeral_storage_size
  }

  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : null

  environment {
    variables = merge(
      {
        MODE                 = var.environment
        SERVERLESS           = "true"
        AWS_S3_BUCKET        = aws_s3_bucket.storage.id
        FILE_UPLOAD_MAX_SIZE = tostring(var.lambda_file_upload_max_size)
      },
      var.lambda_environment_variables
    )
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.server.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# API Gateway HTTP API
# ============================================================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-${var.environment}"
  protocol_type = "HTTP"
  description   = "API Gateway for ${var.project_name}"

  cors_configuration {
    allow_origins = var.cloudfront_cors_allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers = ["Content-Type", "x-lookup"]
    max_age       = 86400
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.main.id

  integration_uri    = aws_lambda_function.server.invoke_arn
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /{proxy+}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  tags = local.common_tags
}

# ============================================================================
# CloudFront Distribution
# ============================================================================

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = var.cloudfront_origin_access_control_name
  description                       = "OAC for ${var.project_name} S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_response_headers_policy" "wasm_headers" {
  name = "${var.project_name}-${var.environment}-wasm-headers"

  # Custom headers for WASM files
  # Note: Content-Type should be set correctly in S3 when uploading .wasm files
  # This policy ensures CORS headers are present and allows proper WASM loading
  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_origins {
      items = var.cloudfront_cors_allowed_origins
    }
    access_control_max_age_sec = 86400
    origin_override             = true
  }

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "Cross-Origin-Embedder-Policy"
      value    = "require-corp"
      override = true
    }
    items {
      header   = "Cross-Origin-Opener-Policy"
      value    = "same-origin"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.cloudfront_price_class
  default_root_object = "index.html"

  # S3 Origin
  origin {
    domain_name              = aws_s3_bucket.storage.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.storage.id}"
    origin_path              = "/static"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  # API Gateway Origin
  origin {
    domain_name = replace(aws_apigatewayv2_api.main.api_endpoint, "/^https?://([^/]+).*/", "$1")
    origin_id   = "API-${aws_apigatewayv2_api.main.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior (S3 - static assets)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.storage.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.wasm_headers.id
  }

  # API cache behavior
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "API-${aws_apigatewayv2_api.main.id}"
    viewer_protocol_policy = "https-only"
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}

resource "aws_s3_bucket_policy" "cloudfront_oac" {
  bucket = aws_s3_bucket.storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.storage.arn}/static/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}
