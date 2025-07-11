# Generate PRP - Backend Service & IPC Handler

## Feature Request: $FEATURE_REQUEST

## Codebase Path: $CODEBASE_PATH

## Instructions

Generate a comprehensive Product Requirement Prompt for a backend service.

The AI agent only gets the context you are appending to the PRP and its own training data. Assume the AI agent has access to the codebase and the same knowledge cutoff as you, so it's important that your research findings are included or referenced in the PRP.

## Backend Service Research Process

> During the research process, create clear tasks. The deeper research we do here the better the PRP will be. We optimize for seamless integration with the existing backend architecture.

### 1. Analyze Service Requirements
Based on the feature request, determine:
- What data/operations are needed
- Whether database access is required
- What the frontend will need from this service
- Security/permission considerations

### 2. Find Similar Services

#### Service Patterns
```bash
# List existing services
ls main/src/services/

# Find services with similar functionality
grep -l "similar-operation" main/src/services/*.ts

# Analyze service structure
head -50 main/src/services/sessionManager.ts | grep -E "constructor|async|public|private"

# Check service initialization
grep -A 5 -B 5 "new.*Service" main/src/index.ts
```

#### IPC Handler Patterns  
```bash
# Find IPC handler files
ls main/src/ipc/

# Check handler patterns
grep -E "ipcMain.handle|success:|error:" main/src/ipc/*.ts | head -20

# Find similar IPC operations
rg "{{FEATURE_AREA}}" main/src/ipc/ --type ts -B 3 -A 10
```

### 3. Database Research (if needed)

#### Schema Analysis
```bash
# Check existing tables
grep -E "CREATE TABLE|interface.*{" main/src/database/models.ts

# Find similar database operations
rg "db.prepare.*{{ENTITY}}" main/src --type ts -B 2 -A 5

# Check for existing migrations
grep -A 20 "runMigrations" main/src/database/database.ts
```

#### Transaction Patterns
```bash
# Find transaction usage
rg "db.transaction" main/src --type ts -B 3 -A 10

# Check prepared statement patterns
rg "prepare\(" main/src/services --type ts -B 2 -A 5
```

### 4. Service Integration Research

#### Service Dependencies
```bash
# Check how services are initialized
grep -B 10 -A 10 "services: AppServices" main/src/index.ts

# Find service imports
grep "import.*Service" main/src/index.ts

# Check AppServices interface
cat main/src/ipc/types.ts | grep -A 30 "interface AppServices"
```

#### Frontend API Integration
```bash
# Check existing API methods
grep -A 10 "static {{IPC_NAMESPACE}}" frontend/src/utils/api.ts

# Find preload bindings
grep -A 10 "{{IPC_NAMESPACE}}:" main/src/preload.ts

# Check type definitions
grep -A 10 "{{IPC_NAMESPACE}}:" frontend/src/types/electron.d.ts
```

### 5. Error Handling Patterns

```bash
# Find error handling in services
rg "catch.*error" main/src/services --type ts -A 5

# Check logger usage
rg "logger\.(error|warn|info)" main/src/services --type ts -B 2 -A 2

# IPC error responses
rg "success: false" main/src/ipc --type ts -B 3 -A 1
```

### 6. Crystal-Specific Backend Patterns

#### Logging Standards
```bash
# Check logging patterns
rg "this.logger" main/src/services --type ts -A 2 | head -20

# Find log categories
rg "logger\.(info|error).*:" main/src/services --type ts | grep -o "'[^']*'" | sort | uniq
```

#### Type Safety
```bash
# Check type definitions
find main/src -name "*.ts" -exec grep -l "interface.*Request\|interface.*Response" {} \;

# Parameter validation
rg "if \(!.*\)" main/src/services --type ts -A 3 | grep -E "throw|return.*error"
```

## PRP Generation

Use the following PRP template:

<template>

# Backend Service

## Goal
Create a backend service with IPC handlers

## Why

- Provide backend functionality for the main process
- Maintain clean separation of concerns
- Enable frontend features through IPC communication

## What
Implement a Node.js/TypeScript service in the main process with:
- Business logic in a dedicated service class
- IPC handlers for frontend communication
- Proper error handling and logging
- Database operations with SQLite
- Database schema updates via migration

### Success Criteria
- [ ] Service class implemented with clear methods
- [ ] IPC handlers registered and working
- [ ] Error handling covers all edge cases
- [ ] TypeScript types properly defined
- [ ] Database operations are transactional and safe
- [ ] Database migration applied successfully
- [ ] Frontend can successfully call the service
- [ ] All tests pass

## All Needed Context

### Documentation & References
```yaml
# Crystal backend patterns
- file: CLAUDE.md
  why: Backend architecture and service patterns

- file: main/src/services/sessionManager.ts
  why: Example of a well-structured service class

- file: main/src/ipc/session.ts
  why: IPC handler patterns and error handling

- file: main/src/database/database.ts
  why: Database service and migration patterns

- file: main/src/database/models.ts
  why: TypeScript model definitions

- file: main/src/utils/logger.ts
  why: Logging patterns for services

# Service-specific files (from research)
- file: [similar service found]
  why: [pattern to follow]
```

### Backend Architecture

#### Service Pattern
```typescript
export class {{SERVICE_NAME}} {
  constructor(
    private db: DatabaseService,
    private logger: Logger
  ) {}

  async method(params: Type): Promise<Result> {
    this.logger.info(`{{SERVICE_NAME}}: method called`, { params });
    
    try {
      // Business logic
      return result;
    } catch (error) {
      this.logger.error(`{{SERVICE_NAME}}: method failed`, error);
      throw error;
    }
  }
}
```

#### IPC Handler Pattern
```typescript
ipcMain.handle('{{IPC_NAMESPACE}}:method', async (_, params) => {
  try {
    const result = await service.method(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to execute method:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});
```


### Database Patterns

#### Query Patterns
```typescript
// Single query
const result = this.db.db.prepare('SELECT * FROM table WHERE id = ?').get(id);

// Transaction
const transaction = this.db.db.transaction(() => {
  // Multiple operations
  stmt1.run(params1);
  stmt2.run(params2);
});
transaction();
```

#### Model Types
```typescript
export interface ModelName {
  id: number;
  created_at: string;
  updated_at: string;
  // other fields
}
```


## Implementation Blueprint

### Task 1: Create Service Class
```yaml
CREATE: main/src/services/{{SERVICE_NAME}}.ts
PATTERN: Follow sessionManager.ts structure
INCLUDE:
  - Constructor with dependencies
  - Public methods for operations
  - Private helper methods
  - Comprehensive logging
  - Error handling
```

### Task 2: Database Migration
```yaml
UPDATE: main/src/database/database.ts
ADD: Migration in runMigrations()
PATTERN:
  - Check if changes already exist
  - Apply changes safely
  - Handle rollback if needed
```

### Task 3: IPC Handlers
```yaml
CREATE/UPDATE: main/src/ipc/{{IPC_NAMESPACE}}.ts
PATTERN: Follow existing IPC files
INCLUDE:
  - Import service and types
  - Register handlers with consistent naming
  - Return consistent success/error format
  - Log operations
```

### Task 4: Update Service Registry
```yaml
UPDATE: main/src/index.ts
ADD:
  - Import new service
  - Initialize in main setup
  - Add to services object

UPDATE: main/src/ipc/types.ts
ADD: Service to AppServices interface
```

### Task 5: Frontend Integration
```yaml
UPDATE: frontend/src/types/electron.d.ts
ADD: IPC method signatures

UPDATE: frontend/src/utils/api.ts
ADD: API methods for new service

UPDATE: main/src/preload.ts
ADD: IPC method bindings
```

### Task 6: Add Types
```yaml
UPDATE: main/src/database/models.ts
ADD: TypeScript interfaces for models
```

## Validation Loop

### Level 1: TypeScript
```bash
# Check backend types
pnpm typecheck
```

### Level 2: Linting
```bash
# Lint the service
pnpm lint main/src/services/{{SERVICE_NAME}}.ts
pnpm lint main/src/ipc/{{IPC_NAMESPACE}}.ts
```

### Level 3: Service Testing
```bash
# Start dev environment
pnpm electron-dev

# Test IPC calls from DevTools console
await window.electronAPI.{{IPC_NAMESPACE}}.method(params)
```

### Level 4: Integration Testing
```bash
# Test from frontend component
# Verify:
1. IPC calls succeed
2. Data is returned correctly
3. Errors are handled gracefully
4. Database updates work
5. Migration applied correctly
```

### Level 5: Build Validation
```bash
# Ensure production build works
pnpm build

# Test in production mode
pnpm start
```

## Common Backend Patterns

### Error Handling
```typescript
// Service method
async method(param: string): Promise<Result> {
  if (!param) {
    throw new Error('Parameter is required');
  }
  
  try {
    // Operation
    return result;
  } catch (error) {
    this.logger.error('Operation failed:', error);
    throw new Error(`Failed to process: ${error.message}`);
  }
}
```

### Async Operations
```typescript
// Proper async handling
async processMultiple(items: Item[]): Promise<Result[]> {
  // Process in parallel when possible
  const results = await Promise.all(
    items.map(item => this.processItem(item))
  );
  return results;
}
```

### Database Best Practices
```typescript
// Use parameterized queries
const stmt = this.db.db.prepare('SELECT * FROM users WHERE email = ?');
const user = stmt.get(email);

// Always use transactions for multiple operations
const insertMany = this.db.db.transaction((items) => {
  const stmt = this.db.db.prepare('INSERT INTO items (name) VALUES (?)');
  for (const item of items) {
    stmt.run(item.name);
  }
});
```

## Final Validation Checklist
- [ ] Service class follows Crystal patterns
- [ ] All public methods have proper TypeScript types
- [ ] IPC handlers return consistent response format
- [ ] Errors are logged and user-friendly messages returned
- [ ] No TypeScript or ESLint errors
- [ ] Database queries use parameters (no SQL injection)
- [ ] Transactions used for multi-step operations
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Frontend successfully calls all endpoints
- [ ] Service is properly initialized in main process

</template>

### Context Integration

Based on research, ensure the PRP includes:

1. **Service Structure**: Based on similar services found
2. **IPC Patterns**: Consistent with existing handlers
3. **Database Patterns**: If applicable, following Crystal's approach
4. **Error Handling**: Using Crystal's logging and error format
5. **Type Definitions**: Complete TypeScript interfaces
6. **Integration Points**: All files that need updates

### Service Type Considerations

#### Data Services
- CRUD operations pattern
- Database transaction handling
- Data validation approach
- Caching if applicable

#### Processing Services
- Async operation handling
- Progress reporting via IPC
- Cancellation support
- Resource cleanup

#### Integration Services
- External API handling
- Authentication/authorization
- Rate limiting
- Timeout handling

### Database-Specific Research (if USE_DATABASE)

#### Migration Planning
```bash
# Check migration history
ls main/src/database/migrations/

# Current schema version
sqlite3 ~/.crystal/sessions.db "SELECT * FROM schema_migrations;"

# Table structure
sqlite3 ~/.crystal/sessions.db ".schema {{TABLE_NAME}}"
```

#### Index Analysis
```bash
# Check existing indexes
grep -E "CREATE.*INDEX" main/src/database/database.ts

# Find slow queries that might need indexes
rg "SELECT.*JOIN|WHERE.*AND" main/src --type ts
```

### Template Enhancement

Update the template with:
1. Specific service examples from codebase
2. Actual IPC handler patterns used
3. Real error messages and logging formats
4. Existing type definitions to follow
5. Database patterns if applicable
6. List of all files requiring updates

**_ CRITICAL AFTER YOU ARE DONE RESEARCHING THE CODEBASE BEFORE YOU START WRITING THE PRP _**

**_ THINK ABOUT THE SERVICE ARCHITECTURE AND PLAN YOUR APPROACH IN DETAILED TODOS THEN START WRITING THE PRP _**

## Output

Output ONLY the generated PRP. DO NOT output your thinking.

## Quality Checklist

- [ ] Found similar service patterns?
- [ ] Identified all integration points?
- [ ] Understood error handling approach?
- [ ] Located type definition patterns?
- [ ] Found database patterns if needed?
- [ ] Identified initialization process?
- [ ] Validation gates are executable
- [ ] Service integrates seamlessly

Score the PRP on a scale of 1-10 (confidence level to implement the service in one pass using claude codes)

Remember: The goal is to create a service that integrates seamlessly with Crystal's existing backend architecture.