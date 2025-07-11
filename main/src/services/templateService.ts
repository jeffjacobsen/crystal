import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { Logger } from '../utils/logger';
import type { PRPTemplate, TemplateVariable } from '../types/prp';

export class TemplateService {
  private templates: Map<string, PRPTemplate> = new Map();
  private defaultTemplatesPath: string;
  private userTemplatePaths: string[];
  private logger: Logger;
  private isInitialized = false;

  constructor(logger: Logger) {
    this.logger = logger;
    
    // Default templates are in app resources
    this.defaultTemplatesPath = path.join(
      app.getAppPath(),
      'resources',
      'prp-templates',
      'default'
    );
    
    // Default user template location
    const userDataPath = app.getPath('userData');
    this.userTemplatePaths = [
      path.join(userDataPath, 'templates')
    ];
    
    // Ensure user template directory exists
    fs.ensureDirSync(this.userTemplatePaths[0]);
  }

  async initialize(customPaths?: string[]): Promise<void> {
    try {
      await this.loadTemplates(customPaths);
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize template service:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async loadTemplates(customPaths?: string[]): Promise<void> {
    this.templates.clear();
    
    // Load default templates
    if (await fs.pathExists(this.defaultTemplatesPath)) {
      await this.scanTemplateDirectory(this.defaultTemplatesPath, false);
    } else {
      this.logger.warn(`Default templates path not found: ${this.defaultTemplatesPath}`);
    }
    
    // Load user templates
    const paths = customPaths || this.userTemplatePaths;
    for (const templatePath of paths) {
      if (await fs.pathExists(templatePath)) {
        await this.scanTemplateDirectory(templatePath, true);
      }
    }
    
    this.logger.info(`Loaded ${this.templates.size} templates`);
  }

  private async scanTemplateDirectory(dir: string, isCustom: boolean): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templatePath = path.join(dir, entry.name);
          const metadataPath = path.join(templatePath, 'metadata.json');
          
          if (await fs.pathExists(metadataPath)) {
            try {
              const metadata = await fs.readJson(metadataPath);
              const template: PRPTemplate = {
                ...metadata,
                isCustom,
                path: templatePath
              };
              
              // Validate required fields
              if (!template.id || !template.name || !template.category) {
                this.logger.warn(`Invalid template metadata at ${templatePath}: missing required fields`);
                continue;
              }
              
              // User templates override default templates with same ID
              if (!this.templates.has(template.id) || isCustom) {
                this.templates.set(template.id, template);
                this.logger.info(`Loaded template: ${template.name} (${template.id}) from ${templatePath}`);
              }
            } catch (error) {
              this.logger.error(`Failed to load template from ${templatePath}:`, error instanceof Error ? error : new Error(String(error)));
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan template directory ${dir}:`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getTemplate(templateId: string): Promise<{
    metadata: PRPTemplate;
    template: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const metadata = this.templates.get(templateId);
    if (!metadata) {
      throw new Error(`Template ${templateId} not found`);
    }

    try {
      const templateContent = await fs.readFile(
        path.join(metadata.path, 'template.md'),
        'utf-8'
      );

      return { metadata, template: templateContent };
    } catch (error) {
      this.logger.error(`Failed to read template files for ${templateId}:`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Failed to read template files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getAllTemplates(): PRPTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): PRPTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  getTemplatesByLanguage(language: string): PRPTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.language === language);
  }

  async validateTemplate(templatePath: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Check if path exists
    if (!await fs.pathExists(templatePath)) {
      errors.push(`Template path does not exist: ${templatePath}`);
      return { valid: false, errors };
    }
    
    // Check if it's a directory
    const stat = await fs.stat(templatePath);
    if (!stat.isDirectory()) {
      errors.push(`Template path is not a directory: ${templatePath}`);
      return { valid: false, errors };
    }
    
    // Check required files exist
    const requiredFiles = ['metadata.json', 'template.md'];
    for (const file of requiredFiles) {
      const filePath = path.join(templatePath, file);
      if (!await fs.pathExists(filePath)) {
        errors.push(`Missing required file: ${file}`);
      }
    }
    
    // Validate metadata structure
    try {
      const metadataPath = path.join(templatePath, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        
        // Check required fields
        if (!metadata.id) errors.push('Missing required field in metadata: id');
        if (!metadata.name) errors.push('Missing required field in metadata: name');
        if (!metadata.category) errors.push('Missing required field in metadata: category');
        if (!metadata.version) errors.push('Missing required field in metadata: version');
        
        // Validate variable definitions if present
        if (metadata.variables && Array.isArray(metadata.variables)) {
          metadata.variables.forEach((variable: TemplateVariable, index: number) => {
            if (!variable.name) {
              errors.push(`Variable at index ${index} missing required field: name`);
            }
            if (!variable.type) {
              errors.push(`Variable at index ${index} missing required field: type`);
            }
            if (variable.type === 'enum' && (!variable.options || !Array.isArray(variable.options))) {
              errors.push(`Enum variable ${variable.name} missing options array`);
            }
          });
        }
      }
    } catch (error) {
      errors.push(`Invalid metadata.json: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async createTemplateFromExample(templateId: string, targetPath: string): Promise<void> {
    // Create a new template based on an existing one
    const sourceTemplate = this.templates.get(templateId);
    if (!sourceTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Copy template files
    await fs.copy(sourceTemplate.path, targetPath);
    
    // Update metadata to mark as custom
    const metadataPath = path.join(targetPath, 'metadata.json');
    const metadata = await fs.readJson(metadataPath);
    metadata.id = `custom-${metadata.id}-${Date.now()}`;
    metadata.name = `Custom ${metadata.name}`;
    metadata.author = 'User';
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    
    this.logger.info(`Created new template from ${templateId} at ${targetPath}`);
  }

  async createBlankTemplate(targetPath: string, templateInfo: {
    id: string;
    name: string;
    category: string;
    language?: string;
    framework?: string;
  }): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(targetPath);
    
    // Create metadata.json
    const metadata: Partial<PRPTemplate> = {
      id: templateInfo.id,
      name: templateInfo.name,
      description: 'A custom PRP template',
      version: '1.0.0',
      author: 'User',
      category: templateInfo.category,
      tags: [],
      language: templateInfo.language,
      framework: templateInfo.framework,
      complexity: 'medium',
      useCase: 'Custom use case',
      variables: []
    };
    
    await fs.writeJson(path.join(targetPath, 'metadata.json'), metadata, { spaces: 2 });
    
    // Create template.md
    const templateContent = `# ${templateInfo.name} PRP

## Goal
[What needs to be built]

## Why
[Business value and user impact]

## What
[User-visible behavior and technical requirements]

### Success Criteria
- [ ] [Specific measurable outcome]

## All Needed Context

### Documentation & References
\`\`\`yaml
- file: [path/to/file]
  why: [Why this file is relevant]
\`\`\`

## Implementation Blueprint

### Tasks in Implementation Order
\`\`\`yaml
Task 1: [First task]
Task 2: [Second task]
\`\`\`

## Validation Loop

### Level 1: Code Quality
\`\`\`bash
# Validation commands
\`\`\`
`;
    
    await fs.writeFile(path.join(targetPath, 'template.md'), templateContent);
    
    this.logger.info(`Created blank template at ${targetPath}`);
  }
}