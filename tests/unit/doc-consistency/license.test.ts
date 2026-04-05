import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const licensePath = join(process.cwd(), 'LICENSE');

describe('LICENSE file exists with correct MIT text and copyright', () => {
  it('LICENSE file exists at repository root', () => {
    expect(existsSync(licensePath)).toBe(true);
  });

  it('contains MIT License header', () => {
    const content = readFileSync(licensePath, 'utf-8');
    expect(content).toContain('MIT License');
  });

  it('contains correct copyright line', () => {
    const content = readFileSync(licensePath, 'utf-8');
    expect(content).toContain('Copyright (c)');
    expect(content).toContain('Giulia Mantuano');
  });

  it('contains permission grant text', () => {
    const content = readFileSync(licensePath, 'utf-8');
    expect(content).toContain('Permission is hereby granted');
  });
});
