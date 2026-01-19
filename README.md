# TinyCreate

A flexible CLI framework for scaffolding projects with templates.

## Overview

TinyCreate is a powerful templating engine and CLI framework designed for
creating project generators. It combines interactive prompts, Handlebars
templates, and smart post-processing to generate complete projects from
templates with conditional logic, automatic imports, and code formatting.

## Features

- **Interactive Prompts** - Built-in support for text, select, and confirm
  questions
- **Smart Templates** - Handlebars with custom helpers for common patterns
- **Automatic Import Management** - Colocate imports with conditional logic
- **Intelligent Transpilation** - Convert TypeScript to JavaScript on demand
- **Code Formatting** - Built-in Prettier support with import organization
- **File Inclusion System** - Compose templates from reusable components
- **Non-Interactive Mode** - Full CLI argument support for CI/CD
- **Package Manager Detection** - Automatically uses npm, yarn, pnpm, or bun

## Installation

```bash
npm install tinycreate
```

## Quick Start

```typescript
import {createCLI} from 'tinycreate';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = {
  welcomeMessage: '🎉 Welcome to My Generator!\n',

  questions: [
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-app',
    },
    {
      type: 'select',
      name: 'language',
      message: 'Language:',
      choices: [
        {title: 'TypeScript', value: 'typescript'},
        {title: 'JavaScript', value: 'javascript'},
      ],
    },
  ],

  createContext: (answers) => ({
    projectName: answers.projectName,
    isTypescript: answers.language === 'typescript',
    ext: answers.language === 'typescript' ? 'ts' : 'js',
  }),

  getFiles: (context) => [
    {
      template: 'templates/App.tsx.hbs',
      output: `src/App.${context.ext}`,
      prettier: true,
      transpile: context.isTypescript === false,
    },
  ],

  templateRoot: __dirname,

  onSuccess: (projectName) => {
    console.log(`✅ Created ${projectName}!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${projectName}`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
  },
};

await createCLI(config);
```

## Custom Handlebars Helpers

TinyCreate extends Handlebars with powerful custom helpers designed for code
generation:

### `{{addImport}}`

Automatically manage imports at the top of files, keeping them colocated with
conditional logic:

```handlebars
{{#if isReact}}
  {{addImport "import React from 'react';"}}
{{/if}}
{{#if isTypescript}}
  {{addImport "import type {FC} from 'react';"}}
{{/if}}

export const Component = () => { return
<div>Hello</div>; };
```

**Output** (when both conditions are true):

```typescript
import React from 'react';
import type {FC} from 'react';

export const Component = () => {
  return <div>Hello</div>;
};
```

All imports added with `{{addImport}}` are automatically:

- Deduplicated
- Moved to the top of the file
- Preserved in their original order

### `{{#list}}...{{/list}}`

Generate comma-separated lists with automatic formatting:

```handlebars
const dependencies = {
{{#list}}
  "react": "^18.0.0"
  {{#if includeRouter}}
    "react-router": "^6.0.0"
  {{/if}}
  "lodash": "^4.17.21"
{{/list}}
};
```

**Output** (when includeRouter is true):

```javascript
const dependencies = {
  react: '^18.0.0',
  'react-router': '^6.0.0',
  lodash: '^4.17.21',
};
```

The `{{#list}}` helper:

- Automatically adds commas between items
- Removes trailing comma from last item
- Handles conditional items gracefully
- Filters out empty lines and comments

### `{{eq}}`

Compare values in conditional blocks:

```handlebars
{{#if (eq framework 'react')}}
  import React from 'react';
{{/if}}
```

### `{{includeFile}}`

Compose templates from other templates and track file dependencies:

```handlebars
{{includeFile
  template='components/Button.tsx.hbs'
  output='src/Button.tsx'
  prettier=true
}}
import {Button} from './Button'; export const App = () => (
<Button>Click me</Button>
);
```

This directive:

- Signals that `Button.tsx` should be generated
- Allows the parent file to import it
- Processes the included template with the same context
- Supports prettier and transpile options per file

## API Reference

### `createCLI(config, options)`

Main entry point for creating a CLI generator.

**Config Options:**

```typescript
interface ProjectConfig {
  // Optional welcome message shown before prompts
  welcomeMessage?: string;

  // Array of question objects (text, select, or confirm)
  questions: Question[];

  // Transform user answers into template context
  createContext: (answers: Record<string, unknown>) => TemplateContext;

  // Return array of files to generate
  getFiles: (context: TemplateContext) => FileConfig[] | Promise<FileConfig[]>;

  // Optional: Process included files before rendering
  processIncludedFile?: (
    file: FileConfig,
    context: TemplateContext,
  ) => FileConfig;

  // Root directory containing templates
  templateRoot: string;

  // Optional: Create custom directories
  createDirectories?: (
    targetDir: string,
    context: TemplateContext,
  ) => Promise<void>;

  // Optional: Custom install command (default: auto-detected package manager)
  installCommand?: string;

  // Optional: Custom dev command
  devCommand?: string;

  // Optional: Success callback after project creation
  onSuccess?: (
    projectName: string,
    context: TemplateContext,
  ) => void | Promise<void>;
}
```

**CLI Options:**

```typescript
interface CLIOptions {
  // Enable non-interactive mode for CI/CD
  nonInteractive?: boolean;

  // Custom CLI arguments (defaults to process.argv.slice(2))
  args?: string[];
}
```

### Question Types

```typescript
interface Question {
  // Question type (or function returning type based on previous answers)
  type:
    | 'text'
    | 'select'
    | 'confirm'
    | ((
        prev: unknown,
        answers: Record<string, unknown>,
      ) => 'text' | 'select' | 'confirm' | null);

  // Answer key name
  name: string;

  // Question prompt
  message: string;

  // Default value
  initial?: string | number | boolean;

  // Choices for 'select' type
  choices?: Array<{title: string; value: string | boolean}>;

  // Validation function for 'text' type
  validate?: (value: string) => boolean | string;
}
```

### FileConfig

```typescript
interface FileConfig {
  // Path to Handlebars template (relative to templateRoot)
  template: string;

  // Output path (supports template variables like {{projectName}})
  output: string;

  // Enable Prettier formatting (default: false)
  prettier?: boolean;

  // Enable TypeScript to JavaScript transpilation (default: false)
  transpile?: boolean;

  // Internal: processed content (set by engine)
  processedContent?: string;
}
```

### Post-Processing

```typescript
import {postProcessFile, postProcessProject} from 'tinycreate';

// Process a single file
const {filePath, content} = await postProcessFile('src/App.tsx', fileContent, {
  prettier: true,
  transpileToJS: true,
});

// Process multiple files
const processedFiles = await postProcessProject('/path/to/project', filesMap, {
  prettier: true,
  transpileToJS: false,
});
```

## Non-Interactive Mode

TinyCreate supports non-interactive mode for use in CI/CD or automated scripts:

```bash
node cli.js --non-interactive \
  --projectName my-app \
  --language typescript \
  --framework react
```

Any question without a provided argument will use its `initial` value.

## Advanced Patterns

### Conditional Questions

Questions can be conditional based on previous answers:

```typescript
{
  type: (prev, answers) =>
    answers.language === 'typescript' ? 'confirm' : null,
  name: 'strictMode',
  message: 'Enable strict mode?',
  initial: true,
}
```

If the function returns `null`, the question is skipped.

### Dynamic File Generation

Generate files based on context:

```typescript
getFiles: (context) => {
  const files = [{template: 'App.tsx.hbs', output: 'src/App.tsx'}];

  if (context.includeTests) {
    files.push({
      template: 'App.test.tsx.hbs',
      output: 'src/App.test.tsx',
    });
  }

  return files;
};
```

### Custom Directory Structure

Create custom directories before file generation:

```typescript
createDirectories: async (targetDir, context) => {
  const {mkdir} = await import('fs/promises');

  await mkdir(join(targetDir, 'src', 'components'), {recursive: true});
  await mkdir(join(targetDir, 'public'), {recursive: true});

  if (context.includeServer) {
    await mkdir(join(targetDir, 'server'), {recursive: true});
  }
};
```

### Processing Included Files

Modify included files before rendering:

```typescript
processIncludedFile: (file, context) => {
  // Force all component files to be formatted
  if (file.output.includes('components/')) {
    return {...file, prettier: true};
  }
  return file;
};
```

## Examples

See the [create-tinybase](https://github.com/tinyplex/create-tinybase) project
for a complete real-world example that uses TinyCreate to generate TinyBase
applications with multiple frameworks, languages, and configurations.

## Testing

```bash
npm test
```

TinyCreate includes comprehensive tests covering:

- Template engine functionality
- Import management
- List formatting
- File inclusion
- Post-processing
- TypeScript transpilation

## Requirements

- Node.js >= 18.0.0

## Dependencies

- **handlebars** - Template rendering
- **prompts** - Interactive CLI prompts
- **esbuild** - Fast TypeScript transpilation
- **prettier** - Code formatting

## License

MIT License - see
[LICENSE](https://github.com/tinyplex/tinybase/blob/main/LICENSE) file for
details.
