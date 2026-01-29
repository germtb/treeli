/**
 * Build script for treeli package
 * Compiles TypeScript to JavaScript and generates declaration files
 */

import { $, Glob } from "bun";
import { mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";

const SRC_DIR = "./src";
const DIST_DIR = "./dist";

async function build() {
  console.log("Building treeli...");

  // Clean dist directory
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  // Find all TypeScript files in src
  const glob = new Glob("**/*.ts");
  const files: string[] = [];
  for await (const file of glob.scan(SRC_DIR)) {
    files.push(file);
  }

  console.log(`Found ${files.length} TypeScript files`);

  // Transpile each file using Bun
  for (const file of files) {
    const srcPath = join(SRC_DIR, file);
    const outPath = join(DIST_DIR, file.replace(/\.ts$/, ".js"));

    // Ensure output directory exists
    await mkdir(dirname(outPath), { recursive: true });

    // Read source file
    const source = await Bun.file(srcPath).text();

    // Transpile to JavaScript using Bun's transpiler
    const transpiler = new Bun.Transpiler({
      loader: "ts",
      target: "node",
    });

    let jsCode = transpiler.transformSync(source);

    // Rewrite .ts imports to .js
    jsCode = jsCode.replace(
      /from\s+["']([^"']+)\.ts["']/g,
      'from "$1.js"'
    );

    await Bun.write(outPath, jsCode);
  }

  // Generate declaration files using tsc with emitDeclarationOnly
  console.log("Generating declaration files...");
  const tscResult = await $`bunx tsc -p tsconfig.build.json --emitDeclarationOnly`.nothrow();

  if (tscResult.exitCode !== 0) {
    console.warn("Declaration generation had issues (continuing anyway):");
    console.warn(tscResult.stderr.toString());
  }

  // Fix .ts references in .d.ts files to .js
  const dtsGlob = new Glob("**/*.d.ts");
  for await (const file of dtsGlob.scan(DIST_DIR)) {
    const dtsPath = join(DIST_DIR, file);
    let content = await Bun.file(dtsPath).text();
    content = content.replace(
      /from\s+["']([^"']+)\.ts["']/g,
      'from "$1.js"'
    );
    await Bun.write(dtsPath, content);
  }

  console.log("Build complete! Output in dist/");

  // List the output
  await $`ls -la dist/`;
  await $`ls -la dist/core/ 2>/dev/null || true`;
  await $`ls -la dist/jsx/ 2>/dev/null || true`;
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
