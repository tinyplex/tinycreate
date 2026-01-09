import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

// Build TypeScript files
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.js",
  target: "node18",
  external: ["prompts", "esbuild", "prettier", "typescript"],
});

// Create index.d.ts manually (simplified)
const dts = `export { TemplateEngine, type TemplateContext } from './templateEngine.js';
export { postProcessFile, postProcessProject, type PostProcessOptions } from './postProcess.js';
export { createCLI, type CLIOptions, type FileConfig, type ProjectConfig, type Question } from './cli.js';
`;

await writeFile("dist/index.d.ts", dts);

// Create package.json for publishing from dist
const pkg = JSON.parse(await readFile("package.json", "utf-8"));
delete pkg.devDependencies;
delete pkg.scripts;
delete pkg.private;
pkg.main = "./index.js";
pkg.types = "./index.d.ts";
pkg.exports = {
  ".": {
    import: "./index.js",
    types: "./index.d.ts",
  },
};
await writeFile("dist/package.json", JSON.stringify(pkg, null, 2));

console.log("✅ Built tinycreate");
