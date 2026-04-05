import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..', '..')
const bugReportPath = join(ROOT, '.github', 'ISSUE_TEMPLATE', 'bug_report.md')
const featureRequestPath = join(ROOT, '.github', 'ISSUE_TEMPLATE', 'feature_request.md')

function readBugReport(): string {
  return readFileSync(bugReportPath, 'utf-8')
}

function readFeatureRequest(): string {
  return readFileSync(featureRequestPath, 'utf-8')
}

describe('bug_report.md', () => {
  it('exists at .github/ISSUE_TEMPLATE/bug_report.md', () => {
    expect(() => readBugReport()).not.toThrow()
  })

  it('front-matter name contains "bug" (case-insensitive)', () => {
    const content = readBugReport()
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    expect(nameMatch).not.toBeNull()
    expect(nameMatch![1].toLowerCase()).toContain('bug')
  })

  it('contains Describe the bug section', () => {
    const content = readBugReport()
    expect(content).toContain('Describe the bug')
  })

  it('contains To Reproduce section', () => {
    const content = readBugReport()
    expect(content).toContain('To Reproduce')
  })

  it('contains Expected behavior section', () => {
    const content = readBugReport()
    expect(content).toContain('Expected behavior')
  })

  it('contains Environment section', () => {
    const content = readBugReport()
    expect(content).toContain('Environment')
  })

  it('contains Node.js version field in Environment', () => {
    const content = readBugReport()
    const hasNodeVersion = content.includes('Node.js version') || content.includes('node --version')
    expect(hasNodeVersion).toBe(true)
  })
})

describe('feature_request.md', () => {
  it('exists at .github/ISSUE_TEMPLATE/feature_request.md', () => {
    expect(() => readFeatureRequest()).not.toThrow()
  })

  it('front-matter name contains "feature" (case-insensitive)', () => {
    const content = readFeatureRequest()
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    expect(nameMatch).not.toBeNull()
    expect(nameMatch![1].toLowerCase()).toContain('feature')
  })

  it('contains Problem or motivation section', () => {
    const content = readFeatureRequest()
    expect(content).toContain('Problem or motivation')
  })

  it('contains Proposed solution section', () => {
    const content = readFeatureRequest()
    expect(content).toContain('Proposed solution')
  })
})
