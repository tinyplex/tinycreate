import { join } from "path";
import { describe, expect, it } from "vitest";
import { TemplateEngine } from "../src/templateEngine.js";

const TEMPLATES_DIR = join(process.cwd(), "test", "templates");

const createTestContext = (answers) => ({
  projectName: answers.projectName,
  language: answers.language,
  framework: answers.framework,
  isTypescript: answers.language === "typescript",
  isReact: answers.framework === "react",
  ext:
    answers.language === "typescript"
      ? answers.framework === "react"
        ? "tsx"
        : "ts"
      : answers.framework === "react"
        ? "jsx"
        : "js",
});

describe("TemplateEngine", () => {
  it("should process a simple template", async () => {
    const context = createTestContext({
      projectName: "test-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("simple.ts");

    expect(result).toMatchSnapshot();
  });

  it("should evaluate directives with context access", async () => {
    const context = createTestContext({
      projectName: "my-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("with-context.ts");

    expect(result).toMatchSnapshot();
  });

  it("should handle when() conditional helper", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "vanilla",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("conditional.ts");

    expect(result).toMatchSnapshot();
  });

  it("should add imports to top of file", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("imports.ts");

    expect(result).toMatchSnapshot();
  });

  it("should include entire files", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("main.ts");

    expect(result).toMatchSnapshot();
  });

  it("should include named blocks from files", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("use-block.ts");

    expect(result).toMatchSnapshot();
  });

  it("should handle IF/ENDIF block syntax with true condition", async () => {
    const context = createTestContext({
      projectName: "react-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("if-block.ts");

    expect(result).toContain("import React from 'react'");
    expect(result).toContain("const Component = () => <div>Hello</div>");
    expect(result).toContain("const typed: string = 'TypeScript code'");
    expect(result).not.toContain("const notTyped = 'JavaScript code'");
    expect(result).not.toContain("const vanilla = 'Vanilla JS code'");
    expect(result).toMatchSnapshot();
  });

  it("should handle IF/ENDIF block syntax with false condition", async () => {
    const context = createTestContext({
      projectName: "vanilla-app",
      language: "javascript",
      framework: "vanilla",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("if-block.ts");

    expect(result).not.toContain("import React from 'react'");
    expect(result).not.toContain("const Component = () => <div>Hello</div>");
    expect(result).not.toContain("const typed: string = 'TypeScript code'");
    expect(result).toContain("const notTyped = 'JavaScript code'");
    expect(result).toContain("const vanilla = 'Vanilla JS code'");
    expect(result).toMatchSnapshot();
  });
});
