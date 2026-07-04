import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..', '..')
const contributingPath = join(ROOT, 'CONTRIBUTING.md')

function readContributing(): string {
  return readFileSync(contributingPath, 'utf-8')
}

describe('CONTRIBUTING.md', () => {
  it('contains a Development Setup section', () => {
    const content = readContributing()
    expect(content).toContain('Development Setup')
  })

  it('references Node.js 22', () => {
    const content = readContributing()
    expect(content).toContain('Node.js 22')
  })

  it('references pnpm install', () => {
    const content = readContributing()
    expect(content).toContain('pnpm install')
  })

  it('references pnpm build', () => {
    const content = readContributing()
    expect(content).toContain('pnpm build')
  })

  it('references pnpm test', () => {
    const content = readContributing()
    expect(content).toContain('pnpm test')
  })

  it('references pnpm test:coverage', () => {
    const content = readContributing()
    expect(content).toContain('pnpm test:coverage')
  })

  it('contains a Pull Request Process section', () => {
    const content = readContributing()
    expect(content).toContain('Pull Request Process')
  })

  it('contains a Conventional Commits section', () => {
    const content = readContributing()
    expect(content).toContain('Conventional Commits')
  })

  it('contains a Code Style section', () => {
    const content = readContributing()
    expect(content).toContain('Code Style')
  })

  it('references TypeScript strict mode', () => {
    const content = readContributing()
    expect(content).toContain('TypeScript strict')
  })

  it('references tests/unit/', () => {
    const content = readContributing()
    expect(content).toContain('tests/unit/')
  })

  it('references tests/integration/', () => {
    const content = readContributing()
    expect(content).toContain('tests/integration/')
  })

  it('references tests/acceptance/', () => {
    const content = readContributing()
    expect(content).toContain('tests/acceptance/')
  })
})
