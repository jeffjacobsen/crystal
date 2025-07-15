# Crystal ICE - Integrated Context Engineering

> **Note**: Crystal ICE is an enhanced fork of Crystal that adds Integrated Context Engineering through Product Requirement Prompts (PRPs), web documentation scraping, and structured AI-assisted development. Test users should follow the instructions below to run from source.

## 🚀 Quick Start for Test Users

### Prerequisites
- Node.js 18+ and pnpm installed
- Claude Code CLI installed and logged in
- Git installed
- Python 3.8+ (for web scraping functionality)
- crawl4ai package: `pip install crawl4ai==0.7.0`

### Running from Source

```bash
# Clone the enhanced fork
git clone https://github.com/jeffjacobsen/crystal.git
cd crystal

# Checkout the PRP-enhanced branch
git checkout feature/prp-enhanced

# Install dependencies and build
pnpm run setup

# Run in development mode
pnpm run dev
```

### What Makes Crystal ICE Different?

Crystal ICE (Integrated Context Engineering) enhances the original Crystal with powerful context management features:

- **Product Requirement Prompts (PRPs)**: Structured templates for AI-assisted development
- **AI-Powered PRP Generation**: Use Claude Code to generate PRPs from templates
- **Web Documentation Import**: Scrape and import documentation from URLs with intelligent crawling
- **Context-First Design**: Documents and PRPs exist independently of projects
- **Streamlined Workflow**: Integrated PRP selection in session creation
- **Progressive Disclosure**: Step-by-step interfaces for complex operations

For detailed documentation about our enhancements, see the `/docs` directory:
- `docs/ADAPTATION_PLAN.md` - Original vision and implementation roadmap
- `docs/PROGRESS_SUMMARY.md` - Detailed list of all changes and enhancements
- `docs/PRP-TEMPLATE-SYSTEM.md` - Complete PRP template system documentation

**Notes: If you encounter Python-related errors during setup check https://github.com/stravu/crystal/commit/f8fc298ca00b27b954f163e65544375806532d87


## Installation

### Download Pre-built Binaries

Pre-built binaries are not yet available for this enhanced fork. Please run from source as shown above.


## 🧪 Testing

Crystal uses Vitest for unit testing and Playwright for E2E testing. The test suite includes critical security tests for XSS prevention and command injection protection.

### Running Tests

```bash
# Run all tests (unit + E2E)
pnpm test

# Run unit tests only
pnpm test:unit

# Run unit tests in watch mode (auto-reruns on file changes)
pnpm test:unit:watch

# Run security tests only (shellEscape + sanitizer)
pnpm test:security

# Run tests with coverage report
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

### Running Specific Tests

```bash
# Run a single test file
pnpm test:unit main/src/utils/__tests__/shellEscape.test.ts

# Run tests matching a pattern
pnpm test:unit -t security

# Run all tests in a specific directory
pnpm test:unit main/src/utils/__tests__
```

### Test Coverage

The test suite covers:
- ✅ **Security utilities** - Command injection and XSS prevention (48 tests)
- ✅ **PRP system** - Template loading, parsing, and generation (8 tests)
- ✅ **Git operations** - Worktree management and git commands (17 tests)
- ✅ **Session management** - Complete session lifecycle (28 tests)
- ✅ **Template system** - PRP template loading and management (10 tests)
- ✅ **Frontend components** - UI components and user interactions (99 tests)

**Current Status**: 210 total tests with 100% backend test coverage (89/89 passing)


------------------------------------------------

## Original Crystal Overview

Crystal is an Electron desktop application that lets you run, inspect, and test multiple Claude Code instances simultaneously using git worktrees. It provides structured development with Product Requirement Prompts (PRPs) that guide AI-assisted development for longer coding sessions.


## The Crystal Workflow

1. Create sessions from prompts, each in an isolated git worktree
2. Iterate with Claude Code inside your sessions. Each iteration will make a commit so you can always go back.
3. Review the diff changes and make manual edits as needed
4. Squash your commits together with a new message and rebase to your main branch.

## ✨ Key Features

- **🚀 Parallel Sessions** - Run multiple Claude Code instances at once
- **🌳 Git Worktree Isolation** - Each session gets its own branch
- **💾 Session Persistence** - Resume conversations anytime
- **🔧 Git Integration** - Built-in rebase and squash operations
- **📊 Change Tracking** - View diffs and track modifications
- **🔔 Notifications** - Desktop alerts when sessions need input
- **🏗️ Run Scripts** - Test changes instantly without leaving Crystal
- **📋 Product Requirement Prompts** - Structured development with AI-assisted PRP generation
- **🎯 Focused Workflow** - Streamlined session creation with PRP integration
- **🌐 Web Scraping** - Import documentation directly from URLs with intelligent crawling
- **📄 Document Management** - Create and manage documents independently of projects

## 🚀 Quick Start

## Building from Source

```bash
# Clone the repository
git clone https://github.com/stravu/crystal.git
cd crystal

# One-time setup
pnpm run setup

# Run in development
pnpm run electron-dev
```

## Building for Production

```bash
# Build for macOS
pnpm build:mac
```

### Prerequisites
- Claude Code installed and logged in
- Git installed
- Git repository (Crystal will initialize one if needed)

### 1. Create a Project
Create a new project if you haven't already. This can be an empty folder or an existing git repository. Crystal will initialize git if needed.

### 2. Create Sessions from a Prompt
For any feature you're working on, create one or multiple new sessions:
- Each session will be an isolated git worktree
- Optionally select a Product Requirement Prompt (PRP) to guide development
- PRPs can be generated with AI assistance using Claude Code

### 3. Monitor and Test Your Changes
As sessions complete:
- **Configure run scripts** in project settings to test your application without leaving Crystal
- **Use the diff viewer** to review all changes and make manual edits as needed
- **Continue conversations** with Claude Code if you need additional changes

### 4. Finalize Your Changes
When everything looks good:
- Click **"Rebase to main"** to squash all commits with a new message and rebase them to your main branch
- This creates a clean commit history on your main branch

### Git Operations
- **Rebase from main**: Pull latest changes from main into your worktree
- **Squash and rebase to main**: Combine all commits and rebase onto main
- Always preview commands with tooltips before executing


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Developing Crystal with Crystal

If you're using Crystal to develop Crystal itself, you need to use a separate data directory to avoid conflicts with your main Crystal instance:

```bash
# Set the run script in your Crystal project settings to:
pnpm run setup && pnpm run build:main && CRYSTAL_DIR=~/.crystal_test pnpm electron-dev
```

This ensures:
- Your development Crystal instance uses `~/.crystal_test` for its data
- Your main Crystal instance continues using `~/.crystal` 
- Worktrees won't conflict between the two instances
- You can safely test changes without affecting your primary Crystal setup