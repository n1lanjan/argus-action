# Contributing to Argus - The All-Seeing Code Guardian 👁️

Thank you for your interest in contributing to Argus! Join us in building the most advanced AI-powered code review system. This document provides guidelines and information for contributors.

## 🎯 Project Overview

Argus is an advanced AI-powered GitHub Action that deploys specialized agent "eyes" to watch over code quality. Like the mythical hundred-eyed giant, Argus sees everything and guards your codebase with unmatched vigilance. Our goal is to create the most helpful, educational, and accurate code review tool available.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TypeScript knowledge
- GitHub CLI (optional, for testing)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/argus.git
   cd argus
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Add your API keys for testing
   ```

4. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

## 🏗️ Architecture Overview

The project follows a modular architecture:

```
src/
├── main.ts                 # Entry point and orchestration
├── types/                  # TypeScript type definitions
├── config/                 # Configuration management
├── services/               # External service integrations
├── agents/                 # Specialized AI review agents
├── orchestrator/           # Agent coordination
├── context/                # Project context analysis
├── prioritizer/            # File prioritization logic
├── linting/                # Static analysis integration
└── synthesis/              # Result aggregation
```

### Key Components

#### 1. **The Eyes of Argus**
Specialized AI agents that focus on specific aspects:
- **👁️ Security Eye**: Vulnerability detection and security analysis
- **👁️ Logic Eye**: Deep code logic analysis (uses Claude Code)
- **👁️ Architecture Eye**: Design pattern and structure review
- **👁️ Performance Eye**: Performance optimization and bottleneck detection
- **👁️ Testing Eye**: Test quality and coverage analysis

#### 2. **Orchestrator**
Coordinates agent execution with:
- Parallel processing with concurrency limits
- Retry logic and error handling
- Performance monitoring
- Dynamic weight adjustment

#### 3. **Context Builder**
Analyzes project structure to understand:
- Frameworks and technologies
- Coding conventions
- Architecture patterns
- Security requirements

## 🤝 How to Contribute

### Types of Contributions

1. **Bug Fixes**: Fix issues in existing functionality
2. **New Features**: Add new capabilities or agents
3. **Performance**: Improve speed or resource usage
4. **Documentation**: Improve docs or add examples
5. **Testing**: Add or improve test coverage

### Contribution Process

1. **Find or Create an Issue**
   - Check existing issues first
   - For bugs, include reproduction steps
   - For features, describe the use case

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make Changes**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Test Your Changes**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

5. **Submit a Pull Request**
   - Use a clear, descriptive title
   - Include detailed description
   - Reference related issues
   - Add screenshots/examples if applicable

### Code Style Guidelines

#### TypeScript Standards

```typescript
// ✅ Good: Clear interfaces with documentation
interface ReviewIssue {
  /** Issue severity level */
  severity: 'critical' | 'error' | 'warning' | 'info'
  /** Descriptive title */
  title: string
  /** Detailed explanation */
  description: string
}

// ✅ Good: Async/await with proper error handling
async function analyzeFile(file: string): Promise<ReviewIssue[]> {
  try {
    const result = await someAsyncOperation(file)
    return processResult(result)
  } catch (error) {
    core.error(`Failed to analyze ${file}: ${error}`)
    throw error
  }
}

// ✅ Good: Descriptive function and variable names
function calculateConfidenceScore(issues: ReviewIssue[], context: ReviewContext): number {
  const baseConfidence = 0.8
  const issueCount = issues.length
  return Math.min(1.0, baseConfidence + (issueCount * 0.05))
}
```

#### Error Handling

```typescript
// ✅ Good: Proper error handling with context
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  core.error(`Operation failed: ${errorMessage}`)
  // Re-throw if it should propagate, or handle gracefully
  throw new Error(`Failed to complete operation: ${errorMessage}`)
}
```

#### Logging

```typescript
// ✅ Good: Structured logging with appropriate levels
core.info('🚀 Starting review process...')
core.debug(`Processing file: ${filename}`)
core.warning(`Skipping file due to size: ${filename}`)
core.error(`Critical failure in agent: ${error}`)
```

### Adding New Eyes to Argus

To add a new specialized eye (agent):

1. **Create Agent Class**
   ```typescript
   // src/agents/YourEye.ts
   export class YourEye implements ReviewAgent {
     name: AgentType = 'your-eye'
     capabilities = ['capability1', 'capability2']
     priority = 1

     async execute(context: ReviewContext): Promise<AgentResult> {
       // Your eye's vigilant implementation here
     }
   }
   ```

2. **Update Types**
   ```typescript
   // src/types/index.ts
   export type AgentType = 'security' | 'logic' | 'your-eye' | ...
   ```

3. **Register in Orchestrator**
   ```typescript
   // src/orchestrator/ReviewOrchestrator.ts
   const agentFactories = {
     // ... existing eyes
     'your-eye': () => new YourEye(this.config)
   }
   ```

4. **Add Tests**
   ```typescript
   // src/agents/__tests__/YourEye.test.ts
   describe('YourEye', () => {
     it('should vigilantly detect issues', async () => {
       // Test your eye's vigilance
     })
   })
   ```

### Testing Guidelines

#### Unit Tests
```typescript
// ✅ Good: Comprehensive unit test
describe('SecurityEye', () => {
  let securityEye: SecurityAgent
  let mockContext: ReviewContext

  beforeEach(() => {
    securityEye = new SecurityAgent(mockConfig)
    mockContext = createMockContext()
  })

  it('should vigilantly detect SQL injection vulnerabilities', async () => {
    const file = {
      filename: 'user.ts',
      content: 'const query = `SELECT * FROM users WHERE id = ${userId}`',
      patch: '+ const query = `SELECT * FROM users WHERE id = ${userId}`'
    }
    
    const result = await securityEye.execute({ ...mockContext, changedFiles: [file] })
    
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].category).toBe('security-input-validation')
    expect(result.issues[0].severity).toBe('critical')
  })
})
```

#### Integration Tests
```typescript
// ✅ Good: End-to-end integration test
describe('Integration: Full Review Process', () => {
  it('should complete review for sample PR', async () => {
    const context = await buildMockPRContext()
    const orchestrator = new ReviewOrchestrator(config)
    
    const results = await orchestrator.executeReview(context)
    
    expect(results).toHaveLength(3) // Expected number of eyes
    expect(results.every(r => r.confidence > 0)).toBe(true)
  })
})
```

### Documentation Standards

#### Code Documentation
```typescript
/**
 * Analyzes code changes for security vulnerabilities
 * 
 * @param context - Complete review context including PR info and files
 * @returns Promise resolving to analysis results with confidence score
 * @throws Error if API credentials are invalid or network fails
 * 
 * @example
 * ```typescript
 * const agent = new SecurityAgent(config)
 * const results = await agent.execute(context)
 * console.log(`Found ${results.issues.length} security issues`)
 * ```
 */
async execute(context: ReviewContext): Promise<AgentResult>
```

#### README Updates
When adding features, update relevant sections:
- Architecture diagrams
- Configuration options
- Usage examples
- Troubleshooting guides

## 🐛 Bug Reports

### Bug Report Template
```markdown
## Bug Description
Clear description of what's wrong

## Reproduction Steps
1. Step one
2. Step two
3. Expected vs actual behavior

## Environment
- Node.js version:
- Repository type:
- Configuration used:

## Logs
```
Error logs or relevant output
```

## Additional Context
Screenshots, related issues, etc.
```

## 💡 Feature Requests

### Feature Request Template
```markdown
## Feature Description
What feature would you like to see?

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How do you envision this working?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Examples, mockups, related features, etc.
```

## 📋 Pull Request Guidelines

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Automated Checks**
   - Tests must pass
   - Linting must pass
   - Build must succeed

2. **Code Review**
   - At least one maintainer approval
   - Address all feedback
   - Update based on suggestions

3. **Merge Requirements**
   - Squash commits for features
   - Preserve meaningful commit history
   - Update changelog if needed

## 🔧 Development Tips

### Local Testing
```bash
# Test against a real repository
export GITHUB_TOKEN="your-token"
export ANTHROPIC_API_KEY="your-key"
npm run test:integration

# Test specific agent
npm test -- --testNamePattern="SecurityAgent"

# Debug mode
DEBUG=true npm test
```

### Performance Profiling
```bash
# Profile agent performance
npm run profile:agents

# Memory usage analysis
npm run analyze:memory
```

### AI Model Testing
```bash
# Test with different models
ANTHROPIC_MODEL="claude-3-haiku-20240307" npm test
ANTHROPIC_MODEL="claude-3-opus-20240229" npm test
```

## 🆘 Getting Help

- **Discord**: Join our [Discord server](https://discord.gg/argus-code-guardian)
- **GitHub Discussions**: Use for questions and ideas
- **Issues**: For bugs and feature requests
- **Email**: maintainers@argus-guardian.com

## 📜 Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/). Please:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions
- Report unacceptable behavior

## 🎉 Recognition

Contributors are recognized in:
- GitHub contributor graph
- Release notes for significant contributions
- Annual contributor spotlight
- Special Discord roles

Thank you for contributing to Argus - The All-Seeing Code Guardian! 👁️🚀