export type TemplateContext = Record<string, any>;

interface FileState {
  content: string;
  imports: Set<string>;
  path: string;
}

interface TemplateHelpers {
  includeBlock: (path: string, blockName?: string) => Promise<string>;
  includeFile: (path: string) => Promise<string>;
  addImport: (statement: string) => void;
  when: (condition: boolean, content: string) => string;
  context: TemplateContext;
}

export class TemplateEngine {
  private context: TemplateContext;
  private templateRoot: string;
  private currentFile: FileState | null = null;
  private helpers: TemplateHelpers;

  constructor(context: TemplateContext, templateRoot: string) {
    this.context = context;
    this.templateRoot = templateRoot;

    this.helpers = {
      includeBlock: this.includeBlock.bind(this),
      includeFile: this.includeFile.bind(this),
      addImport: this.addImport.bind(this),
      when: this.when.bind(this),
      context: this.context,
    };
  }

  async processTemplate(templatePath: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(this.templateRoot, templatePath);
    const rawContent = await fs.readFile(fullPath, "utf-8");

    this.currentFile = {
      content: "",
      imports: new Set<string>(),
      path: templatePath,
    };

    const lines = rawContent.split("\n");
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim().startsWith("///")) {
        const directive = line.trim().slice(3).trim();

        if (directive.startsWith("IF ")) {
          const condition = directive.slice(3).trim();
          const whenLines: string[] = [];
          const elseLines: string[] = [];
          let inElse = false;
          i++;

          while (i < lines.length) {
            const blockLine = lines[i];
            const trimmed = blockLine.trim();

            if (trimmed === "/// ENDIF") {
              break;
            }

            if (trimmed === "/// ELSE") {
              inElse = true;
              i++;
              continue;
            }

            if (inElse) {
              elseLines.push(blockLine);
            } else {
              whenLines.push(blockLine);
            }
            i++;
          }

          const conditionResult = await this.evaluateDirective(
            `return ${condition}`,
          );

          const linesToProcess =
            conditionResult === true || conditionResult === "true"
              ? whenLines
              : elseLines;

          for (const blockLine of linesToProcess) {
            if (blockLine.trim().startsWith("///")) {
              const blockDirective = blockLine.trim().slice(3).trim();
              const result = await this.evaluateDirective(blockDirective);
              if (result) {
                processedLines.push(result);
              }
            } else {
              processedLines.push(blockLine);
            }
          }
        } else {
          const result = await this.evaluateDirective(directive);
          if (result) {
            processedLines.push(result);
          }
        }
      } else {
        const directiveRegex = /\/\*\/\s*(.+?)\s*\/\*\//g;
        let match;
        while ((match = directiveRegex.exec(line)) !== null) {
          const directive = match[1].trim();
          const result = await this.evaluateDirective(directive);
          line = line.replace(match[0], result);
        }
        processedLines.push(line);
      }
    }

    const imports = Array.from(this.currentFile.imports);
    const content = processedLines.join("\n");

    if (imports.length > 0) {
      return imports.join("\n") + "\n\n" + content;
    }

    return content;
  }

  private async evaluateDirective(directive: string): Promise<string> {
    try {
      const helperNames = Object.keys(this.helpers);
      const helperValues = Object.values(this.helpers);

      const trimmed = directive.trim();
      const code =
        trimmed.startsWith("return ") ||
        trimmed.startsWith("if ") ||
        trimmed.startsWith("for ") ||
        trimmed.startsWith("while ")
          ? directive
          : `return ${directive}`;

      const fn = new Function(
        ...helperNames,
        `return (async () => { ${code} })()`,
      );

      const result = await fn(...helperValues);
      return result || "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error evaluating directive "${directive}": ${message}`);
    }
  }

  private async includeBlock(
    partialPath: string,
    blockName?: string,
  ): Promise<string> {
    const content = await this.includeFile(partialPath);

    if (!blockName) {
      return content;
    }

    const beginMarker = `/// BEGIN ${blockName}`;
    const endMarker = `/// END ${blockName}`;

    const beginIndex = content.indexOf(beginMarker);
    const endIndex = content.indexOf(endMarker);

    if (beginIndex === -1 || endIndex === -1) {
      throw new Error(`Block "${blockName}" not found in ${partialPath}`);
    }

    const blockContent = content.substring(
      beginIndex + beginMarker.length,
      endIndex,
    );

    return blockContent.trim();
  }

  private async includeFile(filePath: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(this.templateRoot, filePath);
    return await fs.readFile(fullPath, "utf-8");
  }

  private addImport(statement: string): void {
    if (!this.currentFile) {
      throw new Error("addImport called outside of file processing");
    }
    this.currentFile.imports.add(statement);
  }

  private when(condition: boolean, content: string): string {
    return condition ? content : "";
  }
}
