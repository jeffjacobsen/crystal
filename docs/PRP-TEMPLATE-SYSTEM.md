# PRP Template System Documentation

## Overview

The PRP (Product Requirement Prompt) Template System provides a flexible framework for creating structured development prompts in Crystal. Templates can be customized for different languages, frameworks, and development patterns.

## Current Implementation

### Template Structure

Each template consists of two files in a directory:

```
template-name/
├── metadata.json    # Template configuration and variables
└── template.md      # Combined template content and generation instructions
```

### Template Locations

- **Default Templates**: `resources/prp-templates/default/`
- **Example Templates**: `resources/prp-templates/examples/`
- **User Templates**: Future enhancement - `~/.crystal/templates/`

### Metadata Specification

The `metadata.json` file defines template properties:

```json
{
  "id": "unique-template-id",
  "name": "Template Display Name",
  "description": "Brief description of the template",
  "category": "frontend|backend|fullstack|bug-fix|other",
  "tags": ["react", "typescript"],
  "language": "TypeScript",
  "framework": "React",
  "complexity": "low|medium|high",
  "useCase": "When to use this template",
  "author": "Template author",
  "version": "1.0.0",
  "variables": [
    {
      "name": "COMPONENT_NAME",
      "description": "Name of the React component",
      "type": "string",
      "required": true,
      "pattern": "^[A-Z][a-zA-Z0-9]*$"
    },
    {
      "name": "USE_STATE_MANAGEMENT",
      "description": "Whether to use Zustand state management",
      "type": "boolean",
      "default": false
    },
    {
      "name": "COMPONENT_TYPE",
      "description": "Type of component",
      "type": "enum",
      "options": ["page", "dialog", "card", "form", "list"],
      "default": "page"
    }
  ]
}
```

### Template Content

The `template.md` file contains:
1. **Generation Instructions**: Research process and context gathering steps
2. **PRP Template**: The actual template with variable placeholders

Example structure:
```markdown
# Generate PRP - [Template Name]

## Feature Request: $FEATURE_REQUEST
## Codebase Path: $CODEBASE_PATH

## Instructions
[Research and generation instructions...]

## PRP Generation
<template>
[Actual PRP template content with {{VARIABLE_NAME}} placeholders]
</template>
```

### Built-in Variables

All templates automatically receive:
- `$FEATURE_REQUEST` - The user's feature description
- `$CODEBASE_PATH` - Path to the target codebase

## Current Templates

### Default Templates
1. **base** - General TypeScript development
   - Variables: `FEATURE_TYPE` (feature/enhancement/refactor/integration)

2. **bug-fix** - Bug investigation and fixing
   - Variables: `BUG_TYPE` (crash/ui/logic/performance/data), `WRITE_TESTS`

### Example Templates
1. **backend-node** - Backend service with IPC handlers
   - Variables: `SERVICE_NAME`, `IPC_NAMESPACE`, `USE_DATABASE`, `NEEDS_MIGRATION`

2. **crystal** - Crystal-specific React components
   - Variables: Similar to web-react

3. **web-react** - React TypeScript components
   - Variables: `COMPONENT_NAME`, `COMPONENT_TYPE`, `USE_STATE_MANAGEMENT`, `USE_IPC`

## Variable System (Partially Implemented)

### Backend Implementation ✅

The `prpGenerationService.ts` supports:
- String variable substitution with pattern validation
- Boolean variables with conditional sections
- Enum variables with predefined options
- Default values for optional variables

### Frontend Implementation ❌ (Future Enhancement)

Currently, the frontend doesn't collect variable values. A future enhancement would add:

1. **Variable Input UI** in PRPGenerator:
   ```typescript
   // After template selection, before generation
   if (selectedTemplate.variables?.length > 0) {
     return <VariableInputForm 
       variables={selectedTemplate.variables}
       onSubmit={(values) => generateWithVariables(values)}
     />;
   }
   ```

2. **Dynamic Form Generation**:
   - Text inputs for string variables with pattern validation
   - Checkboxes for boolean variables
   - Dropdowns for enum variables
   - Required field validation
   - Default value population

3. **Enhanced Generation Request**:
   ```typescript
   const request: PRPGenerationRequest = {
     templateId: selectedTemplate.id,
     featureRequest: featureRequest,
     codebasePath: codebasePath,
     variables: collectedVariableValues  // New
   };
   ```

## Template Development Guide

### Creating a New Template

1. **Choose appropriate category** and create directory:
   ```
   resources/prp-templates/[category]/[template-name]/
   ```

2. **Create metadata.json**:
   - Define unique ID and descriptive name
   - Add relevant tags for discoverability
   - Define variables for customization
   - Set appropriate complexity level

3. **Create template.md**:
   - Start with research instructions
   - Include specific commands for codebase analysis
   - Define clear success criteria
   - Use variable placeholders: `{{VARIABLE_NAME}}`
   - Add conditional sections: `{{#BOOLEAN_VAR}}...{{/BOOLEAN_VAR}}`

### Best Practices

1. **Variables**:
   - Use UPPER_SNAKE_CASE for variable names
   - Provide clear descriptions
   - Set sensible defaults
   - Use pattern validation for strings
   - Keep boolean variables for feature flags

2. **Templates**:
   - Include comprehensive research steps
   - Reference specific files in the codebase
   - Provide concrete code examples
   - Include validation steps
   - Keep instructions clear and actionable

3. **Metadata**:
   - Write clear, searchable descriptions
   - Use consistent categorization
   - Tag with relevant technologies
   - Version templates for updates

## Future Enhancements

1. **Variable Input UI**: Collect user input for template variables
2. **Template Marketplace**: Share templates with the community
3. **Template Inheritance**: Base templates that others extend
4. **Conditional Logic**: More complex template logic based on variables
5. **Custom Template Paths**: User-defined template directories
6. **Template Testing**: Validate templates generate valid PRPs
7. **Version Control**: Track template changes and updates

## Migration Notes

The system has been simplified from the original design:
- Removed separate `generate-prompt.md` files (merged into `template.md`)
- Simplified directory structure
- Focused on practical implementation over complex abstraction

For the latest implementation details, see:
- `/main/src/services/prpGenerationService.ts`
- `/main/src/services/templateService.ts`
- `/frontend/src/components/PRPGenerator/`