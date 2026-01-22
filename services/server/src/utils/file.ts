import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@runestone/config";

const bucket = config.aws.bucket ?? "";

const s3Config: {
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
} = {
  region: config.aws.region ?? "",
  forcePathStyle: true,
};

if (config.aws.endpoint) {
  s3Config.endpoint = config.aws.endpoint;
}

// If the access key id starts with "AKIA" (AWS IAM access key), then use the credentials
if (config.aws.accessKeyId && config.aws.secretAccessKey && config.aws.accessKeyId.startsWith("AKIA")) {
  s3Config.credentials = {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  };
}

const s3 = new S3Client(s3Config);

export async function getFile(
  fileKey: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return url;
}

export async function upsertFile(
  fileKey: string,
  contentLength?: number,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ...(contentLength !== undefined && { ContentLength: contentLength }),
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return url;
}

export async function deleteFile(
  fileKey: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: fileKey });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return url;
}
