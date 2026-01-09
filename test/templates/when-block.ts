/// WHEN context.isReact {
import React from 'react';
const Component = () => <div>Hello</div>;
/// } ENDWHEN

/// WHEN context.isTypescript {
const typed: string = 'TypeScript code';
/// } ENDWHEN

/// WHEN !context.isReact {
const vanilla = 'Vanilla JS code';
/// } ENDWHEN

export const config = {
  name: '/*/ return context.projectName; /*/',
};
