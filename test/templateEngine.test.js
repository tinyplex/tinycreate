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
  ...answers,
});

describe("TemplateEngine", () => {
  it("should process a simple template", async () => {
    const context = createTestContext({
      projectName: "test-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("simple.hbs");

    expect(result).toMatchSnapshot();
  });

  it("should evaluate directives with context access", async () => {
    const context = createTestContext({
      projectName: "my-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("with-context.hbs");

    expect(result).toMatchSnapshot();
  });

  it("should handle when() conditional helper", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "vanilla",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("conditional.hbs");

    expect(result).toMatchSnapshot();
  });

  it("should add imports to top of file", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("imports.hbs");

    expect(result).toMatchSnapshot();
  });

  it("should include entire files", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("main.hbs");

    expect(result).toMatchSnapshot();
  });

  it("should handle IF/ENDIF block syntax with true condition", async () => {
    const context = createTestContext({
      projectName: "react-app",
      language: "typescript",
      framework: "react",
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("if-block.hbs");

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
    const result = await engine.processTemplate("if-block.hbs");

    expect(result).not.toContain("import React from 'react'");
    expect(result).not.toContain("const Component = () => <div>Hello</div>");
    expect(result).not.toContain("const typed: string = 'TypeScript code'");
    expect(result).toContain("const notTyped = 'JavaScript code'");
    expect(result).toContain("const vanilla = 'Vanilla JS code'");
    expect(result).toMatchSnapshot();
  });

  it("should handle LIST/ENDLIST with conditional items", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
      includeRouter: true,
      includeRedux: false,
      hasItem2: true,
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("list-block.hbs");

    expect(result).toContain('"react": "^18.0.0",');
    expect(result).toContain('"react-router": "^6.0.0",');
    expect(result).toContain('"lodash": "^4.17.21"');
    expect(result).not.toContain('"redux"');
    expect(result).toContain("'item1',");
    expect(result).toContain("'item2',");
    expect(result).toContain("'item3'");
    expect(result).toMatchSnapshot();
  });

  it("should handle LIST/ENDLIST with all items excluded", async () => {
    const context = createTestContext({
      projectName: "test",
      language: "typescript",
      framework: "react",
      includeRouter: false,
      includeRedux: false,
      hasItem2: false,
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const result = await engine.processTemplate("list-block.hbs");

    expect(result).toContain('"react": "^18.0.0",');
    expect(result).not.toContain('"react-router"');
    expect(result).toContain('"lodash": "^4.17.21"');
    expect(result).not.toContain('"redux"');
    expect(result).toContain("'item1',");
    expect(result).not.toContain("'item2'");
    expect(result).toContain("'item3'");
    expect(result).toMatchSnapshot();
  });
});
