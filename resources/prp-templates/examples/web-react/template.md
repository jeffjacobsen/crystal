# Generate PRP - React TypeScript Component

## Feature Request: $FEATURE_REQUEST

## Codebase Path: $CODEBASE_PATH

## Instructions

Generate a comprehensive Product Requirement Prompt for a React component in Crystal's frontend.

The AI agent only gets the context you are appending to the PRP and its own training data. Assume the AI agent has access to the codebase and the same knowledge cutoff as you, so it's important that your research findings are included or referenced in the PRP.

## React Component Research Process

> During the research process, create clear tasks. The deeper research we do here the better the PRP will be. We optimize for creating components that seamlessly integrate with Crystal's existing React/TypeScript patterns.

### 1. Component Type Analysis
Based on the component type and the feature request, determine:
- What similar components exist in Crystal?
- What patterns should be followed?
- What utilities or hooks are needed?

### 2. Find Similar Components

#### For Different Component Types
```bash
# Dialog components
find frontend/src/components -name "*Dialog*.tsx" -o -name "*Modal*.tsx"

# Form components  
find frontend/src/components -name "*Form*.tsx" -o -name "Settings.tsx"

# List/Table components
find frontend/src/components -name "*List*.tsx" -o -name "*Table*.tsx" -o -name "*View*.tsx"

# Card components
find frontend/src/components -name "*Card*.tsx" -o -name "*Item*.tsx"

# Page components
ls frontend/src/components/ | grep -E "^[A-Z].*View\.tsx$"
```

### 3. Analyze Component Patterns

#### Structure Patterns
```bash
# Check how components are structured
head -50 frontend/src/components/SessionView.tsx | grep -E "import|interface|export"

# Find state management patterns
rg "useState|useEffect|useCallback" frontend/src/components/{{SIMILAR_COMPONENT}}.tsx

# Look for custom hooks usage
rg "use[A-Z]" frontend/src/components/ --type tsx | grep -v "useState\|useEffect" | head -20
```

#### Styling Patterns  
```bash
# Common Tailwind classes for component type
rg "className=" frontend/src/components/{{SIMILAR_COMPONENT}}.tsx | head -10

# Dark mode patterns
rg "dark:" frontend/src/components/{{SIMILAR_COMPONENT}}.tsx | head -10

# Responsive patterns
rg "(sm:|md:|lg:|xl:)" frontend/src/components/{{SIMILAR_COMPONENT}}.tsx
```

### 4. State Management Research (if needed)
```bash
# Find relevant Zustand stores
ls frontend/src/stores/

# Check store usage patterns
rg "useStore|create\(" frontend/src/stores/ -A 5

# Find components using stores
rg "import.*from.*stores" frontend/src/components/ --type tsx
```

### 5. IPC Communication Research (if needed)
```bash
# Find similar IPC operations
rg "API\." frontend/src/components/ --type tsx | grep -i "{{FEATURE_AREA}}"

# Check API utility for existing methods
grep -A 10 -B 2 "static {{FEATURE_AREA}}" frontend/src/utils/api.ts

# Find IPC handler patterns
rg "ipcMain.handle.*{{FEATURE_AREA}}" main/src/ipc/

# Check error handling patterns
rg "try.*await.*API\." frontend/src/components/ -A 10 --type tsx | head -30
```

### 6. Type Definitions Research
```bash
# Find relevant type definitions
find frontend/src/types -name "*.ts" -o -name "*.d.ts" | xargs grep -l "{{FEATURE_AREA}}"

# Check for existing interfaces
rg "interface.*{{ENTITY}}" frontend/src/types/

# Look for type patterns in similar components
grep -E "(interface|type).*Props" frontend/src/components/{{SIMILAR_COMPONENT}}.tsx
```

### 7. Crystal-Specific Patterns

#### Icon Usage
```bash
# Find Lucide icon imports
rg "from 'lucide-react'" frontend/src/components/ | grep -o "[A-Z][a-zA-Z]*" | sort | uniq | head -20
```

#### Loading States
```bash
# Loading state patterns
rg "loading\]|isLoading" frontend/src/components/ -B 2 -A 5 --type tsx | head -20
```

#### Error Handling
```bash
# Error display patterns
rg "error\]|showError|ErrorStore" frontend/src/components/ -B 2 -A 5 --type tsx
```

## PRP Generation

Use the following PRP template:

<template>

# React Component: {{COMPONENT_NAME}}

## Goal
Create a {{COMPONENT_TYPE}} component called {{COMPONENT_NAME}} that {{FEATURE_REQUEST}}

## Why
{{ADDITIONAL_CONTEXT}}
- Enhance Crystal's UI with reusable components
- Follow established React patterns in the codebase
- Maintain consistency with existing components

## What
Implement a React component with TypeScript that:
- Follows Crystal's component patterns and styling
- Uses Tailwind CSS for styling
- Includes proper TypeScript types
{{#USE_STATE_MANAGEMENT}}- Integrates with Zustand stores for state management{{/USE_STATE_MANAGEMENT}}
{{#USE_IPC}}- Communicates with the main process via IPC{{/USE_IPC}}
- Handles loading and error states appropriately

### Success Criteria
- [ ] Component renders without errors
- [ ] TypeScript compilation passes
- [ ] Component follows Crystal's UI patterns
- [ ] Proper error handling implemented
{{#USE_STATE_MANAGEMENT}}- [ ] State management working correctly{{/USE_STATE_MANAGEMENT}}
{{#USE_IPC}}- [ ] IPC communication functioning{{/USE_IPC}}
- [ ] Component is responsive and accessible

## All Needed Context

### Documentation & References
```yaml
# Crystal patterns
- file: CLAUDE.md
  why: Component patterns and guidelines
  
- file: frontend/src/components/SessionView.tsx
  why: Example of complex component with state and IPC

{{#eq COMPONENT_TYPE "dialog"}}
- file: frontend/src/components/CreateSessionDialog.tsx
  why: Dialog pattern with form handling
{{/eq}}

{{#eq COMPONENT_TYPE "form"}}
- file: frontend/src/components/Settings.tsx
  why: Form component with validation patterns
{{/eq}}

{{#eq COMPONENT_TYPE "list"}}
- file: frontend/src/components/DraggableProjectTreeView.tsx  
  why: List component with selection and actions
{{/eq}}

# Styling
- file: frontend/src/index.css
  why: Global styles and Tailwind setup

# Types
- file: frontend/src/types/
  why: TypeScript interfaces and types

# Component-specific files (from research)
- file: [similar component found]
  why: [pattern to follow]
```

### Component Structure Pattern
```typescript
// Standard imports
import { useState, useEffect } from 'react';
{{#USE_STATE_MANAGEMENT}}import { useStore } from '../stores/store';{{/USE_STATE_MANAGEMENT}}
{{#USE_IPC}}import { API } from '../utils/api';{{/USE_IPC}}
import { Icon } from 'lucide-react'; // Use specific icon

// Types
interface {{COMPONENT_NAME}}Props {
  // Define props
}

// Component
export function {{COMPONENT_NAME}}({ ...props }: {{COMPONENT_NAME}}Props) {
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  {{#USE_STATE_MANAGEMENT}}
  // Zustand store
  const { data, actions } = useStore();
  {{/USE_STATE_MANAGEMENT}}
  
  // Effects
  useEffect(() => {
    // Initial load or subscriptions
  }, []);
  
  // Handlers
  const handleAction = async () => {
    try {
      setLoading(true);
      {{#USE_IPC}}
      const result = await API.category.method();
      {{/USE_IPC}}
      // Handle success
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Render
  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
}
```

### Crystal Component Patterns

#### Styling
- Use Tailwind CSS classes exclusively
- Dark mode: `dark:` prefix for dark variants
- Common patterns:
  - Cards: `bg-white dark:bg-gray-800 rounded-lg shadow-lg`
  - Buttons: `px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700`
  - Text: `text-gray-900 dark:text-white`

#### State Management
{{#USE_STATE_MANAGEMENT}}
- Create a Zustand store slice if needed
- Use targeted updates, not full refreshes
- Example store usage:
```typescript
const { sessions, activeSession } = useSessionStore();
const { updateSession } = useSessionStore();
```
{{/USE_STATE_MANAGEMENT}}

#### Error Handling  
- Always show user-friendly error messages
- Use the error store for global errors:
```typescript
import { useErrorStore } from '../stores/errorStore';
const { showError } = useErrorStore();
```

{{#USE_IPC}}
#### IPC Communication
- Always check `isElectron()` before IPC calls
- Handle loading states during IPC operations
- Pattern:
```typescript
if (!isElectron()) {
  setError('This feature requires Electron');
  return;
}

try {
  const result = await API.namespace.method(params);
  if (result.success) {
    // Handle success
  } else {
    throw new Error(result.error);
  }
} catch (error) {
  showError({ title: 'Operation Failed', error: error.message });
}
```
{{/USE_IPC}}

## Implementation Blueprint

### Task 1: Create Component File
```yaml
CREATE: frontend/src/components/{{COMPONENT_NAME}}.tsx
PATTERN: Mirror structure from similar component
LOCATION: Organize in appropriate subdirectory if needed
```

### Task 2: Define Types
```yaml  
TYPES:
  - Props interface
  - Any data interfaces
  - Event handler types
LOCATION: In component file or frontend/src/types/
```

{{#USE_STATE_MANAGEMENT}}
### Task 3: Setup State Management
```yaml
STORE:
  - Create/update relevant store
  - Add actions and state
LOCATION: frontend/src/stores/
```
{{/USE_STATE_MANAGEMENT}}

{{#USE_IPC}}
### Task 4: Add IPC Handlers
```yaml
BACKEND:
  - Add handler in main/src/ipc/
  - Update types in electron.d.ts
  - Add to API utility
```
{{/USE_IPC}}

### Task 5: Implement Component Logic
```yaml
IMPLEMENT:
  - State management
  - Event handlers  
  - Effects and subscriptions
  - Error handling
```

### Task 6: Style Component
```yaml
STYLING:
  - Apply Tailwind classes
  - Ensure dark mode support
  - Test responsive behavior
```

### Task 7: Add to Parent Component
```yaml
INTEGRATION:
  - Import in parent component
  - Add to appropriate location
  - Pass required props
  - Handle events
```

## Validation Loop

### Level 1: TypeScript
```bash
# Check types
pnpm typecheck

# If errors, fix type issues
```

### Level 2: Linting
```bash
# Run ESLint
pnpm lint

# Auto-fix issues
pnpm lint --fix
```

### Level 3: Build Test
```bash
# Ensure component builds
pnpm build:frontend
```

### Level 4: Manual Testing
```bash
# Start dev server
pnpm electron-dev

# Test scenarios:
1. Component renders correctly
2. All interactions work
3. Error states display properly
4. Dark mode looks correct
{{#USE_IPC}}5. IPC operations complete successfully{{/USE_IPC}}
{{#USE_STATE_MANAGEMENT}}6. State updates work correctly{{/USE_STATE_MANAGEMENT}}
```

### Level 5: Production Build
```bash
# Full build test
pnpm build

# Test in production mode
pnpm start
```

## Common Component Patterns

### Loading States
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}
```

### Error States
```typescript
if (error) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
      <p className="text-red-600 dark:text-red-400">{error}</p>
    </div>
  );
}
```

### Empty States
```typescript
if (!data || data.length === 0) {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No items found</p>
    </div>
  );
}
```

## Final Validation Checklist
- [ ] Component follows Crystal's patterns
- [ ] TypeScript types are complete and accurate
- [ ] No ESLint warnings or errors
- [ ] Component is responsive (mobile to desktop)
- [ ] Dark mode styling is implemented
- [ ] Error handling is user-friendly
- [ ] Loading states are shown during async operations
{{#USE_IPC}}- [ ] IPC communication works reliably{{/USE_IPC}}
{{#USE_STATE_MANAGEMENT}}- [ ] State management is efficient{{/USE_STATE_MANAGEMENT}}
- [ ] Component is accessible (keyboard navigation, ARIA labels)

</template>

### Context Integration

Based on research, ensure the PRP includes:

1. **Similar Component References**: Actual files found that match the pattern
2. **Styling Examples**: Real Tailwind classes used in Crystal
3. **State Patterns**: How similar components manage state
4. **Type Definitions**: Actual interfaces from the codebase
5. **Error Patterns**: Crystal's error handling approach
6. **IPC Examples**: Real API calls if applicable

### Component-Specific Considerations

#### For Dialogs
- How are dialogs opened/closed?
- What's the overlay pattern?
- How is form data handled?

#### For Forms
- Validation patterns
- Field components used
- Submit handling
- Error display

#### For Lists
- Pagination approach
- Selection handling
- Actions per item
- Empty states

#### For Pages
- Routing setup
- Data loading  
- Layout structure
- Navigation integration

### Template Enhancement

Update the template with:
1. Specific component examples found
2. Actual Tailwind classes used  
3. Real store names and methods
4. Actual API endpoints if applicable
5. Specific type definitions
6. Component-specific patterns

**_ CRITICAL AFTER YOU ARE DONE RESEARCHING THE CODEBASE BEFORE YOU START WRITING THE PRP _**

**_ THINK ABOUT THE COMPONENT STRUCTURE AND PLAN YOUR APPROACH IN DETAILED TODOS THEN START WRITING THE PRP _**

## Output

Output ONLY the generated PRP. DO NOT output your thinking.

## Quality Checklist

- [ ] Found similar components to reference?
- [ ] Identified styling patterns to follow?
- [ ] Understood state management approach?
- [ ] Located relevant type definitions?
- [ ] Found error handling patterns?
- [ ] Identified all needed imports?
- [ ] Validation gates are executable
- [ ] Component integrates seamlessly

Score the PRP on a scale of 1-10 (confidence level to implement the component in one pass using claude codes)

Remember: The goal is to provide enough Crystal-specific context that the AI can create a component that looks and feels native to the codebase.