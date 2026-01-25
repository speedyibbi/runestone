# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## Workflows

### CI (`ci.yml`)
Runs on pull requests to `main` or `master` to validate code and infrastructure syntax:
- Lints code
- Builds the application
- Validates Terraform formatting (`terraform fmt -check`)
- Validates Terraform syntax (`terraform validate -backend=false`)
- **No AWS credentials needed** - only syntax validation, no actual infrastructure checks

### CD (`cd.yml`)
Runs on pushes to `main` or `master` branch or manual trigger:
- Builds the application
- Generates Terraform configuration using `generate-config.sh`
- Deploys infrastructure with Terraform
- Uploads web app to S3
- Invalidates CloudFront cache

## GitHub Environments

The CD workflow uses GitHub Environments to organize secrets per environment. Currently configured for a `prod` environment.

### Setting Up the `prod` Environment

1. **Create the Environment**:
   - Go to your repository → **Settings → Environments**
   - Click **New environment**
   - Name it `prod`
   - Click **Configure environment**

2. **Add Secrets to the Environment**:
   - In the environment configuration, go to **Environment secrets**
   - Add all the secrets listed below (not repository secrets)
   - Environment secrets take precedence over repository secrets

3. **Optional: Add Protection Rules** (recommended for production):
   - **Required reviewers**: Require approval before deployment
   - **Wait timer**: Add a delay before deployment
   - **Deployment branches**: Restrict which branches can deploy

### Adding More Environments

To add a new environment (e.g., `staging`):

1. Create a new environment in **Settings → Environments**
2. Add environment-specific secrets
3. Update `cd.yml` to use the environment:
   ```yaml
   environment: staging
   ```
4. Optionally create separate workflow files per environment

## Configuration: Secrets and Variables

### Environment Secrets (prod environment)

Add these to **Settings → Environments → prod → Environment secrets**:

#### CLOUD
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region
- `AWS_S3_BUCKET_NAME` - S3 bucket name for application storage
- `AWS_S3_ENABLE_VERSIONING` - Enable S3 versioning
- `AWS_LAMBDA_FUNCTION_NAME` - Lambda function name
- `AWS_LAMBDA_RUNTIME` - Lambda runtime
- `AWS_LAMBDA_MEMORY_SIZE` - Lambda memory in MB
- `AWS_LAMBDA_TIMEOUT` - Lambda timeout in seconds
- `AWS_LAMBDA_EPHEMERAL_STORAGE_SIZE` - Lambda ephemeral storage in MB
- `AWS_CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME` - CloudFront OAC name
- `AWS_CLOUDFRONT_PRICE_CLASS` - CloudFront price class
- `AWS_CLOUDFRONT_CORS_ALLOWED_ORIGINS` - CORS allowed origins

#### INFRASTRUCTURE
- `TF_STATE_BUCKET` - S3 bucket for Terraform state
- `TF_STATE_KEY` - Path to state file
- `TF_STATE_REGION` - AWS region for state bucket
- `TF_STATE_LOCK_TABLE` - DynamoDB table for state locking

### Environment Variables (prod environment)

Add these to **Settings → Environments → prod → Environment variables**:

**Note**: These variables are used during the build step to configure the web app. They are embedded into the application bundle at build time, so changes require a new build to take effect.

#### FEATURE FLAGS
- `FEATURE_CRYPTOGRAPHY`
- `FEATURE_FTS_SEARCH`
- `FEATURE_GRAPH`
- `FEATURE_SYNC`

#### CRYPTO SETTINGS
- `CRYPTO_AES_KEY_LENGTH`
- `CRYPTO_AES_IV_LENGTH`
- `CRYPTO_AES_TAG_LENGTH`
- `CRYPTO_KEK_LENGTH`
- `CRYPTO_KDF_SALT_LENGTH`
- `CRYPTO_ARGON2ID_ITERATIONS`
- `CRYPTO_ARGON2ID_MEMORY`
- `CRYPTO_ARGON2ID_PARALLELISM`
- `CRYPTO_PBKDF2_ITERATIONS`

#### VERSIONS
- `ROOT_META_VERSION`
- `ROOT_MAP_VERSION`
- `ROOT_SETTINGS_VERSION`
- `NOTEBOOK_META_VERSION`
- `NOTEBOOK_MANIFEST_VERSION`

#### STORAGE
- `LOCAL_STORAGE_KEY`
- `LOCAL_STORAGE_EXPIRATION`

#### SERVER & WEB APP COMMONS
- `FILE_UPLOAD_MAX_SIZE`

#### SETTINGS DEFAULT
- `DEFAULT_SETTINGS_AUTO_SYNC`
- `DEFAULT_SETTINGS_SYNC_INTERVAL`
- `DEFAULT_SETTINGS_THEME_ACCENT`
- `DEFAULT_SETTINGS_THEME_FOREGROUND`
- `DEFAULT_SETTINGS_THEME_BACKGROUND`
- `DEFAULT_SETTINGS_THEME_SELECTION`
- `DEFAULT_SETTINGS_THEME_SELECTION_FOCUSED`
- `DEFAULT_SETTINGS_THEME_MUTED`
- `DEFAULT_SETTINGS_THEME_ERROR`
- `DEFAULT_SETTINGS_THEME_SUCCESS`
- `DEFAULT_SETTINGS_THEME_WARNING`
- `DEFAULT_SETTINGS_THEME_INFO`
- `DEFAULT_SETTINGS_THEME_SCALE`

### Repository Variables

Add these to **Settings → Secrets and variables → Actions → Variables**:

#### GLOBAL
- `PROJECT_NAME` - Project name (e.g., `runestone`)

**Note**: The CI workflow does not require any secrets or AWS credentials. It only performs syntax validation of Terraform files without connecting to AWS.

## Setup Instructions

1. **Bootstrap Terraform Backend** (one-time setup):
   ```bash
   # Create S3 bucket for state
   aws s3 mb s3://YOUR_TF_STATE_BUCKET --region YOUR_TF_STATE_REGION
   aws s3api put-bucket-versioning \
     --bucket YOUR_TF_STATE_BUCKET \
     --versioning-configuration Status=Enabled

   # Create DynamoDB table for locking
   aws dynamodb create-table \
     --table-name YOUR_TF_LOCK_TABLE \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

2. **Configure GitHub Secrets and Variables**:
   
   **Repository Variables** (Settings → Secrets and variables → Actions → Variables):
   - `PROJECT_NAME` = `runestone`
   
   **Environment Secrets** (Settings → Environments → `prod` → Environment secrets):
   - Add all secrets listed in "Environment Secrets" section above
   
   **Environment Variables** (Settings → Environments → `prod` → Environment variables):
   - Add all variables listed in "Environment Variables" section above
   
   **Repository Secrets** (Settings → Secrets and variables → Actions → Secrets):
   - Not required - CI workflow only validates syntax and doesn't need AWS access

3. **First Deployment**:
   - Push to `main` or `master` branch or manually trigger the workflow
   - The workflow will create all infrastructure resources

4. **After First Deployment**:
   - Get the CloudFront URL from the deployment summary
   - Update `AWS_CLOUDFRONT_CORS_ALLOWED_ORIGINS` secret with the CloudFront URL
   - Run deployment again to update CORS settings

## Workflow Behavior

### CI Workflow
- **Triggers**: Pull requests to `main` or `master`
- **Actions**: 
  - Lints code
  - Builds application
  - Validates Terraform formatting (`terraform fmt -check`)
  - Validates Terraform syntax (`terraform validate -backend=false`)
- **Purpose**: Catch syntax, formatting, and build errors before merging
- **No AWS Access**: Does not require AWS credentials or secrets - only validates file syntax
- **Fast**: Runs quickly without AWS API calls or backend initialization

### CD Workflow
- **Triggers**: 
  - Pushes to `main` or `master` branch
  - Manual trigger via `workflow_dispatch`
- **Environment**: Uses `prod` environment (secrets from environment, not repository)
- **Actions**: 
  - Builds application
  - Generates Terraform configuration using `generate-config.sh`
  - Validates infrastructure changes (`terraform plan`)
  - Deploys infrastructure (`terraform apply`)
  - Uploads web app to S3
  - Invalidates CloudFront cache
- **Purpose**: Deploy changes to production with full validation
- **Note**: If you set up protection rules, deployments may require approval

## Troubleshooting

### Terraform init fails with credentials error
- Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets are set
- Verify the credentials have permissions to access S3 and DynamoDB

### Terraform apply fails with state lock error
- Another deployment might be running
- Wait for it to complete or manually unlock if needed:
  ```bash
  terraform force-unlock <LOCK_ID>
  ```

### Web app upload fails
- Verify the S3 bucket exists and is accessible
- Check that `AWS_S3_BUCKET_NAME` secret matches the bucket created by Terraform
