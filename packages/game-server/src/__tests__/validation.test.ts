import { describe, it, expect } from 'vitest';
import { validateBotCode } from '../sandbox/validation.js';
import { MAX_CODE_BYTES } from '../arena/constants.js';

describe('validateBotCode', () => {
  it('aceita código limpo', () => {
    const code = `
      onTick(function(dt) {
        andarFrente(1);
        girarRadar(1);
      });
    `;
    expect(validateBotCode(code)).toEqual({ valid: true });
  });

  it('rejeita eval', () => {
    const r = validateBotCode('eval("1+1")');
    expect(r.valid).toBe(false);
    expect((r as { valid: false; reason: string }).reason).toContain('eval');
  });

  it('rejeita Function', () => {
    const r = validateBotCode('var f = new Function("return 1")');
    expect(r.valid).toBe(false);
  });

  it('rejeita globalThis', () => {
    const r = validateBotCode('globalThis.process.exit(0)');
    expect(r.valid).toBe(false);
  });

  it('rejeita process', () => {
    const r = validateBotCode('process.exit(1)');
    expect(r.valid).toBe(false);
  });

  it('rejeita require', () => {
    const r = validateBotCode('var fs = require("fs")');
    expect(r.valid).toBe(false);
  });

  it('rejeita import dinâmico', () => {
    const r = validateBotCode('import("fs").then(m => m)');
    expect(r.valid).toBe(false);
  });

  it('rejeita with statement', () => {
    const r = validateBotCode('with (Math) { abs(-1); }');
    expect(r.valid).toBe(false);
  });

  it('rejeita acesso a .constructor', () => {
    const r = validateBotCode('var f = [].constructor.constructor("return process")()');
    expect(r.valid).toBe(false);
  });

  it('rejeita acesso a __proto__', () => {
    const r = validateBotCode('var x = {}; x.__proto__ = null');
    expect(r.valid).toBe(false);
  });

  it('rejeita loops aninhados além de profundidade 4', () => {
    const r = validateBotCode(`
      for (var i = 0; i < 1; i++) {
        for (var j = 0; j < 1; j++) {
          for (var k = 0; k < 1; k++) {
            for (var l = 0; l < 1; l++) {
              for (var m = 0; m < 1; m++) {
              }
            }
          }
        }
      }
    `);
    expect(r.valid).toBe(false);
  });

  it('aceita loops aninhados até profundidade 4', () => {
    const r = validateBotCode(`
      for (var i = 0; i < 1; i++) {
        for (var j = 0; j < 1; j++) {
          for (var k = 0; k < 1; k++) {
            for (var l = 0; l < 1; l++) {
            }
          }
        }
      }
    `);
    expect(r.valid).toBe(true);
  });

  it('rejeita código acima do limite de tamanho', () => {
    const big = '// ' + 'a'.repeat(MAX_CODE_BYTES + 1);
    const r = validateBotCode(big);
    expect(r.valid).toBe(false);
    expect((r as { valid: false; reason: string }).reason).toContain('KB');
  });

  it('rejeita erro de sintaxe', () => {
    const r = validateBotCode('function (');
    expect(r.valid).toBe(false);
    expect((r as { valid: false; reason: string }).reason).toContain('sintaxe');
  });
});
