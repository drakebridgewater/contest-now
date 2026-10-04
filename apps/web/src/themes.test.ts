// @vitest-environment node
// Read from disk: under this suite's `css: false`, importing a stylesheet yields ''.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const baseCss = read('./styles/index.css');
const themes: Record<string, string> = Object.fromEntries(
  readdirSync(new URL('../themes/', import.meta.url))
    .filter((file) => file.endsWith('.css'))
    .map((file) => [file, read(`../themes/${file}`)]),
);
const declared = (css: string) => [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);

// The tokens the app actually reads: its @theme block, plus the page backdrop.
const themeBlock = /@theme\s*\{([^}]*)\}/.exec(baseCss)?.[1] ?? '';
const knownTokens = new Set([...declared(themeBlock), '--app-background']);

const themeFiles = Object.keys(themes);

describe('themes', () => {
  it('reads the app tokens', () => {
    expect(knownTokens.size).toBeGreaterThan(10);
  });

  it('ships the default theme the build and the container fall back to', () => {
    expect(themeFiles).toContain('christmas.css');
  });

  it.each(themeFiles)('%s has a name THEME can select', (file) => {
    expect(file).toMatch(/^[a-z0-9-]+\.css$/);
  });

  // A misspelt token is silently ignored by the browser, so catch it here.
  it.each(themeFiles)('%s only sets tokens the app reads', (file) => {
    const unknown = declared(themes[file]!).filter((t) => !knownTokens.has(t));
    expect(unknown).toEqual([]);
  });

  it('the default theme lists every token, so it can be copied as a template', () => {
    const tokens = new Set(declared(themes['christmas.css']!));
    expect([...knownTokens].filter((t) => !tokens.has(t))).toEqual([]);
  });
});
