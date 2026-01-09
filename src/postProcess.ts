import * as esbuild from 'esbuild';

export interface PostProcessOptions {
  prettier?: boolean;
  transpileToJS?: boolean;
}

export async function postProcessFile(
  filePath: string,
  content: string,
  options: PostProcessOptions = {},
): Promise<{filePath: string; content: string}> {
  let processedContent = content;
  let processedPath = filePath;

  if (options.transpileToJS && canTranspile(filePath)) {
    try {
      const result = await esbuild.transform(processedContent, {
        loader: 'tsx',
        format: 'esm',
        target: 'es2020',
        jsx: 'preserve',
      });
      processedContent = result.code;
      processedPath = transpileExtension(filePath);
    } catch (error) {
      throw new Error(
        `Failed to transpile ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (options.prettier) {
    try {
      const prettier = await import('prettier');
      const prettierConfig = {
        parser: inferParser(processedPath),
        singleQuote: true,
        trailingComma: 'all' as const,
        bracketSpacing: false,
      };
      processedContent = await prettier.format(
        processedContent,
        prettierConfig,
      );
    } catch (error) {
      console.warn(`Failed to format ${processedPath}:`, error);
    }
  }

  return {
    filePath: processedPath,
    content: processedContent,
  };
}

export async function postProcessProject(
  projectPath: string,
  files: Map<string, string>,
  options: PostProcessOptions = {},
): Promise<Map<string, string>> {
  const processedFiles = new Map<string, string>();

  for (const [filePath, content] of files.entries()) {
    const {filePath: newPath, content: newContent} = await postProcessFile(
      filePath,
      content,
      options,
    );
    processedFiles.set(newPath, newContent);
  }

  return processedFiles;
}

function canTranspile(filePath: string): boolean {
  return /\.(tsx?|jsx?)$/.test(filePath);
}

function transpileExtension(filePath: string): string {
  return filePath.replace(/\.tsx?$/, (match) => {
    return match === '.tsx' ? '.jsx' : '.js';
  });
}

function inferParser(filePath: string): string {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    return 'typescript';
  }
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return 'babel';
  }
  if (
    filePath.endsWith('.json') ||
    filePath.endsWith('.prettierrc') ||
    filePath.endsWith('.eslintrc')
  ) {
    return 'json';
  }
  if (filePath.endsWith('.css')) {
    return 'css';
  }
  if (filePath.endsWith('.html')) {
    return 'html';
  }
  if (filePath.endsWith('.md')) {
    return 'markdown';
  }
  return 'babel';
}
