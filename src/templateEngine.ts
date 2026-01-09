import Handlebars from 'handlebars';

export type TemplateContext = Record<string, any>;

export interface IncludedFile {
  template: string;
  output: string;
  prettier?: boolean;
  transpile?: boolean;
}

interface FileState {
  imports: Set<string>;
  includedFiles: IncludedFile[];
}

export class TemplateEngine {
  private context: TemplateContext;
  private templateRoot: string;
  private currentFile: FileState | null = null;
  private handlebars: typeof Handlebars;

  constructor(context: TemplateContext, templateRoot: string) {
    this.context = context;
    this.templateRoot = templateRoot;
    this.handlebars = Handlebars.create();
    this.handlebars.Utils.escapeExpression = (str: any) => str;

    this.registerHelpers();
  }

  private registerHelpers() {
    this.handlebars.registerHelper('addImport', (statement: string) => {
      if (this.currentFile) {
        this.currentFile.imports.add(statement);
      }
      return '';
    });

    this.handlebars.registerHelper('list', function (this: any, options: any) {
      if (!options.fn) return '';

      const content = options.fn(this);
      const lines = content
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith('//'));

      if (lines.length === 0) return '';

      const result = lines
        .map((item: string, index: number) => {
          const isLast = index === lines.length - 1;
          const hasSeparator = item.trimEnd().endsWith(',');

          if (!isLast && !hasSeparator) {
            return '  ' + item + ',';
          } else if (isLast && hasSeparator) {
            return '  ' + item.trimEnd().slice(0, -1);
          }
          return '  ' + item;
        })
        .join('\n');

      return new Handlebars.SafeString(result + '\n');
    });

    this.handlebars.registerHelper('includeFile', (options: any) => {
      if (!this.currentFile) return '';

      const template = options.hash.template || '';
      const outputTemplate = options.hash.output || '';
      const prettier = options.hash.prettier;
      const transpile = options.hash.transpile;

      if (template && outputTemplate) {
        // Process the output path as a template
        const output = this.handlebars.compile(outputTemplate)(this.context);

        this.currentFile.includedFiles.push({
          template,
          output,
          prettier,
          transpile,
        });
      }

      return '';
    });
  }

  async processTemplate(
    templatePath: string,
  ): Promise<{content: string; includedFiles: IncludedFile[]}> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const fullPath = path.join(this.templateRoot, templatePath);
    const rawContent = await fs.readFile(fullPath, 'utf-8');

    this.currentFile = {
      imports: new Set<string>(),
      includedFiles: [],
    };

    // Register partials (for includeFile)
    await this.registerPartial('partial.hbs');

    const template = this.handlebars.compile(rawContent);
    const result = template(this.context);

    const imports = Array.from(this.currentFile.imports);
    const includedFiles = [...this.currentFile.includedFiles];

    let content = result;
    if (imports.length > 0) {
      content = imports.join('\n') + '\n\n' + result;
    }

    return {content, includedFiles};
  }

  private async registerPartial(partialPath: string) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.templateRoot, partialPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      this.handlebars.registerPartial(partialPath, content);
    } catch {}
  }
}
