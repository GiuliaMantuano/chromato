# milestone-7-release-distribution.feature
#
# Feature: Release and distribution readiness for chromato
#
# Covers the npm-registry and github-releases deployment environments.
# These scenarios validate that the published package installs and runs correctly
# for end users, and that the release artefacts (SBOM, changelog) are well-formed.
#
# All scenarios are tagged @skip -- they are distribution-level scenarios
# deferred to the release gate in the DELIVER wave.
#
# Environment coverage:
#   npm-registry    --> M7-01, M7-02
#   github-releases --> M7-03, M7-04

@milestone_7 @distribution
Feature: Release distribution readiness

  # ---------------------------------------------------------------------------
  # npm-registry environment
  # ---------------------------------------------------------------------------

  @skip @npm_registry @walking_skeleton
  Scenario: M7-01 Developer installs chromato globally from local tarball and runs version check
    # Covers: npm-registry environment -- global install path
    # Story: US-05 (infrastructure / distribution readiness)
    Given chromato has been packed as a local npm tarball with "npm pack"
    When a developer installs the tarball globally with "npm install -g" in a fresh temporary directory
    Then "chromato --version" runs successfully from outside the project directory
    And the command exits with code 0
    And the output contains a semver string matching the pattern "MAJOR.MINOR.PATCH"

  @skip @npm_registry
  Scenario: M7-02 Globally installed chromato responds to start and status commands from any working directory
    # Covers: npm-registry environment -- CLI usability after global install
    # Story: US-05 (infrastructure / distribution readiness)
    Given chromato is installed globally from the local tarball
    When the developer runs "chromato start --work 1" from "/tmp"
    Then the command exits with code 0
    When the developer runs "chromato status --format tmux" from "/tmp"
    Then the command exits with code 0

  # ---------------------------------------------------------------------------
  # github-releases environment
  # ---------------------------------------------------------------------------

  @skip @github_releases
  Scenario: M7-03 Release build produces a valid SBOM that names the package and all declared dependencies
    # Covers: github-releases environment -- supply chain transparency
    # Story: US-05 (infrastructure / distribution readiness)
    Given the project build has completed successfully
    When "@cyclonedx/cyclonedx-npm" generates the software bill of materials
    Then the SBOM output is well-formed and can be parsed as structured data
    And the SBOM identifies the package name as "chromato"
    And the SBOM lists every dependency declared in the project manifest

  @skip @github_releases
  Scenario: M7-04 Changelog generated from conventional commits contains at least one user-facing entry
    # Covers: github-releases environment -- release notes quality
    # Story: US-05 (infrastructure / distribution readiness)
    Given conventional commits exist in the repository since the previous release tag
    When the release workflow generates the changelog for the new tag
    Then the changelog contains at least one entry with a "feat" or "fix" commit prefix
