# Generate Product Requirements Prompt (PRP) - Bug Fix Investigation

## Feature Request: $FEATURE_REQUEST

## Codebase Path: $CODEBASE_PATH

## Instructions

Generate a complete PRP for fixing a bug in Crystal. Ensure thorough investigation and root cause analysis to enable one-pass bug resolution with proper testing and prevention measures.

The AI agent only gets the context you are appending to the PRP and its own training data. Assume the AI agent has access to the codebase and the same knowledge cutoff as you, so it's important that your research findings are included or referenced in the PRP.

## Bug Fix Research Process

> During the research process, create clear tasks. The deeper research we do here the better the PRP will be. We optimize for fixing the root cause, not just the symptoms.

### 1. Understand the Bug Report
Parse the bug report to identify:
- What is broken (symptoms)
- When it happens (reproduction steps)
- Expected vs actual behavior
- Error messages or stack traces
- User impact severity

### 2. Search for Related Code

#### Error Message Search
```bash
# If there's an error message, search for it
rg "error message text" --type ts --type tsx -B 3 -A 3

# Search for the feature area
rg "feature-name" --type ts --type tsx -C 5

# Look for similar error patterns
rg "catch.*error|showError|console.error" --type ts -A 5 | grep -i "related-term"
```

#### Component/Function Search
```bash
# Find the component mentioned in bug
find . -name "*ComponentName*" -type f

# Search for the problematic function
rg "functionName\(" --type ts --type tsx -B 2 -A 10

# Check for event handlers
rg "onClick|onChange|onSubmit" frontend/src/components/ | grep -i "feature"
```

### 3. Trace the Bug Path

#### Frontend Bugs
```bash
# Find where component is used
rg "ComponentName" frontend/src --type tsx -B 2 -A 2

# Check state management
rg "useState.*problematicState" frontend/src --type tsx -B 5 -A 5

# Find IPC calls
rg "API\." frontend/src/components/ProblematicComponent.tsx -B 5 -A 10
```

#### Backend Bugs
```bash
# Find IPC handler
rg "ipcMain.handle.*'problematic-endpoint'" main/src --type ts

# Check service implementation
find main/src/services -name "*.ts" | xargs grep -l "problematicMethod"

# Database queries
rg "db.prepare.*problematic" main/src --type ts -B 3 -A 5
```

### 4. Check Recent Changes
```bash
# See recent commits to the problematic file
git log -p --since="1 week ago" path/to/problematic/file.ts

# Check for related issues
git log --grep="similar issue" --oneline

# See what changed recently in the area
git diff HEAD~10 -- path/to/feature/
```

### 5. Identify Common Bug Patterns

#### Race Conditions
```bash
# Look for async operations without proper handling
rg "async.*setState|setLoading.*await" --type tsx -A 10

# Check for missing dependencies in useEffect
rg "useEffect\(" frontend/src --type tsx -A 10 | grep -B 10 "eslint-disable"
```

#### Type Mismatches
```bash
# Check for any type assertions
rg "as any|as unknown" --type ts --type tsx

# Look for ignored TypeScript errors
rg "@ts-ignore|@ts-expect-error" --type ts --type tsx -B 2 -A 2
```

#### Memory Leaks
```bash
# Check for missing cleanup
rg "addEventListener|on\(" --type ts --type tsx -A 20 | grep -v "removeEventListener|off\("

# Intervals without cleanup
rg "setInterval" --type ts --type tsx -A 10 | grep -v "clearInterval"
```

### 6. Crystal-Specific Bug Areas

#### IPC Communication
- Check error handling in both main and renderer
- Verify response format matches expectations
- Look for timeout issues

#### State Management
- Check Zustand store updates
- Look for stale closures
- Verify targeted updates vs global refreshes

#### Database Operations
- Check for transaction failures
- Verify timestamp handling
- Look for migration issues

## PRP Generation

Use the following PRP template:

<template>

## Why

- Restore expected functionality
- Prevent user frustration
- Maintain application stability

## What
Investigate and fix a bug in with proper root cause analysis and prevention measures.

### Success Criteria
- [ ] Bug is reproducible before fix
- [ ] Root cause identified
- [ ] Fix implemented and verified
- [ ] No regressions introduced
- [ ] Tests written to prevent regression{{/WRITE_TESTS}}
- [ ] Error handling improved if applicable

## All Needed Context

### Documentation & References
```yaml
# Project-specific
- file: CLAUDE.md
  why: Error handling patterns and debugging guidelines

- file: main/src/utils/logger.ts
  why: Logging utilities for debugging

# Error locations
- file: frontend/src/stores/errorStore.ts
  why: Error display patterns

- file: main/src/index.ts
  why: Main process error handling setup

# Bug-specific files (from investigation)
- file: [exact file where bug occurs]
  why: [specific function/component with issue]
  
- file: [related files that interact]
  why: [how they contribute to the bug]
```

### Bug Investigation Steps

#### 1. Reproduce the Bug
```bash
# Start in development mode
pnpm electron-dev

# Steps to reproduce:
1. [User action that triggers bug]
2. [Expected result vs actual result]
3. [Any error messages or console output]
```

#### 2. Gather Information
- Error messages in console
- Stack traces
- Recent changes that might have introduced the bug
- Related issues or patterns

#### 3. Crash-Specific Investigation
- Check main process logs
- Look for unhandled promise rejections
- Verify IPC error handling
- Check for memory leaks

#### 3. UI Bug Investigation
- Check React component state
- Verify CSS/Tailwind classes
- Look for race conditions in updates
- Check dark mode compatibility

#### 3. Performance Investigation
- Profile with Chrome DevTools
- Check for unnecessary re-renders
- Look for N+1 queries
- Verify debouncing/throttling

#### 3. Logic Bug Investigation
- Trace data flow completely
- Check edge cases
- Verify business logic assumptions
- Look for off-by-one errors

### Root Cause Analysis
```yaml
SYMPTOM: [What users see]
CAUSE: [Technical reason for the bug]
LOCATION: [Exact file:line where bug occurs]
TRIGGER: [What conditions cause it]
```

## Implementation Blueprint

### Task 1: Reproduce and Diagnose
```yaml
INVESTIGATE:
  - Reproduce bug consistently
  - Add debug logging if needed
  - Identify exact failure point
  - Document root cause

TOOLS:
  - Chrome DevTools for frontend
  - Console logs for main process
  - Database queries if data-related
```

### Task 2: Implement Fix
```yaml
FIX_LOCATION:
  - File: [identified file]
  - Function/Component: [specific location]
  - Line numbers: [approximate lines]

APPROACH:
  - Minimal change to fix issue
  - Preserve existing functionality
  - Follow Crystal patterns
  
CODE_PATTERN:
  # Show the problematic code
  # Then show the fixed version
  # Explain why the fix works
```

### Task 3: Write Tests
```yaml
TEST_COVERAGE:
  - Unit test for fixed function
  - Integration test for user flow
  - Edge cases that might break

LOCATION:
  - Test file: tests/[feature].spec.ts
  - Follow existing test patterns
```

### Task 4: Verify Fix
```yaml
VERIFICATION:
  - Original bug no longer occurs
  - No new errors introduced
  - Performance not degraded
  - UI looks correct in light/dark mode
```

## Common Bug Patterns

### IPC Communication Issues
```typescript
// Always wrap IPC calls in try/catch
try {
  const result = await API.method();
  if (!result.success) {
    throw new Error(result.error);
  }
} catch (error) {
  // Handle error appropriately
}
```

### State Update Race Conditions
```typescript
// Use functional updates to avoid stale state
setState(prev => ({
  ...prev,
  newValue: calculated
}));
```

### Database Transaction Issues
```typescript
// Always use transactions for multi-step operations
const transaction = db.transaction(() => {
  // Multiple operations
});
transaction();
```

## Validation Loop

### Level 1: Type Safety
```bash
# Ensure no type errors introduced
pnpm typecheck
```

### Level 2: Code Quality
```bash
# Check linting
pnpm lint

# Auto-fix if needed
pnpm lint --fix
```

### Level 3: Automated Tests
```bash
# Run relevant tests
pnpm test [test-file]

# Run all tests to check for regressions
pnpm test
```

### Level 4: Manual Verification
```bash
# Start dev environment
pnpm electron-dev

# Verify:
1. Original bug is fixed
2. No visual regressions
3. Performance is acceptable
4. Error handling works
```

### Level 5: Build Validation
```bash
# Ensure production build works
pnpm build

# Test production build
pnpm start

# Verify fix works in production mode
```

## Final Validation Checklist
- [ ] Bug can no longer be reproduced
- [ ] Root cause documented in code comments
- [ ] No TypeScript errors
- [ ] No ESLint warnings
{{#WRITE_TESTS}}- [ ] Tests pass and cover the fix{{/WRITE_TESTS}}
- [ ] Manual testing confirms fix works
- [ ] No performance degradation
- [ ] Error messages are user-friendly if applicable
- [ ] Similar bugs prevented by the fix approach

## Prevention Measures
- Document the bug pattern for future reference
- Add logging to catch similar issues early
- Consider adding automated checks
- Update documentation if needed

</template>

### Critical Context to Include

Based on research, ensure the PRP includes:

1. **Exact Error Location**: File path and line numbers
2. **Root Cause Hypothesis**: Based on code analysis
3. **Related Code**: Other files that might be affected
4. **Test Scenarios**: How to verify the fix
5. **Prevention Measures**: How to avoid similar bugs

### Bug Type Specific Instructions

For Crashes (BUG_TYPE = "crash"):
- Include unhandled promise rejection handling
- Check process communication failures
- Look for null/undefined access

For UI Bugs (BUG_TYPE = "ui"):
- Include CSS/Tailwind debugging
- Check responsive design
- Verify dark mode handling

For Logic Bugs (BUG_TYPE = "logic"):
- Trace data flow completely
- Check edge cases
- Verify business logic assumptions

For Performance Bugs (BUG_TYPE = "performance"):
- Include profiling instructions
- Check for unnecessary renders
- Look for N+1 queries

### Template Enhancement

Update the template with:
1. Specific file paths where bug occurs
2. Exact error messages or symptoms
3. Code snippets showing the problem
4. Similar working code for comparison
5. Specific test cases to write

**_ CRITICAL AFTER YOU ARE DONE RESEARCHING THE BUG BEFORE YOU START WRITING THE PRP _**

**_ THINK ABOUT THE ROOT CAUSE AND PLAN YOUR FIX APPROACH IN DETAILED TODOS THEN START WRITING THE PRP _**

## Output

Output ONLY the generated PRP. DO NOT output your thinking.

## Quality Checklist

- [ ] Reproduction steps are clear?
- [ ] Root cause area identified?
- [ ] Related code sections found?
- [ ] Common patterns checked?
- [ ] Fix approach follows Crystal patterns?
- [ ] Validation gates are executable
- [ ] Prevention measures included

Score the PRP on a scale of 1-10 (confidence level to fix the bug in one pass using claude codes)

Remember: The goal is to fix the root cause while preventing similar issues in the future.