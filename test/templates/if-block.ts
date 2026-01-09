/// IF context.isReact
import React from 'react';
const Component = () => <div>Hello</div>;
/// ENDIF

/// IF context.isTypescript
const typed: string = 'TypeScript code';
/// ELSE
const notTyped = 'JavaScript code';
/// ENDIF

/// IF !context.isReact
const vanilla = 'Vanilla JS code';
/// ENDIF

export const config = {
  name: '/*/ return context.projectName; /*/',
};
