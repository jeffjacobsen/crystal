# Crystal PRP Template System Documentation

## Overview

This file contains documentation for the Product Requirement Prompts (PRP) template system. The templates are designed to guide AI-assisted development by providing structured prompts that Claude Code can use to understand project requirements and generate appropriate code.

## Template System Structure

The active template system uses the following structure:

```
resources/
└── prp-templates/
    └── default/                       # Built-in templates
        ├── base/
        │   ├── metadata.json          # Template configuration
        │   └── template.md            # Template content
        └── bug-fix/
            ├── metadata.json
            └──template.md

~/.crystal/templates/                   # User custom templates
├── my-custom-template/
│   ├── metadata.json
│   └── template.md
└── another-template/
    ├── metadata.json
    └──  template.md
```

## Template System Components

### 1. Default Templates

Built-in templates located in `resources/prp-templates/default/`:

- **Base Template** (`base/`): General-purpose development template
- **Bug Fix** (`bug-fix/`): Bug investigation and resolution

Example templates located in `resources/prp-templates/examples/`:

- **React Component** (`web-react/`): Frontend React component development
- **Backend Service** (`backend-node/`): Node.js backend service development

### 2. Custom Templates

User-defined templates stored in `~/.crystal/templates/`:

- Each template is a directory with two files
- Automatically discovered and loaded at startup
- Can override default templates by using the same ID

### 3. Template Structure

Each template consists of two files:

#### `metadata.json`
```json
{
  "id": "my-template",
  "name": "My Custom Template",
  "description": "Description of what this template does",
  "category": "general",
  "tags": ["web", "api"],
  "complexity": "medium",
  "useCase": "Best for building REST APIs",
  "version": "1.0.0",
  "isCustom": true,
  "variables": [    // FUTURE USE
    {
      "name": "framework",
      "type": "enum",
      "description": "Framework to use",
      "options": ["express", "fastify", "koa"],
      "default": "express"
    }
  ]
}
```

#### `template.md`
This containts the prompt telling Claude what to do as well as the template - a simplified example:
```markdown
# Create Product Requirements Prompt (PRP)    

## Feature Request: $FEATURE_REQUEST

## Codebase Path: $CODEBASE PATH 

## Instructions

Generate a complete PRP for TypeScript/JavaScript feature implementation with deep and thorough research. Ensure rich context is passed to the AI through the PRP to enable one pass implementation success through self-validation and iterative refinement.
## PRP Generation

Use the following PRP template:

<template>
## Goal

[What needs to be built - be specific about the end state and desires]

## Why

- [Business value and user impact]
- [Integration with existing features]
- [Problems this solves and for whom]

## What

[User-visible behavior and technical requirements]
</template>

### Implementation Blueprint

- Start with pseudocode showing approach
- Reference real files for patterns
- Include error handling strategy
- List tasks to be completed to fulfill the PRP in the order they should be completed, use the pattern in the PRP with information dense keywords

**_ CRITICAL AFTER YOU ARE DONE RESEARCHING AND EXPLORING THE CODEBASE BEFORE YOU START WRITING THE PRP _**

**_ THINK ABOUT THE PRP AND PLAN YOUR APPROACH IN DETAILED TODOS THEN START WRITING THE PRP _**

## Output

Output ONLY the generated PRP. DO NOT output your thinking.

## Quality Checklist

- [ ] All necessary context included
- [ ] References existing patterns
- [ ] Clear implementation path
```