import {describe, expect, it} from 'vitest';
import {postProcessFile} from '../src/postProcess.js';

describe('postProcess', () => {
  it('should format TypeScript with prettier', async () => {
    const unformatted = `const x={a:1,b:2};function hello(){return"world"}`;

    const result = await postProcessFile('test.ts', unformatted, {
      prettier: true,
    });

    expect(result).toMatchSnapshot();
  });

  it('should transpile TypeScript to JavaScript', async () => {
    const typescript = `const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};`;

    const result = await postProcessFile('utils.ts', typescript, {
      transpileToJS: true,
    });

    expect(result).toMatchSnapshot();
  });

  it('should transpile TSX to JSX', async () => {
    const tsx = `import React from 'react';

export const Component: React.FC<{title: string}> = ({title}) => {
  return <div>{title}</div>;
};`;

    const result = await postProcessFile('Component.tsx', tsx, {
      transpileToJS: true,
    });

    expect(result).toMatchSnapshot();
  });

  it('should format and transpile together', async () => {
    const unformattedTS = `const add=(a:number,b:number):number=>{return a+b;}`;

    const result = await postProcessFile('math.ts', unformattedTS, {
      prettier: true,
      transpileToJS: true,
    });

    expect(result).toMatchSnapshot();
  });

  it('should handle non-TS files without transpiling', async () => {
    const css = 'body{margin:0;padding:0;}';

    const result = await postProcessFile('styles.css', css, {
      prettier: true,
      transpileToJS: true,
    });

    expect(result).toMatchSnapshot();
  });

  it.only('should preserve blank lines when transpiling TypeScript to JavaScript', async () => {
    const typescript = `import './styles.css';
import {createButton} from './button';
import {createInput} from './input';

export const createTodoInput = (store) => {
  const container = document.createElement('div');
  container.id = 'todoInput';

  const input = createInput('What needs to be done?');

  const addTodo = () => {
    const text = input.value.trim();
    if (text) {
      store.addRow('todos', {text, completed: false});
      input.value = '';
      input.focus();
    }
  };
};`;

    const result = await postProcessFile('todoInput.ts', typescript, {
      transpileToJS: true,
    });

    expect(result).toMatchSnapshot();
  });
});
