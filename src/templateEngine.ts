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

        if (directive.startsWith("LIST")) {
          const separatorMatch = directive.match(/^LIST\s+(.+)$/);
          const separator = separatorMatch ? separatorMatch[1].trim() : ",";
          const listLines: string[] = [];
          i++;

          while (i < lines.length) {
            const blockLine = lines[i];
            const trimmed = blockLine.trim();

            if (trimmed === "/// ENDLIST") {
              break;
            }

            listLines.push(blockLine);
            i++;
          }

          const processedItems: string[] = [];
          for (let j = 0; j < listLines.length; j++) {
            const blockLine = listLines[j];
            const trimmed = blockLine.trim();

            if (trimmed.startsWith("/// IF ")) {
              const condition = trimmed.slice(7).trim();
              const whenLines: string[] = [];
              const elseLines: string[] = [];
              let inElse = false;
              let depth = 1;
              j++;

              while (j < listLines.length && depth > 0) {
                const nestedLine = listLines[j];
                const nestedTrimmed = nestedLine.trim();

                if (nestedTrimmed.startsWith("/// IF ")) {
                  depth++;
                } else if (nestedTrimmed === "/// ENDIF") {
                  depth--;
                  if (depth === 0) {
                    break;
                  }
                } else if (nestedTrimmed === "/// ELSE" && depth === 1) {
                  inElse = true;
                  j++;
                  continue;
                }

                if (inElse) {
                  elseLines.push(nestedLine);
                } else {
                  whenLines.push(nestedLine);
                }
                j++;
              }

              const conditionResult = await this.evaluateDirective(
                `return ${condition}`,
              );

              const linesToProcess =
                conditionResult === true || conditionResult === "true"
                  ? whenLines
                  : elseLines;

              const recursivelyProcessedLines =
                await this.processLines(linesToProcess);
              processedItems.push(...recursivelyProcessedLines);
            } else if (trimmed.startsWith("///")) {
              const blockDirective = trimmed.slice(3).trim();
              const result = await this.evaluateDirective(blockDirective);
              if (result) {
                processedItems.push(result);
              }
            } else {
              const directiveRegex = /\/\*\/\s*(.+?)\s*\/\*\//g;
              let processedLine = blockLine;
              let match;
              while ((match = directiveRegex.exec(blockLine)) !== null) {
                const inlineDirective = match[1].trim();
                const result = await this.evaluateDirective(inlineDirective);
                processedLine = processedLine.replace(match[0], result);
              }
              if (processedLine.trim()) {
                processedItems.push(processedLine);
              }
            }
          }

          for (let j = 0; j < processedItems.length; j++) {
            const item = processedItems[j];
            const isLast = j === processedItems.length - 1;
            const hasSeparator = item.trimEnd().endsWith(separator);

            if (!isLast && !hasSeparator) {
              processedLines.push(item + separator);
            } else if (isLast && hasSeparator) {
              processedLines.push(item.trimEnd().slice(0, -separator.length));
            } else {
              processedLines.push(item);
            }
          }
        } else if (directive.startsWith("IF ")) {
          const condition = directive.slice(3).trim();
          const whenLines: string[] = [];
          const elseLines: string[] = [];
          let inElse = false;
          let depth = 1;
          i++;

          while (i < lines.length && depth > 0) {
            const blockLine = lines[i];
            const trimmed = blockLine.trim();

            if (trimmed.startsWith("/// IF ")) {
              depth++;
            } else if (trimmed === "/// ENDIF") {
              depth--;
              if (depth === 0) {
                break;
              }
            } else if (trimmed === "/// ELSE" && depth === 1) {
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

          const recursivelyProcessedLines =
            await this.processLines(linesToProcess);
          processedLines.push(...recursivelyProcessedLines);
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

  private async processLines(lines: string[]): Promise<string[]> {
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
          let depth = 1;
          i++;

          while (i < lines.length && depth > 0) {
            const blockLine = lines[i];
            const trimmed = blockLine.trim();

            if (trimmed.startsWith("/// IF ")) {
              depth++;
            } else if (trimmed === "/// ENDIF") {
              depth--;
              if (depth === 0) {
                break;
              }
            } else if (trimmed === "/// ELSE" && depth === 1) {
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

          const recursivelyProcessedLines =
            await this.processLines(linesToProcess);
          processedLines.push(...recursivelyProcessedLines);
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

    return processedLines;
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
