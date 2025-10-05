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
    port: Number(process.env.SERVER_PORT) ?? 5000,
    secret: process.env.SERVER_SECRET ?? 'secret',
  },
  web_app: {
    port: Number(process.env.WEB_APP_PORT) ?? 3000,
  },
});

export type Config = typeof config;

