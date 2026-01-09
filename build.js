import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

// Build TypeScript files
await build({
  entryPoints: [
    "src/index.ts",
    "src/templateEngine.ts",
    "src/postProcess.ts",
    "src/cli.ts",
  ],
  bundle: false,
  platform: "node",
  format: "esm",
  outdir: "dist",
  target: "node18",
});

// Create index.d.ts manually (simplified)
const dts = `export { TemplateEngine, type TemplateContext } from './templateEngine.js';
export { postProcessFile, postProcessProject, type PostProcessOptions } from './postProcess.js';
export { createCLI, type CLIOptions, type FileConfig, type ProjectConfig, type Question } from './cli.js';
`;

await writeFile("dist/index.d.ts", dts);

console.log("✅ Built tinycreate");
