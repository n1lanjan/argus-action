/**
 * Project Context Builder
 *
 * Analyzes the project structure and builds comprehensive context about:
 * - Framework and technology detection
 * - Architecture patterns and conventions
 * - Code organization and structure
 * - Testing strategies and patterns
 * - Security requirements and patterns
 * - Performance criteria and budgets
 */

import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  ProjectContext,
  ReviewConfiguration,
  DetectedFramework,
  ArchitectureInfo,
  CodingConventions,
  TestingStrategy,
  SecurityProfile,
  PerformanceProfile,
  DependencyInfo,
} from '../types'

export class ProjectContextBuilder {
  private readonly workspaceRoot: string

  constructor(private config: ReviewConfiguration) {
    this.workspaceRoot = process.cwd()
  }

  /**
   * Build comprehensive project context
   */
  async buildContext(): Promise<ProjectContext> {
    core.info('🧠 Building project context...')

    try {
      const [
        frameworks,
        architecture,
        conventions,
        testStrategy,
        security,
        performance,
        dependencies,
      ] = await Promise.all([
        this.detectFrameworks(),
        this.analyzeArchitecture(),
        this.analyzeCodingConventions(),
        this.analyzeTestingStrategy(),
        this.analyzeSecurityProfile(),
        this.analyzePerformanceProfile(),
        this.analyzeDependencies(),
      ])

      const context: ProjectContext = {
        frameworks,
        architecture,
        conventions,
        testStrategy,
        security,
        performance,
        dependencies,
      }

      core.info(`🧠 Context built: ${frameworks.length} frameworks detected`)
      return context
    } catch (error) {
      core.warning(`Failed to build complete project context: ${error}`)
      return this.getDefaultContext()
    }
  }

  /**
   * Detect frameworks and technologies used in the project
   */
  private async detectFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = []

    try {
      // Check package.json for JavaScript/Node.js frameworks
      const packageJsonPath = path.join(this.workspaceRoot, 'package.json')
      const packageJson = await this.readJsonFile(packageJsonPath)

      if (packageJson) {
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        }

        // React detection
        if (allDeps.react) {
          frameworks.push({
            name: 'react',
            version: allDeps.react,
            confidence: 0.9,
            configFiles: ['package.json'],
          })
        }

        // Vue detection
        if (allDeps.vue) {
          frameworks.push({
            name: 'vue',
            version: allDeps.vue,
            confidence: 0.9,
            configFiles: ['package.json'],
          })
        }

        // Express detection
        if (allDeps.express) {
          frameworks.push({
            name: 'express',
            version: allDeps.express,
            confidence: 0.9,
            configFiles: ['package.json'],
          })
        }

        // Next.js detection
        if (allDeps.next) {
          frameworks.push({
            name: 'nextjs',
            version: allDeps.next,
            confidence: 0.9,
            configFiles: ['package.json', 'next.config.js'],
          })
        }

        // TypeScript detection
        if (allDeps.typescript || (await this.fileExists('tsconfig.json'))) {
          frameworks.push({
            name: 'typescript',
            version: allDeps.typescript || 'detected',
            confidence: 0.95,
            configFiles: ['tsconfig.json', 'package.json'],
          })
        }
      }

      // Python framework detection
      if (
        (await this.fileExists('requirements.txt')) ||
        (await this.fileExists('pyproject.toml'))
      ) {
        frameworks.push({
          name: 'python',
          version: 'detected',
          confidence: 0.8,
          configFiles: ['requirements.txt', 'pyproject.toml'],
        })
      }

      // Java detection
      if ((await this.fileExists('pom.xml')) || (await this.fileExists('build.gradle'))) {
        frameworks.push({
          name: 'java',
          version: 'detected',
          confidence: 0.8,
          configFiles: ['pom.xml', 'build.gradle'],
        })
      }
    } catch (error) {
      core.debug(`Framework detection failed: ${error}`)
    }

    return frameworks
  }

  /**
   * Analyze project architecture and structure
   */
  private async analyzeArchitecture(): Promise<ArchitectureInfo> {
    const sourceDirectories: string[] = []
    const testDirectories: string[] = []
    const configDirectories: string[] = []
    const entryPoints: string[] = []

    try {
      // Common source directories
      const commonSrcDirs = ['src', 'lib', 'app', 'components', 'pages']
      for (const dir of commonSrcDirs) {
        if (await this.directoryExists(dir)) {
          sourceDirectories.push(dir)
        }
      }

      // Common test directories
      const commonTestDirs = ['test', 'tests', '__tests__', 'spec', 'cypress']
      for (const dir of commonTestDirs) {
        if (await this.directoryExists(dir)) {
          testDirectories.push(dir)
        }
      }

      // Common config directories
      const commonConfigDirs = ['config', '.github', '.vscode', 'scripts']
      for (const dir of commonConfigDirs) {
        if (await this.directoryExists(dir)) {
          configDirectories.push(dir)
        }
      }

      // Common entry points
      const commonEntryPoints = ['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts']
      for (const file of commonEntryPoints) {
        if ((await this.fileExists(file)) || (await this.fileExists(`src/${file}`))) {
          entryPoints.push(file)
        }
      }
    } catch (error) {
      core.debug(`Architecture analysis failed: ${error}`)
    }

    return {
      pattern: this.inferArchitecturePattern(sourceDirectories),
      sourceDirectories,
      testDirectories,
      configDirectories,
      entryPoints,
    }
  }

  /**
   * Analyze coding conventions used in the project
   */
  private async analyzeCodingConventions(): Promise<CodingConventions> {
    // Default conventions - in a full implementation, this would analyze actual code
    return {
      indentation: 'spaces',
      indentSize: 2,
      naming: {
        variables: 'camelCase',
        functions: 'camelCase',
        classes: 'PascalCase',
        constants: 'UPPER_CASE',
      },
      imports: {
        style: 'es6',
        organization: 'grouped',
      },
    }
  }

  /**
   * Analyze testing strategy and patterns
   */
  private async analyzeTestingStrategy(): Promise<TestingStrategy> {
    let framework = 'unknown'
    const patterns: string[] = []
    const types: ('unit' | 'integration' | 'e2e')[] = []

    try {
      const packageJson = await this.readJsonFile('package.json')
      if (packageJson?.devDependencies) {
        if (packageJson.devDependencies.jest) {
          framework = 'jest'
          patterns.push('**/*.test.js', '**/*.spec.js')
          types.push('unit')
        }
        if (packageJson.devDependencies.cypress) {
          types.push('e2e')
          patterns.push('cypress/**/*.spec.js')
        }
        if (packageJson.devDependencies.mocha) {
          framework = 'mocha'
          patterns.push('test/**/*.js')
          types.push('unit')
        }
      }
    } catch (error) {
      core.debug(`Testing strategy analysis failed: ${error}`)
    }

    return {
      framework,
      patterns,
      coverage: {
        minimum: 70,
        target: 80,
      },
      types,
    }
  }

  /**
   * Analyze security profile and requirements
   */
  private async analyzeSecurityProfile(): Promise<SecurityProfile> {
    const criticalFiles: string[] = []
    const authPatterns: string[] = []

    // Security-critical file patterns
    const securityPatterns = [
      '**/auth/**',
      '**/authentication/**',
      '**/security/**',
      '**/crypto/**',
      '**/*auth*',
      '**/*security*',
      '**/*password*',
      '**/*token*',
    ]

    criticalFiles.push(...securityPatterns)

    return {
      criticalFiles,
      authPatterns,
      dataHandling: {
        encryption: true,
        sanitization: true,
        validation: true,
      },
    }
  }

  /**
   * Analyze performance profile and criteria
   */
  private async analyzePerformanceProfile(): Promise<PerformanceProfile> {
    return {
      criticalAreas: ['src/api/**', 'src/services/**', 'src/utils/**', 'src/components/**'],
      budgets: {
        bundleSize: 500000, // 500KB
        loadTime: 3000, // 3 seconds
        memoryUsage: 100, // 100MB
      },
    }
  }

  /**
   * Analyze project dependencies
   */
  private async analyzeDependencies(): Promise<DependencyInfo> {
    let packageManager: DependencyInfo['packageManager'] = 'npm'
    const production: string[] = []
    const development: string[] = []
    const outdated: string[] = []
    const vulnerabilities: any[] = []

    try {
      // Detect package manager
      if (await this.fileExists('yarn.lock')) {
        packageManager = 'yarn'
      } else if (await this.fileExists('pnpm-lock.yaml')) {
        packageManager = 'pnpm'
      } else if (await this.fileExists('pom.xml')) {
        packageManager = 'maven'
      } else if (await this.fileExists('build.gradle')) {
        packageManager = 'gradle'
      } else if (await this.fileExists('requirements.txt')) {
        packageManager = 'pip'
      }

      // Analyze package.json if it exists
      const packageJson = await this.readJsonFile('package.json')
      if (packageJson) {
        production.push(...Object.keys(packageJson.dependencies || {}))
        development.push(...Object.keys(packageJson.devDependencies || {}))
      }
    } catch (error) {
      core.debug(`Dependency analysis failed: ${error}`)
    }

    return {
      packageManager,
      production,
      development,
      outdated,
      vulnerabilities,
    }
  }

  /**
   * Helper methods
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.workspaceRoot, filePath))
      return true
    } catch {
      return false
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(this.workspaceRoot, dirPath))
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(path.join(this.workspaceRoot, filePath), 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private inferArchitecturePattern(sourceDirectories: string[]): string {
    if (sourceDirectories.includes('components') || sourceDirectories.includes('pages')) {
      return 'Component-based'
    }
    if (sourceDirectories.includes('controllers') || sourceDirectories.includes('models')) {
      return 'MVC'
    }
    if (sourceDirectories.some(dir => dir.includes('service'))) {
      return 'Service-oriented'
    }
    return 'Modular'
  }

  private getDefaultContext(): ProjectContext {
    return {
      frameworks: [],
      architecture: {
        pattern: 'Unknown',
        sourceDirectories: ['src'],
        testDirectories: ['test'],
        configDirectories: ['.github'],
        entryPoints: ['index.js'],
      },
      conventions: {
        indentation: 'spaces',
        indentSize: 2,
        naming: {
          variables: 'camelCase',
          functions: 'camelCase',
          classes: 'PascalCase',
          constants: 'UPPER_CASE',
        },
        imports: {
          style: 'es6',
          organization: 'grouped',
        },
      },
      testStrategy: {
        framework: 'unknown',
        patterns: [],
        coverage: { minimum: 70, target: 80 },
        types: [],
      },
      security: {
        criticalFiles: [],
        authPatterns: [],
        dataHandling: {
          encryption: true,
          sanitization: true,
          validation: true,
        },
      },
      performance: {
        criticalAreas: [],
        budgets: {},
      },
      dependencies: {
        packageManager: 'npm',
        production: [],
        development: [],
        outdated: [],
        vulnerabilities: [],
      },
    }
  }
}
