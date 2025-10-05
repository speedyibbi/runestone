import path from "path";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";
import { config } from "@runestone/config"

const bucket = config.aws.bucket;

const s3 = new S3Client({
  region: config.aws.region,
  endpoint: config.aws.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export async function getFile(fileKey: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
  return await getSignedUrl(s3, command, { expiresIn });
}

export async function upsertFile(fileKey: string, expiresIn = 3600): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: fileKey });
  return await getSignedUrl(s3, command, { expiresIn });
}

export async function deleteFile(fileKey: string, expiresIn = 3600): Promise<string> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: fileKey });
  return await getSignedUrl(s3, command, { expiresIn });
}
