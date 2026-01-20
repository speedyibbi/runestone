import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverDir = path.resolve(__dirname, "..", "..");
const buildDir = path.join(serverDir, ".lambda-build");

async function createZip(source: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}

async function buildLambda(): Promise<void> {
  // Clean build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  const functionDir = path.join(buildDir, "function");
  fs.mkdirSync(functionDir, { recursive: true });

  // Bundle Lambda with esbuild
  await build({
    entryPoints: [path.join(serverDir, "src", "lambda.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outfile: path.join(functionDir, "lambda.js"),
    sourcemap: false,
    minify: true,
    treeShaking: true,
  });

  const functionZip = path.join(buildDir, "function.zip");
  await createZip(functionDir, functionZip);
}

buildLambda().catch((err) => {
  console.error(err);
  process.exit(1);
});
