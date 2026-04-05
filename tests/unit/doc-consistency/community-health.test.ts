import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..', '..')
const codeOfConductPath = join(ROOT, 'CODE_OF_CONDUCT.md')
const securityPath = join(ROOT, 'SECURITY.md')

function readCodeOfConduct(): string {
  return readFileSync(codeOfConductPath, 'utf-8')
}

function readSecurity(): string {
  return readFileSync(securityPath, 'utf-8')
}

describe('CODE_OF_CONDUCT.md', () => {
  it('contains Contributor Covenant string', () => {
    const content = readCodeOfConduct()
    expect(content).toContain('Contributor Covenant')
  })

  it('references version 2.1', () => {
    const content = readCodeOfConduct()
    expect(content).toContain('2.1')
  })
})

describe('SECURITY.md', () => {
  it('contains a Supported Versions section', () => {
    const content = readSecurity()
    expect(content).toContain('Supported Versions')
  })

  it('contains a Reporting a Vulnerability section', () => {
    const content = readSecurity()
    expect(content).toContain('Reporting a Vulnerability')
  })

  it('does not instruct reporters to open a public GitHub issue', () => {
    const content = readSecurity()
    expect(content).not.toContain('open a GitHub issue')
  })
})
