import {join} from 'path';
import {describe, expect, it} from 'vitest';
import {postProcessFile} from '../src/postProcess.js';
import {TemplateEngine} from '../src/templateEngine.js';

const TEMPLATES_DIR = join(process.cwd(), 'test', 'templates');

const createTestContext = (answers) => ({
  projectName: answers.projectName,
  language: answers.language,
  framework: answers.framework,
  isTypescript: answers.language === 'typescript',
  isReact: answers.framework === 'react',
  ext:
    answers.language === 'typescript'
      ? answers.framework === 'react'
        ? 'tsx'
        : 'ts'
      : answers.framework === 'react'
        ? 'jsx'
        : 'js',
  ...answers,
});

describe('TemplateEngine', () => {
  it('should add imports to top of file', async () => {
    const context = createTestContext({
      projectName: 'test',
      language: 'typescript',
      framework: 'react',
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const processed = await engine.processTemplate('imports.hbs');
    const {content} = await postProcessFile('test.ts', processed, {
      prettier: true,
    });

    expect(content).toMatchSnapshot();
  });

  it('should include entire files', async () => {
    const context = createTestContext({
      projectName: 'test',
      language: 'typescript',
      framework: 'react',
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const processed = await engine.processTemplate('main.hbs');
    const {content} = await postProcessFile('test.ts', processed, {
      prettier: true,
    });

    expect(content).toMatchSnapshot();
  });

  it('should handle lists with conditional items', async () => {
    const context = createTestContext({
      projectName: 'test',
      language: 'typescript',
      framework: 'react',
      includeRouter: true,
      includeRedux: false,
      hasItem2: true,
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const processed = await engine.processTemplate('list-block.hbs');
    const {content} = await postProcessFile('test.js', processed, {
      prettier: true,
    });

    expect(content).toContain("react: '^18.0.0',");
    expect(content).toContain("'react-router': '^6.0.0',");
    expect(content).toContain("lodash: '^4.17.21'");
    expect(content).not.toContain('redux');
    expect(content).toContain("'item1',");
    expect(content).toContain("'item2',");
    expect(content).toContain("'item3'");
    expect(content).toMatchSnapshot();
  });

  it('should handle lists with all items excluded', async () => {
    const context = createTestContext({
      projectName: 'test',
      language: 'typescript',
      framework: 'react',
      includeRouter: false,
      includeRedux: false,
      hasItem2: false,
    });

    const engine = new TemplateEngine(context, TEMPLATES_DIR);
    const processed = await engine.processTemplate('list-block.hbs');
    const {content} = await postProcessFile('test.js', processed, {
      prettier: true,
    });

    expect(content).toContain("react: '^18.0.0',");
    expect(content).not.toContain('react-router');
    expect(content).toContain("lodash: '^4.17.21'");
    expect(content).not.toContain('redux');
    expect(content).toContain("'item1',");
    expect(content).not.toContain("'item2'");
    expect(content).toContain("'item3'");
    expect(content).toMatchSnapshot();
  });
});
