# PRP Template Selection Guide

## When to Use Each Template

### 🏗️ Base PRP Template (`base)
**Use when:** Building any new feature that requires comprehensive planning

**Best for:**
- Complex multi-file features
- Features requiring extensive context
- When you need thorough validation loops
- First-time implementations in a codebase area

**Example scenarios:**
- Adding a new major feature to an application
- Implementing a complex algorithm or data processing pipeline  
- Creating new architectural components
- Features spanning multiple layers (UI + API + database)

### 🎨 Web Feature Template (`web-react`)
**Use when:** Building frontend components or UI features

**Best for:**
- React components and UI elements
- User interaction features
- Frontend state management
- Modal dialogs and forms
- Dashboard or visualization components

**Example scenarios:**
- Creating a new settings dialog
- Building a data visualization component
- Adding a new page or view
- Implementing interactive user workflows

### ⚙️ Backend Service Template (`backend-node`)
**Use when:** Building server-side functionality

**Best for:**
- REST API endpoints
- Business logic services  
- Database integration
- Data processing pipelines
- Authentication/authorization features

**Example scenarios:**
- Adding new API endpoints
- Creating background job processors
- Implementing data import/export features
- Building authentication systems

### 🐛 Bug Fix Template (`bug-fix`)
**Use when:** Investigating and fixing bugs

**Best for:**
- Systematic bug investigation
- Complex issues requiring root cause analysis
- Bugs affecting multiple components
- Issues requiring regression prevention

**Example scenarios:**
- Fixing race conditions or timing issues
- Resolving data corruption bugs
- Fixing memory leaks or performance issues
- Addressing security vulnerabilities

## Template Selection Decision Tree

```
Is this a bug fix or issue investigation?
├─ Yes → Use Bug Fix Template
└─ No → Is this primarily frontend work?
    ├─ Yes → Use Web Feature Template
    └─ No → Is this primarily backend/API work?
        ├─ Yes → Use Backend Service Template
        └─ No → Use Base PRP Template
```

## Customizing Templates

### Adding Project-Specific Context
When using any template, customize these sections:

1. **Documentation & References**
   - Add your project's specific documentation URLs
   - Include relevant example files from your codebase
   - Reference your coding standards and patterns

2. **Known Gotchas**
   - Add project-specific pitfalls and common mistakes
   - Include library version constraints
   - Document any custom patterns or conventions

3. **Validation Loop**
   - Customize commands for your build system
   - Add project-specific testing requirements
   - Include any custom linting or validation steps

### Template Combination

For complex features, you might combine templates:

- **Full-stack feature**: Start with Base template, then use Web + Backend sections
- **UI with API**: Use Web Feature template + Backend Service validation
- **Complex bug**: Use Bug Fix template + relevant feature template for the fix

## Best Practices

### 📝 Writing Effective PRPs

1. **Be Specific**: Include exact file paths, method names, and code patterns
2. **Include Context**: Add all necessary documentation and examples
3. **Define Success**: Clear, measurable completion criteria
4. **Plan Validation**: Comprehensive testing and verification steps

### 🔄 Iterative Refinement

1. **Start Simple**: Begin with core functionality
2. **Validate Early**: Run tests and validation loops frequently
3. **Iterate**: Add complexity after core functionality works
4. **Document Learning**: Update the PRP with insights gained

### 🎯 Context Optimization

1. **Just Enough**: Include necessary context without overwhelming
2. **Recent Examples**: Use current codebase patterns, not outdated ones
3. **Error Prevention**: Anticipate common mistakes and provide guidance
4. **Performance Awareness**: Include relevant performance considerations

## Quality Checklist

Before using any PRP template, ensure:

- [ ] All placeholders are filled with project-specific information
- [ ] Required documentation URLs are accessible and current
- [ ] Example file paths exist and are relevant
- [ ] Validation commands work in your environment
- [ ] Success criteria are specific and measurable
- [ ] Implementation tasks are broken down appropriately

## Template Contribution

To improve these templates:

1. **Track Pain Points**: Note where templates could be clearer
2. **Document Patterns**: Add successful patterns to templates
3. **Update Examples**: Keep code examples current with project evolution
4. **Share Insights**: Document lessons learned for future PRPs