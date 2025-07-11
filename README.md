# Crystal Fork - with PRP Generation

> **Note**: This is an enhanced fork of Crystal with Product Requirement Prompts (PRPs) for structured AI-assisted development.

## The Concept
Crystal is a Multi-Session Claude Code Manager.

The idea was to incorporate the ability to generate PRPs (see https://github.com/Wirasm/PRPs-agentic-eng)
This code could be a good starting point to add customized templates allowing users to easily generate specific applications, such as Agents, Websites, etc.  The PRP generation works quite well and I've actually used it to generate PRPs that I have copied and given to Claude manually while working on this fork.

Claude made some changes to the template struture that Rasmmus designed to merge the PRP instructions and templates into a single file. It also sugessted a future enhancement where the Creation Dialog could have optional variable replacement fields and modify those in the combined prompt/template. Some of this logic is in place in the metadata.json file that accompanies each template.md file and also in the template generation, but has not been implemented in the front end.

I've also tested using a PRP in New Session generation.  I haven't looked at or tested the (existing) Include Documents function. A future enhancement might involved have a document library or to use Cole's (https://github.com/coleam00) mcp-crawl or Archon to add documentation. 

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm installed
- Claude Code CLI installed and logged in
- Git installed

### Running from Source

```bash
# Clone the enhanced fork
git clone https://github.com/jeffjacobsen/crystal.git
cd crystal

# Install dependencies and build
pnpm run setup

# Run in development mode
pnpm run dev
```

### What's New in This Fork?
- **Product Requirement Prompts (PRPs)**: Structured templates for AI-assisted development
- **AI-Powered PRP Generation**: Use Claude Code to generate PRPs from templates
- **Streamlined UI**: Simplified session creation with PRP integration
- **Enhanced Documentation**: See `/docs` directory for detailed information

For detailed documentation about our enhancements, see the `/docs` directory:
- `docs/ADAPTATION_PLAN.md` - Original vision and implementation roadmap
- `docs/PROGRESS_SUMMARY.md` - Detailed list of all changes and enhancements
- `docs/PRP-TEMPLATE-SYSTEM.md` - Complete PRP template system documentation

**Notes: If you encounter Python-related errors during setup check https://github.com/stravu/crystal/commit/f8fc298ca00b27b954f163e65544375806532d87

---

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

## 🚀 Quick Start

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



## Installation

### Download Pre-built Binaries

Pre-built binaries are not yet available for this enhanced fork. Please run from source using the Quick Start instructions above.


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



## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Developing Crystal with Crystal

If you're using Crystal to develop Crystal itself, you need to use a separate data directory to avoid conflicts with your main Crystal instance:

```bash
# Set the run script in your Crystal project settings to:
pnpm run setup && CRYSTAL_DIR=~/.crystal_test pnpm electron-dev
```

This ensures:
- Your development Crystal instance uses `~/.crystal_test` for its data
- Your main Crystal instance continues using `~/.crystal` 
- Worktrees won't conflict between the two instances
- You can safely test changes without affecting your primary Crystal setup


## 📄 License

Crystal is open source software licensed under the [MIT License](LICENSE).

### Third-Party Licenses

Crystal includes third-party software components. All third-party licenses are documented in the [NOTICES](NOTICES) file. This file is automatically generated and kept up-to-date with our dependencies.

To regenerate the NOTICES file after updating dependencies:
```bash
pnpm run generate-notices
```

## Disclaimer

Crystal is an independent open-source project. Claude™ is a trademark of Anthropic, PBC. Crystal is not affiliated with, endorsed by, or sponsored by Anthropic. This tool is designed to work with Claude Code, which must be installed separately.
