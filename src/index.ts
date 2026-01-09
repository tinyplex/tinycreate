/**
 * tinycreate - A flexible CLI framework for scaffolding projects with templates
 */

export { TemplateEngine, type TemplateContext } from "./templateEngine.js";
export {
  postProcessFile,
  postProcessProject,
  type PostProcessOptions,
} from "./postProcess.js";
export {
  createCLI,
  type CLIOptions,
  type FileConfig,
  type ProjectConfig,
  type Question,
} from "./cli.js";
