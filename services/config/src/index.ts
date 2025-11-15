import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const pkgPath = path.join(currentDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.workspaces) {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not find workspace root");
    }
    currentDir = parentDir;
  }
}

const rootDir = findWorkspaceRoot(__dirname);
const envPath = path.join(rootDir, ".env");

dotenv.config({ path: envPath });

export const config = Object.freeze({
  global: {
    environment: process.env.ENVIRONMENT,
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    endpoint: process.env.AWS_ENDPOINT,
  },
  server: {
    host: process.env.SERVER_HOST ?? '0.0.0.0',
    port: Number(process.env.SERVER_PORT) ?? 5000,
    secret: process.env.SERVER_SECRET ?? 'secret',
  },
  web_app: {
    port: Number(process.env.WEB_APP_PORT) ?? 3000,
    crypto: {
      aes: {
        keyLength: Number(process.env.CRYPTO_AES_KEY_LENGTH) ?? 256, // bits
        algorithm: process.env.CRYPTO_AES_ALGORITHM ?? 'AES-GCM',
        ivLength: Number(process.env.CRYPTO_AES_IV_LENGTH) ?? 12, // bytes (96 bits for GCM)
        tagLength: Number(process.env.CRYPTO_AES_TAG_LENGTH) ?? 128, // bits
      },
      kek: {
        length: Number(process.env.CRYPTO_KEK_LENGTH) ?? 256, // bits
      },
      kdf: {
        saltLength: Number(process.env.CRYPTO_KDF_SALT_LENGTH) ?? 16, // bytes
        defaultIterations: Number(process.env.CRYPTO_KDF_ITERATIONS) ?? 3,
        defaultMemory: Number(process.env.CRYPTO_KDF_MEMORY) ?? 65536, // KiB (64 MiB)
        defaultParallelism: Number(process.env.CRYPTO_KDF_PARALLELISM) ?? 4,
        pbkdf2Iterations: Number(process.env.CRYPTO_PBKDF2_ITERATIONS) ?? 10000,
      },
    },
    root: {
      meta: {
        version: Number(process.env.ROOT_META_VERSION) ?? 1,
      },
      map: {
        version: Number(process.env.ROOT_MAP_VERSION) ?? 1,
      },
    },
    notebook: {
      cache: {
        key: process.env.NOTEBOOK_LIST_CACHE_KEY ?? 'notebook-list',
        ttl: Number(process.env.NOTEBOOK_LIST_CACHE_TTL) ?? 5 * 60 * 1000, // milliseconds (5 minutes)
      },
      manifest: {
        version: Number(process.env.NOTEBOOK_MANIFEST_VERSION) ?? 1,
      },
      meta: {
        version: Number(process.env.NOTEBOOK_META_VERSION) ?? 1,
      },
      blobs: {
        maxSize: Number(process.env.NOTEBOOK_BLOBS_CACHE_MAX_SIZE) ?? 50,
      },
    },
  },
});

export type Config = typeof config;
