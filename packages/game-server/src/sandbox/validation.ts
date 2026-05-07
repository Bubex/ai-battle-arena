import * as acorn from 'acorn';
import { MAX_CODE_BYTES } from '../arena/constants.js';

const FORBIDDEN_IDENTIFIERS = new Set([
  'eval', 'Function', 'globalThis', 'process', 'require', 'module',
  'exports', '__dirname', '__filename', 'global', 'Buffer',
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
  'clearInterval', 'fetch', 'XMLHttpRequest', 'WebSocket',
]);

const FORBIDDEN_MEMBER_PROPS = new Set([
  'constructor', '__proto__', 'prototype',
]);

type ValidationResult = { valid: true } | { valid: false; reason: string };

export function validateBotCode(code: string): ValidationResult {
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    return { valid: false, reason: `Código excede o limite de ${MAX_CODE_BYTES / 1024}KB.` };
  }

  let ast: acorn.Program;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Erro de sintaxe: ${msg}` };
  }

  const error = walkNode(ast, 0);
  if (error) return { valid: false, reason: error };

  return { valid: true };
}

function walkNode(node: acorn.AnyNode | null | undefined, loopDepth: number): string | null {
  if (!node) return null;

  switch (node.type) {
    case 'Identifier':
      if (FORBIDDEN_IDENTIFIERS.has(node.name)) {
        return `Identificador proibido: "${node.name}"`;
      }
      break;

    case 'MemberExpression': {
      const prop = node.property;
      if (!node.computed && prop.type === 'Identifier' && FORBIDDEN_MEMBER_PROPS.has(prop.name)) {
        return `Acesso proibido: ".${prop.name}"`;
      }
      break;
    }

    case 'WithStatement':
      return 'Instrução "with" não é permitida.';

    case 'ImportDeclaration':
    case 'ImportExpression':
      return 'Imports não são permitidos.';

    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
    case 'ExportAllDeclaration':
      return 'Exports não são permitidos.';

    case 'ForStatement':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      if (loopDepth >= 4) {
        return 'Loops aninhados além de profundidade 4 não são permitidos.';
      }
      loopDepth++;
      break;
  }

  for (const child of getChildren(node)) {
    const err = walkNode(child, loopDepth);
    if (err) return err;
  }

  return null;
}

function getChildren(node: acorn.AnyNode): (acorn.AnyNode | null | undefined)[] {
  const children: (acorn.AnyNode | null | undefined)[] = [];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'type' in item) {
          children.push(item as acorn.AnyNode);
        }
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      children.push(value as acorn.AnyNode);
    }
  }
  return children;
}
