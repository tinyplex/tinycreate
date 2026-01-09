import Handlebars from "handlebars";

export type TemplateContext = Record<string, any>;

interface FileState {
  imports: Set<string>;
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
    
    // Don't escape HTML/special characters in output
    this.handlebars.Utils.escapeExpression = (str: any) => str;

    this.registerHelpers();
  }

  private registerHelpers() {
    this.handlebars.registerHelper("addImport", (statement: string) => {
      if (this.currentFile) {
        this.currentFile.imports.add(statement);
      }
      return "";
    });

    this.handlebars.registerHelper("list", function (this: any, options: any) {
      if (!options.fn) return "";

      const content = options.fn(this);
      const lines = content
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith("//"));

      if (lines.length === 0) return "";

      const result = lines
        .map((item, index) => {
          const isLast = index === lines.length - 1;
          const hasSeparator = item.trimEnd().endsWith(",");

          if (!isLast && !hasSeparator) {
            return "  " + item + ",";
          } else if (isLast && hasSeparator) {
            return "  " + item.trimEnd().slice(0, -1);
          }
          return "  " + item;
        })
        .join("\n");
      
      return new Handlebars.SafeString(result + "\n");
    });

    this.handlebars.registerHelper("includeFile", (filePath: string) => {
      const partial = this.handlebars.partials[filePath];
      if (partial) {
        if (typeof partial === "function") {
          return new Handlebars.SafeString(partial(this.context));
        }
        return new Handlebars.SafeString(this.handlebars.compile(partial)(this.context));
      }
      return "";
    });
  }

  async processTemplate(templatePath: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(this.templateRoot, templatePath);
    const rawContent = await fs.readFile(fullPath, "utf-8");

    this.currentFile = {
      imports: new Set<string>(),
    };

    // Register partials (for includeFile)
    await this.registerPartial("partial.hbs");

    const template = this.handlebars.compile(rawContent);
    let result = template(this.context);

    // Don't remove blank lines - they're intentional

    const imports = Array.from(this.currentFile.imports);

    if (imports.length > 0) {
      return imports.join("\n") + "\n\n" + result;
    }

    return result;
  }

  private async registerPartial(partialPath: string) {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const fullPath = path.join(this.templateRoot, partialPath);
      const content = await fs.readFile(fullPath, "utf-8");
      this.handlebars.registerPartial(partialPath, content);
    } catch (e) {
      // Partial doesn't exist, that's ok
    }
  }
}
