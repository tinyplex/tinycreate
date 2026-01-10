import {existsSync} from 'fs';
import {mkdir, writeFile} from 'fs/promises';
import {join} from 'path';
import prompts from 'prompts';
import {postProcessFile, type PostProcessOptions} from './postProcess.js';
import {TemplateEngine, type TemplateContext} from './templateEngine.js';

function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || '';

  if (userAgent.includes('pnpm')) return 'pnpm';
  if (userAgent.includes('bun')) return 'bun';
  if (userAgent.includes('yarn')) return 'yarn';
  return 'npm';
}

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
  installCommand?: string;
  devCommand?: string;
  onSuccess?: (
    projectName: string,
    context: TemplateContext,
  ) => void | Promise<void>;
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

      // Handle install and run if configured
      if (config.installCommand && config.devCommand && context.installAndRun) {
        await handleInstallAndRun(
          projectName,
          projectPath,
          config.installCommand,
          config.devCommand,
        );
      } else if (config.onSuccess) {
        await config.onSuccess(projectName, context);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error creating project:', errorMessage);
    process.exit(1);
  }
}

async function handleInstallAndRun(
  projectName: string,
  projectPath: string,
  installCommand: string,
  devCommand: string,
): Promise<void> {
  const {spawn} = await import('child_process');
  const pm = detectPackageManager();

  // Replace {pm} placeholder with detected package manager
  const install = installCommand.replace(/{pm}/g, pm);
  const dev = devCommand.replace(/{pm}/g, pm);

  const [installCmd, ...installArgs] = install.split(' ');
  const [devCmd, ...devArgs] = dev.split(' ');

  console.log(`📦 Installing dependencies with ${pm}...\n`);

  const installProcess = spawn(installCmd, installArgs, {
    cwd: projectPath,
    stdio: 'inherit',
    shell: true,
  });

  installProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('\n❌ Failed to install dependencies');
      console.log('\nNext steps:');
      console.log(`  cd ${projectName}`);
      console.log(`  ${install}`);
      console.log(`  ${dev}`);
      return;
    }

    console.log('\n✅ Dependencies installed!\n');
    console.log('🚀 Starting development server...\n');

    const devProcess = spawn(devCmd, devArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      shell: true,
    });

    devProcess.on('error', (error) => {
      console.error('\n❌ Failed to start dev server:', error.message);
    });
  });

  installProcess.on('error', (error) => {
    console.error('\n❌ Failed to install dependencies:', error.message);
    console.log('\nNext steps:');
    console.log(`  cd ${projectName}`);
    console.log(`  ${install}`);
    console.log(`  ${dev}`);
  });
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

  // Process any remaining included files (recursively)
  let i = files.length;
  while (i < allFiles.length) {
    const file = allFiles[i];
    const {content, includedFiles} = await engine.processTemplate(
      file.template,
    );
    file.processedContent = content;
    processedTemplates.add(file.template);

    // Add any newly discovered included files
    for (const included of includedFiles) {
      if (!processedTemplates.has(included.template)) {
        const processedIncluded = config.processIncludedFile
          ? config.processIncludedFile(included, context)
          : included;
        allFiles.push({
          ...processedIncluded,
          processedContent: '', // Will be processed in next iteration
        });
      }
    }

    i++;
  }

  // Write all files
  for (const file of allFiles) {
    if (!file.processedContent) {
      throw new Error(`File ${file.output} was not processed`);
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

    const fullPath = join(targetDir, filePath);
    const {dirname} = await import('path');
    await mkdir(dirname(fullPath), {recursive: true});
    await writeFile(fullPath, content);
  }
}
