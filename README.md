# 🔍 Argus - The All-Seeing Code Guardian

An advanced AI-powered GitHub Action with multiple specialized agents that watch
over your code like the mythical hundred-eyed giant. Argus combines cutting-edge
AI models with static analysis to provide comprehensive, educational feedback on
pull requests.

## 🎯 Overview

Argus goes beyond traditional code review tools by deploying specialized AI
agents - the "Eyes of Argus" - each watching for different aspects of code
quality:

- **👁️ Security Eye**: Watches for vulnerabilities, auth issues, and data
  exposure risks
- **👁️ Logic Eye**: Deep analysis using Claude Code for business logic and edge
  cases
- **👁️ Architecture Eye**: Guards design patterns, SOLID principles, and code
  organization
- **👁️ Performance Eye**: Spots bottlenecks and optimization opportunities
- **🔧 Intelligent Linting**: Summarizes static analysis instead of comment spam
- **🧠 Context Awareness**: Understands your entire project like a senior
  developer
- **🎓 Developer Coaching**: Teaches while reviewing, tailored to experience
  level
- **📏 Scales Gracefully**: Handles large PRs with smart prioritization
  strategies
- **🧩 Learns & Adapts**: Evolves with your team's preferences over time

## 🏗️ Architecture

```mermaid
graph TB
    A[GitHub PR Event] --> B[File Change Detection]
    B --> C[Project Context Builder]
    C --> D[File Prioritizer]
    D --> E[Linting Coordinator]
    E --> F[Multi-Agent Orchestrator]

    F --> G[👁️ Security Eye]
    F --> H[👁️ Architecture Eye]
    F --> I[👁️ Logic Eye]
    F --> J[👁️ Performance Eye]
    F --> K[👁️ Testing Eye]

    G --> L[Review Synthesizer]
    H --> L
    I --> L
    J --> L
    K --> L

    L --> M[Coaching Engine]
    M --> N[GitHub Comments]
```

### The Eyes of Argus

1. **👁️ Multi-Agent Orchestrator**: The central eye that coordinates all other
   eyes
2. **🧠 Context Builder**: Analyzes project DNA - structure, frameworks, and
   patterns
3. **🎯 File Prioritizer**: Focuses the most powerful eyes on the highest-risk
   changes
4. **🔧 Linting Coordinator**: Integrates multiple static analysis tools
   intelligently
5. **⚡ Review Synthesizer**: Weaves insights from all eyes into coherent wisdom
6. **🎓 Coaching Engine**: Transforms findings into educational growth
   opportunities

## 🚀 Quick Start

### Installation

Add this workflow file to your repository at `.github/workflows/argus.yml`:

```yaml
name: Argus Code Guardian

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  pull_request_review_comment:
    types: [created]

concurrency:
  group: ${{ github.repository }}-${{ github.event.number }}-argus-action
  cancel-in-progress: true

jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: n1lanjan/argus-action@main
        env:
          GITHUB_TOKEN: ${{ github.token }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          strictness-level: 'standard'
          focus-areas: 'security,architecture,performance'
          learning-mode: true
          update-pr-description: append # Optional: append, overwrite, or disabled
```

### Configuration

| Parameter               | Description                                                     | Default                       |
| ----------------------- | --------------------------------------------------------------- | ----------------------------- |
| `strictness-level`      | Review strictness: `coaching`, `standard`, `strict`, `blocking` | `standard`                    |
| `focus-areas`           | Comma-separated focus areas                                     | `security,architecture,logic` |
| `learning-mode`         | Enable adaptive learning from feedback                          | `true`                        |
| `max-files`             | Maximum files to review (0 = no limit)                          | `50`                          |
| `enable-coaching`       | Provide educational feedback                                    | `true`                        |
| `update-pr-description` | PR description mode: `disabled`, `overwrite`, `append`          | `append`                      |

## 👁️ The Eyes of Argus

### 🔒 Security Eye

_"The Vigilant Guardian"_

- Spots vulnerabilities like SQL injection, XSS, and auth bypasses
- Guards against data exposure and privacy leaks
- Validates cryptographic implementations and secure configurations

### 🏗️ Architecture Eye

_"The Design Sentinel"_

- Enforces SOLID principles and clean architecture
- Detects design pattern violations and coupling issues
- Guides modular design and dependency management

### 🧠 Logic Eye

_"The Reasoning Oracle"_ (Powered by Claude Code)

- Deep analysis of business logic and algorithmic correctness
- Identifies edge cases, race conditions, and logic flaws
- Provides context-aware insights with full codebase understanding

### ⚡ Performance Eye

_"The Speed Demon"_

- Hunts down bottlenecks and inefficient algorithms
- Spots memory leaks and resource waste
- Suggests optimizations for speed and scalability

### 🧪 Testing Eye

_"The Quality Assurance Master"_

- Evaluates test coverage and quality
- Identifies missing test scenarios
- Reviews testing patterns and best practices

## 📊 Features

### Intelligent Linting Integration

Instead of creating individual comments for every linting issue, Argus:

- Runs ESLint, TypeScript, Prettier, and other configured linters
- Summarizes findings in a single, organized comment
- Only flags issues that require human judgment
- Provides quick-fix suggestions where appropriate

### Context-Aware Reviews

The tool builds a comprehensive understanding of your project:

- **Framework Detection**: Automatically detects React, Vue, Express, etc.
- **Pattern Recognition**: Learns your team's coding patterns
- **Architecture Analysis**: Understands your project structure
- **Dependency Mapping**: Analyzes how changes affect other parts

### Large PR Handling

For large pull requests (>50 files), the tool:

- Uses semantic chunking to group related changes
- Provides architectural-level summaries
- Focuses on high-risk changes first
- Runs agents in parallel for efficiency

### Developer Coaching

Based on the developer's experience level and past feedback:

- Provides educational context for suggestions
- Explains why certain patterns are problematic
- Suggests learning resources
- Adapts feedback complexity to skill level

### PR Description Enhancement

Argus offers three modes for PR description updates via `update-pr-description`:

#### **`disabled`**

No changes to PR description - all review details stay in comments only.

#### **`append` (default)**

Appends Argus summary to existing description while preserving user content:

- **Smart Replacement**: Updates Argus section on subsequent runs without
  duplicating
- **Content Preservation**: Maintains all user-written content before and after
  Argus section
- **Marker-Based**: Uses HTML comments to identify and replace only Argus
  content

#### **`overwrite`**

Replaces entire PR description with Argus summary only:

- **Complete Replacement**: Overwrites all existing content with Argus review
- **Clean Slate**: Useful for automated PRs or when description should only
  contain review data

**Features (all modes except disabled):**

- **Risk Assessment**: Visual risk level indicator (🟢 Low, 🟡 Medium, 🟠 High,
  🔴 Critical)
- **Quick Metrics**: Files analyzed, issues found, and execution time
- **Issue Breakdown**: Count of critical, high, medium, and info-level issues
- **Action Guidance**: Clear next steps based on findings
- **Auto-Update**: Refreshes summary on new commits

Example PR description enhancement:

```markdown
## 👁️ Argus Code Review Summary

**Risk Level**: 🟡 Medium  
**Files Analyzed**: 12  
**Issues Found**: 8

**Issue Breakdown**:

- 🟡 Medium: 3
- 🔵 Info: 5

💡 **Improvements Available**: Minor issues and recommendations found.

📋 [View Detailed Review](#issuecomment-argus)
```

## 🔧 Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/argus.git
cd argus

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Package for distribution
npm run package
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test with sample PR
npm run test:sample-pr
```

## 📈 Metrics & Analytics

The tool tracks and improves over time:

- **Review Quality Score**: Based on developer feedback
- **False Positive Rate**: Issues marked as irrelevant
- **Learning Effectiveness**: Improvement in subsequent reviews
- **Coverage Metrics**: Percentage of critical issues caught

## 🛡️ Security & Privacy

- **No Code Storage**: Code is analyzed in-memory only
- **Encrypted Communication**: All API calls use HTTPS
- **Token Scoping**: Minimal required GitHub permissions
- **Audit Logging**: All AI interactions are logged for transparency

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/argus/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/your-org/argus/discussions)
- **Documentation**: [Wiki](https://github.com/your-org/argus/wiki)

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding
new features, or improving documentation, your help makes Argus better for
everyone.

### Quick Start for Contributors

1. **Fork the repository**
2. **Install dependencies**: `npm install`
3. **Make your changes** (git hooks will ensure code quality)
4. **Test locally**: `npm test && npm run build`
5. **Submit a pull request**

### Development Workflow

This project uses **Husky** git hooks to maintain code quality:

- **Pre-commit**: Runs ESLint, Prettier, and TypeScript checks
- **Commit messages**: Enforces conventional commit format (`feat:`, `fix:`,
  etc.)
- **Pre-push**: Runs full test suite and build verification

### How to Contribute

- 🐛 **Bug Reports**: Found an issue?
  [Open a bug report](https://github.com/n1lanjan/argus-action/issues)
- 💡 **Feature Requests**: Have an idea?
  [Share it with us](https://github.com/n1lanjan/argus-action/issues)
- 📖 **Documentation**: Help improve our docs
- 🔍 **New Agent Eyes**: Add specialized review capabilities

For detailed guidelines, see our [**Contributing Guide**](CONTRIBUTING.md).

## 🔮 Roadmap

- [ ] Visual Studio Code extension
- [ ] GitLab support
- [ ] Custom rule engine
- [ ] Team analytics dashboard
- [ ] Integration with more static analysis tools
- [ ] Multi-language support expansion

## 📄 License

This project is licensed under the Apache 2.0 License - see the
[LICENSE](LICENSE) file for details.

---

**👁️ Argus watches. Argus protects. Argus helps your code evolve.**
