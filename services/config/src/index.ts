import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWorkspaceRoot(startDir: string): string | null {
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
      return null;
    }
    currentDir = parentDir;
  }
}

const rootDir = findWorkspaceRoot(__dirname);
if (rootDir) {
  const envPath = path.join(rootDir, ".env");
  dotenv.config({ path: envPath });
}

export const config = Object.freeze({
  global: {
    project: {
      name: process.env.PROJECT_NAME,
    },
    environment: {
      mode: process.env.MODE,
      serverless: process.env.SERVERLESS ? process.env.SERVERLESS === 'true' : false,
    },
    featureFlags: {
      cryptography: process.env.FEATURE_CRYPTOGRAPHY ? process.env.FEATURE_CRYPTOGRAPHY === 'true' : true,
      ftsSearch: process.env.FEATURE_FTS_SEARCH ? process.env.FEATURE_FTS_SEARCH === 'true' : true,
      graph: process.env.FEATURE_GRAPH ? process.env.FEATURE_GRAPH === 'true' : true,
      sync: process.env.FEATURE_SYNC ? process.env.FEATURE_SYNC === 'true' : true,
    },
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT,
    s3: {
      bucket: process.env.AWS_S3_BUCKET_NAME,
      enableVersioning: process.env.AWS_S3_ENABLE_VERSIONING ? process.env.AWS_S3_ENABLE_VERSIONING === 'true' : false,
    },
    lambda: {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      runtime: process.env.AWS_LAMBDA_RUNTIME,
      handler: process.env.AWS_LAMBDA_HANDLER,
      memorySize: Number(process.env.AWS_LAMBDA_MEMORY_SIZE),
      timeout: Number(process.env.AWS_LAMBDA_TIMEOUT),
      ephemeralStorageSize: Number(process.env.AWS_LAMBDA_EPHEMERAL_STORAGE_SIZE),
    },
    cloudfront: {
      originAccessControlName: process.env.AWS_CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME,
      priceClass: process.env.AWS_CLOUDFRONT_PRICE_CLASS,
      corsAllowedOrigins: process.env.AWS_CLOUDFRONT_CORS_ALLOWED_ORIGINS,
    },
    infrastructure: {
      stateBucket: process.env.TF_STATE_BUCKET,
      stateKey: process.env.TF_STATE_KEY,
      stateRegion: process.env.TF_STATE_REGION,
      stateLockTable: process.env.TF_STATE_LOCK_TABLE,
    },
  },
  server: {
    host: process.env.SERVER_HOST ?? '0.0.0.0',
    port: Number(process.env.SERVER_PORT) ?? 5000,
    fileUpload: {
      maxSize: Number(process.env.FILE_UPLOAD_MAX_SIZE) ?? 10485760, // bytes (10MB)
    },
  },
  web_app: {
    port: Number(process.env.WEB_APP_PORT) ?? 3000,
    fileUpload: {
      maxSize: Number(process.env.FILE_UPLOAD_MAX_SIZE) ?? 10485760, // bytes (10MB)
    },
    crypto: {
      aes: {
        keyLength: Number(process.env.CRYPTO_AES_KEY_LENGTH) ?? 256, // bits
        ivLength: Number(process.env.CRYPTO_AES_IV_LENGTH) ?? 12, // bytes (96 bits for GCM)
        tagLength: Number(process.env.CRYPTO_AES_TAG_LENGTH) ?? 128, // bits
      },
      kek: {
        length: Number(process.env.CRYPTO_KEK_LENGTH) ?? 256, // bits
      },
      kdf: {
        saltLength: Number(process.env.CRYPTO_KDF_SALT_LENGTH) ?? 16, // bytes
        argon2id: {
          iterations: Number(process.env.CRYPTO_ARGON2ID_ITERATIONS) ?? 3,
          memory: Number(process.env.CRYPTO_ARGON2ID_MEMORY) ?? 65536, // KiB (64 MiB)
          parallelism: Number(process.env.CRYPTO_ARGON2ID_PARALLELISM) ?? 4,
        },
        pbkdf2: {
          iterations: Number(process.env.CRYPTO_PBKDF2_ITERATIONS) ?? 10000,
        },
      },
    },
    root: {
      meta: {
        version: Number(process.env.ROOT_META_VERSION) ?? 1,
      },
      map: {
        version: Number(process.env.ROOT_MAP_VERSION) ?? 1,
      },
      settings: {
        version: Number(process.env.ROOT_SETTINGS_VERSION) ?? 1,
        default: {
          sync: {
            autoSync: process.env.DEFAULT_SETTINGS_AUTO_SYNC ? process.env.DEFAULT_SETTINGS_AUTO_SYNC === 'true' : true,
            syncInterval: Number(process.env.DEFAULT_SETTINGS_SYNC_INTERVAL) ?? 300000, // milliseconds (5 minutes)
          },
          theme: {
            accent: process.env.DEFAULT_SETTINGS_THEME_ACCENT ?? '#4f535b',
            foreground: process.env.DEFAULT_SETTINGS_THEME_FOREGROUND ?? '#ffffff',
            background: process.env.DEFAULT_SETTINGS_THEME_BACKGROUND ?? '#000000',
            selection: process.env.DEFAULT_SETTINGS_THEME_SELECTION ?? '#4f535b4d',
            selectionFocused: process.env.DEFAULT_SETTINGS_THEME_SELECTION_FOCUSED ?? '#4f535b66',
            muted: process.env.DEFAULT_SETTINGS_THEME_MUTED ?? '#888888',
            error: process.env.DEFAULT_SETTINGS_THEME_ERROR ?? '#c97373',
            success: process.env.DEFAULT_SETTINGS_THEME_SUCCESS ?? '#51c997',
            warning: process.env.DEFAULT_SETTINGS_THEME_WARNING ?? '#e8a862',
            info: process.env.DEFAULT_SETTINGS_THEME_INFO ?? '#739dc9',
            scale: Number(process.env.DEFAULT_SETTINGS_THEME_SCALE) ?? 0.0175,
          },
        },
      },
    },
    notebook: {
      meta: {
        version: Number(process.env.NOTEBOOK_META_VERSION) ?? 1,
      },
      manifest: {
        version: Number(process.env.NOTEBOOK_MANIFEST_VERSION) ?? 1,
      },
    },
    localStorage: {
        key: process.env.LOCAL_STORAGE_KEY ?? 'local_data',
        expiration: Number(process.env.LOCAL_STORAGE_EXPIRATION) ?? 7, // days
    },
  },
});

export type Config = typeof config;
