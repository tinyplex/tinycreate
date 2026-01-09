import {existsSync} from 'fs';
import {mkdir, writeFile} from 'fs/promises';
import {join} from 'path';
import prompts from 'prompts';
import {postProcessFile, type PostProcessOptions} from './postProcess.js';
import {TemplateEngine, type TemplateContext} from './templateEngine.js';

export interface Question {
  type: 'text' | 'select' | 'confirm';
  name: string;
  message: string;
  initial?: string | number | boolean;
  choices?: Array<{title: string; value: string | boolean}>;
  validate?: (value: string) => boolean | string;
}

export interface FileConfig {
  template: string;
  output: string;
  prettier?: boolean;
  transpile?: boolean;
  processedContent?: string;
}

export interface ProjectConfig {
  welcomeMessage?: string;
  questions: Question[];
  createContext: (answers: Record<string, unknown>) => TemplateContext;
  getFiles: (context: TemplateContext) => FileConfig[] | Promise<FileConfig[]>;
  processIncludedFile?: (
    file: FileConfig,
    context: TemplateContext,
  ) => FileConfig;
  templateRoot: string;
  createDirectories?: (
    targetDir: string,
    context: TemplateContext,
  ) => Promise<void>;
  onSuccess?: (projectName: string, context: TemplateContext) => void;
}

export interface CLIOptions {
  nonInteractive?: boolean;
  args?: string[];
}

export async function createCLI(
  config: ProjectConfig,
  options: CLIOptions = {},
): Promise<void> {
  const args = options.args || process.argv.slice(2);
  const nonInteractive =
    options.nonInteractive || args.includes('--non-interactive');

  if (!nonInteractive && config.welcomeMessage) {
    console.log(config.welcomeMessage);
  }

  let answers: Record<string, unknown>;

  if (nonInteractive) {
    answers = {};
    for (const question of config.questions) {
      const argName = `--${question.name}`;
      const argIndex = args.indexOf(argName);
      if (argIndex !== -1 && argIndex + 1 < args.length) {
        const value = args[argIndex + 1];
        if (question.type === 'confirm') {
          answers[question.name] = value === 'true';
        } else {
          answers[question.name] = value;
        }
      } else if (question.initial !== undefined) {
        answers[question.name] = question.initial;
      }
    }
  } else {
    answers = await prompts(config.questions, {
      onCancel: () => {
        console.log('\n❌ Cancelled');
        process.exit(0);
      },
    });
  }

  const context = config.createContext(answers);
  const projectName =
    (answers.projectName as string) || (context.projectName as string);

  const projectPath = join(process.cwd(), projectName);

  if (existsSync(projectPath)) {
    console.error(
      `❌ Error: Directory "${
        projectName
      }" already exists. Please choose a different name.`,
    );
    process.exit(1);
  }

  if (!nonInteractive) {
    console.log(`\n📦 Creating your project...\n`);
  }

  try {
    await mkdir(projectPath, {recursive: true});

    if (config.createDirectories) {
      await config.createDirectories(projectPath, context);
    }

    await generateProject(projectPath, context, config);

    if (!nonInteractive) {
      console.log('✅ Done!\n');
      if (config.onSuccess) {
        config.onSuccess(projectName, context);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error creating project:', errorMessage);
    process.exit(1);
  }
}

async function generateProject(
  targetDir: string,
  context: TemplateContext,
  config: ProjectConfig,
): Promise<void> {
  const engine = new TemplateEngine(context, config.templateRoot);

  const files = await config.getFiles(context);
  const allFiles = [...files];
  const processedTemplates = new Set<string>();

  // Process files and collect included files
  for (const file of files) {
    const {content, includedFiles} = await engine.processTemplate(
      file.template,
    );

    // Store the processed content
    file.processedContent = content;
    processedTemplates.add(file.template);

    // Add included files to the list (avoiding duplicates)
    for (const included of includedFiles) {
      if (!processedTemplates.has(included.template)) {
        const processedIncluded = config.processIncludedFile
          ? config.processIncludedFile(included, context)
          : included;
        allFiles.push({
          ...processedIncluded,
          processedContent: '', // Will be processed below
        });
      }
    }
  }

  // Process any remaining included files
  for (const file of allFiles) {
    if (!file.processedContent) {
      const {content} = await engine.processTemplate(file.template);
      file.processedContent = content;
    }

    const postProcessOptions: PostProcessOptions = {
      prettier: file.prettier ?? false,
      transpileToJS: file.transpile && !context.isTypescript,
    };

    const {content, filePath} = await postProcessFile(
      file.output,
      file.processedContent,
      postProcessOptions,
    );

    await writeFile(join(targetDir, filePath), content);
  }
}
